import { spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { FrameworkKind } from "./detector.js";

export interface BuildResult {
  apkPath: string;
  durationMs: number;
  framework: FrameworkKind;
}

// ─── Flutter build ──────────────────────────────────────────────────────────

export async function buildFlutterApk(
  projectRoot: string,
  options: { timeout?: number } = {}
): Promise<BuildResult> {
  const timeout = options.timeout ?? 300_000; // 5 min default
  const start = Date.now();

  await runCommand("flutter", ["build", "apk", "--debug"], {
    cwd: projectRoot,
    timeout,
  });

  // Find the built APK
  const apkDir = join(projectRoot, "build", "app", "outputs", "flutter-apk");
  const apkPath = join(apkDir, "app-debug.apk");

  try {
    await stat(apkPath);
  } catch {
    throw new Error(`Flutter build completed but APK not found at ${apkPath}`);
  }

  return {
    apkPath,
    durationMs: Date.now() - start,
    framework: "flutter",
  };
}

// ─── Gradle build ───────────────────────────────────────────────────────────

export async function buildGradleApk(
  projectRoot: string,
  options: { timeout?: number } = {}
): Promise<BuildResult> {
  const timeout = options.timeout ?? 300_000;
  const start = Date.now();

  const gradlew = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
  await runCommand(gradlew, ["assembleDebug"], {
    cwd: projectRoot,
    timeout,
    shell: process.platform === "win32",
  });

  // Search for the APK in the build outputs
  const apkPath = await findApk(projectRoot);
  if (!apkPath) {
    throw new Error("Gradle build completed but no debug APK found in build/outputs/");
  }

  return {
    apkPath,
    durationMs: Date.now() - start,
    framework: "android-native",
  };
}

// ─── Auto-build ─────────────────────────────────────────────────────────────

export async function buildProject(
  projectRoot: string,
  framework: FrameworkKind
): Promise<BuildResult> {
  if (framework === "flutter") {
    return buildFlutterApk(projectRoot);
  }
  return buildGradleApk(projectRoot);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function findApk(projectRoot: string): Promise<string | null> {
  const searchDirs = [
    join(projectRoot, "app", "build", "outputs", "apk", "debug"),
    join(projectRoot, "app", "build", "outputs", "apk"),
    join(projectRoot, "build", "outputs", "apk", "debug"),
  ];

  for (const dir of searchDirs) {
    try {
      const entries = await readdir(dir);
      const apk = entries.find((e) => e.endsWith(".apk") && e.includes("debug"));
      if (apk) return join(dir, apk);
    } catch {
      // dir doesn't exist
    }
  }
  return null;
}

function runCommand(
  command: string,
  args: string[],
  options: { cwd: string; timeout: number; shell?: boolean }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: options.cwd,
      shell: options.shell ?? false,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: options.timeout,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("error", (error) => {
      reject(new Error(`Failed to run ${command}: ${error.message}`));
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(
          new Error(
            `${command} ${args.join(" ")} exited with code ${code}\n${stderr || stdout}`
          )
        );
      }
    });
  });
}
