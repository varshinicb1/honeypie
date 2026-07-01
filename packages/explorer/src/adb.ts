import { existsSync } from "node:fs";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { HoneyPieError } from "@honeypie/core";

const execFileAsync = promisify(execFile);

function deviceArgs(deviceId?: string): string[] {
  return deviceId ? ["-s", deviceId] : [];
}

function resolveAdbPath(): string {
  const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (sdkRoot) {
    const candidate = join(sdkRoot, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");
    if (existsSync(candidate)) return candidate;
  }
  return "adb";
}

async function runAdb(args: string[], opts: { encoding?: "utf8" | "buffer" } = {}): Promise<{ stdout: string | Buffer; stderr: string }> {
  try {
    const result = await execFileAsync(resolveAdbPath(), args, {
      encoding: opts.encoding === "buffer" ? "buffer" : "utf8",
      maxBuffer: 1024 * 1024 * 64
    });
    return result as { stdout: string | Buffer; stderr: string };
  } catch (error) {
    const record = error as { stdout?: string | Buffer; stderr?: string; message?: string };
    throw new HoneyPieError(
      `adb ${args.join(" ")} failed: ${record.stderr || record.message || String(error)}`,
      "EXPLORER_ADB_FAILED",
      { args }
    );
  }
}

export async function listDevices(): Promise<string[]> {
  const { stdout } = await runAdb(["devices"]);
  return (stdout as string)
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.endsWith("device"))
    .map((line) => line.split(/\s+/)[0] ?? "")
    .filter(Boolean);
}

export async function installApk(apkPath: string, deviceId?: string): Promise<void> {
  await runAdb([...deviceArgs(deviceId), "install", "-r", apkPath]);
}

export async function launchApp(packageName: string, mainActivity: string, deviceId?: string): Promise<void> {
  await runAdb([...deviceArgs(deviceId), "shell", "am", "start", "-n", `${packageName}/${mainActivity}`]);
}

export async function isProcessRunning(packageName: string, deviceId?: string): Promise<boolean> {
  // `pidof` exits non-zero when no matching process is found — that's a normal "not running"
  // result, not an adb failure, so it's handled here rather than via the generic runAdb throw.
  try {
    const { stdout } = await execFileAsync(resolveAdbPath(), [...deviceArgs(deviceId), "shell", "pidof", packageName], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024
    });
    return stdout.trim().length > 0;
  } catch (error) {
    const record = error as { code?: number; stdout?: string };
    if (typeof record.code === "number" && record.stdout !== undefined) return false;
    throw new HoneyPieError(`adb shell pidof ${packageName} failed unexpectedly`, "EXPLORER_ADB_FAILED", { packageName });
  }
}

export async function dumpUiXml(deviceId?: string): Promise<string> {
  const remotePath = "/sdcard/honeypie-ui-dump.xml";
  await runAdb([...deviceArgs(deviceId), "shell", "uiautomator", "dump", remotePath]);
  const { stdout } = await runAdb([...deviceArgs(deviceId), "shell", "cat", remotePath]);
  return stdout as string;
}

export async function screencap(deviceId?: string): Promise<Buffer> {
  const { stdout } = await runAdb([...deviceArgs(deviceId), "exec-out", "screencap", "-p"], { encoding: "buffer" });
  return stdout as Buffer;
}

export async function tap(x: number, y: number, deviceId?: string): Promise<void> {
  await runAdb([...deviceArgs(deviceId), "shell", "input", "tap", String(Math.round(x)), String(Math.round(y))]);
}

export async function pressBack(deviceId?: string): Promise<void> {
  await runAdb([...deviceArgs(deviceId), "shell", "input", "keyevent", "KEYCODE_BACK"]);
}
