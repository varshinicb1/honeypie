import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * stand-alone capture helper using adb
 */
export async function captureScreenshot(adbPath: string, deviceId: string, destPath: string): Promise<string> {
  const result = spawnSync(adbPath, ["-s", deviceId, "exec-out", "screencap", "-p"], {
    encoding: "buffer",
    timeout: 15_000,
    maxBuffer: 20 * 1024 * 1024
  });

  if (result.status !== 0 || !Buffer.isBuffer(result.stdout) || result.stdout.length < 10) {
    throw new Error(`Failed to capture adb screenshot: exit code ${result.status}, stderr: ${result.stderr?.toString()}`);
  }

  const dir = join(destPath, "..");
  await mkdir(dir, { recursive: true });
  await writeFile(destPath, result.stdout);
  return destPath;
}
