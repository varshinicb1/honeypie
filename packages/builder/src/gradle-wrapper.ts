import { access } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { HoneyPieError } from "@honeypie/core";

const execFileAsync = promisify(execFile);

export interface EnsureGradleWrapperResult {
  gradlewPath: string;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function gradlewName(): string {
  return process.platform === "win32" ? "gradlew.bat" : "gradlew";
}

async function findSystemGradle(): Promise<string | null> {
  const command = process.platform === "win32" ? "where" : "which";
  try {
    const { stdout } = await execFileAsync(command, ["gradle"]);
    const first = stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    return first ?? null;
  } catch {
    return null;
  }
}

/**
 * Ensures a Gradle wrapper exists in `projectDir`. If missing, invokes a system `gradle`
 * (required — this repo does not bundle a Gradle distribution) to generate one.
 */
export async function ensureGradleWrapper(
  projectDir: string,
  gradleVersion = "8.9"
): Promise<EnsureGradleWrapperResult> {
  const gradlewPath = join(projectDir, gradlewName());
  if (await pathExists(gradlewPath)) {
    return { gradlewPath };
  }

  const systemGradle = await findSystemGradle();
  if (!systemGradle) {
    throw new HoneyPieError(
      "No Gradle wrapper found in the project and no system `gradle` binary is available to generate one. " +
        "Install Gradle or commit a gradlew wrapper to the project.",
      "BUILDER_GRADLE_MISSING",
      { projectDir }
    );
  }

  try {
    await execFileAsync(systemGradle, ["wrapper", "--gradle-version", gradleVersion], {
      cwd: projectDir,
      maxBuffer: 1024 * 1024 * 16,
      shell: process.platform === "win32"
    });
  } catch (error) {
    throw new HoneyPieError(
      `Failed to generate a Gradle wrapper in ${projectDir}: ${tail(errorOutput(error))}`,
      "BUILDER_WRAPPER_GENERATION_FAILED",
      { projectDir }
    );
  }

  if (!(await pathExists(gradlewPath))) {
    throw new HoneyPieError(
      `Gradle wrapper generation reported success but ${gradlewPath} was not created.`,
      "BUILDER_WRAPPER_GENERATION_FAILED",
      { projectDir }
    );
  }

  return { gradlewPath };
}

function errorOutput(error: unknown): string {
  if (error && typeof error === "object") {
    const record = error as { stdout?: string; stderr?: string; message?: string };
    return [record.stdout, record.stderr, record.message].filter(Boolean).join("\n");
  }
  return String(error);
}

function tail(text: string, lines = 40): string {
  return text.split(/\r?\n/).slice(-lines).join("\n");
}
