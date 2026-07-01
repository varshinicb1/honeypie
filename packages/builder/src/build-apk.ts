import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { HoneyPieError } from "@honeypie/core";
import { ensureGradleWrapper } from "./gradle-wrapper.js";

const execFileAsync = promisify(execFile);

export interface BuildDebugApkResult {
  apkPath: string;
  packageName: string;
  mainActivity: string;
}

export async function buildDebugApk(projectDir: string): Promise<BuildDebugApkResult> {
  const { gradlewPath } = await ensureGradleWrapper(projectDir);

  try {
    await execFileAsync(gradlewPath, ["assembleDebug"], {
      cwd: projectDir,
      maxBuffer: 1024 * 1024 * 64,
      shell: process.platform === "win32"
    });
  } catch (error) {
    throw new HoneyPieError(
      `Gradle build failed for ${projectDir}:\n${tail(errorOutput(error))}`,
      "BUILDER_GRADLE_BUILD_FAILED",
      { projectDir }
    );
  }

  const apkPath = await findDebugApk(projectDir);
  const packageName = await findApplicationId(projectDir);
  const mainActivity = await findMainActivity(projectDir, packageName);

  return { apkPath, packageName, mainActivity };
}

async function findDebugApk(projectDir: string): Promise<string> {
  const outputsDir = join(projectDir, "app", "build", "outputs", "apk", "debug");
  let entries: string[];
  try {
    entries = await readdir(outputsDir);
  } catch {
    throw new HoneyPieError(
      `Gradle reported success but no APK output directory was found at ${outputsDir}`,
      "BUILDER_APK_NOT_FOUND",
      { outputsDir }
    );
  }
  const apk = entries.find((name) => name.endsWith(".apk"));
  if (!apk) {
    throw new HoneyPieError(`No .apk file found in ${outputsDir}`, "BUILDER_APK_NOT_FOUND", { outputsDir });
  }
  return join(outputsDir, apk);
}

async function findApplicationId(projectDir: string): Promise<string> {
  const buildGradlePath = join(projectDir, "app", "build.gradle.kts");
  const source = await readFile(buildGradlePath, "utf8");
  const match = /applicationId\s*=\s*"([^"]+)"/.exec(source);
  if (!match) {
    throw new HoneyPieError(`Could not find applicationId in ${buildGradlePath}`, "BUILDER_MANIFEST_PARSE_FAILED", {
      buildGradlePath
    });
  }
  return match[1] ?? "";
}

async function findMainActivity(projectDir: string, packageName: string): Promise<string> {
  const manifestPath = join(projectDir, "app", "src", "main", "AndroidManifest.xml");
  const xml = await readFile(manifestPath, "utf8");
  const activityBlocks = xml.match(/<activity\b[\s\S]*?(?:\/>|<\/activity>)/g) ?? [];
  const launcher = activityBlocks.find(
    (block) => /android:name="android.intent.action.MAIN"/.test(block) && /android:name="android.intent.category.LAUNCHER"/.test(block)
  );
  const target = launcher ?? activityBlocks[0];
  if (!target) {
    throw new HoneyPieError(`No <activity> found in ${manifestPath}`, "BUILDER_MANIFEST_PARSE_FAILED", { manifestPath });
  }
  const nameMatch = /android:name="([^"]+)"/.exec(target);
  const name = nameMatch?.[1] ?? "";
  if (!name) {
    throw new HoneyPieError(`Could not parse activity android:name in ${manifestPath}`, "BUILDER_MANIFEST_PARSE_FAILED", {
      manifestPath
    });
  }
  return name.startsWith(".") ? `${packageName}${name}` : name;
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
