import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface DeviceInfo {
  id: string;
  status: "device" | "offline" | "unauthorized" | string;
}

export interface DeviceManagerOptions {
  adbPath?: string;
}

/**
 * Manages Android device/emulator lifecycle via ADB.
 */
export class DeviceManager {
  private readonly adb: string;

  constructor(options: DeviceManagerOptions = {}) {
    this.adb = options.adbPath ?? resolveAdb() ?? "adb";
  }

  /** List connected devices/emulators. */
  listDevices(): DeviceInfo[] {
    const result = spawnSync(this.adb, ["devices"], {
      encoding: "utf8",
      timeout: 10_000,
    });
    if (result.status !== 0) return [];

    return result.stdout
      .split(/\r?\n/)
      .slice(1) // skip "List of devices attached" header
      .map((line) => {
        const match = /^(\S+)\s+(\S+)$/.exec(line.trim());
        if (!match) return null;
        return { id: match[1]!, status: match[2]! } as DeviceInfo;
      })
      .filter((d): d is DeviceInfo => d !== null);
  }

  /** Get first online device, or null. */
  getDevice(): DeviceInfo | null {
    return this.listDevices().find((d) => d.status === "device") ?? null;
  }

  /** Install an APK onto a device. */
  installApk(deviceId: string, apkPath: string): boolean {
    const result = spawnSync(this.adb, ["-s", deviceId, "install", "-r", apkPath], {
      encoding: "utf8",
      timeout: 60_000,
    });
    return result.status === 0;
  }

  /** Launch an app by package name / activity. */
  launchApp(deviceId: string, packageName: string, activity?: string): boolean {
    const component = activity
      ? `${packageName}/${activity}`
      : `${packageName}/.MainActivity`;
    const result = spawnSync(
      this.adb,
      ["-s", deviceId, "shell", "am", "start", "-n", component],
      { encoding: "utf8", timeout: 15_000 }
    );
    return result.status === 0;
  }

  /** Capture a PNG screenshot from a device. Returns the local save path, or null. */
  async captureScreenshot(deviceId: string, savePath: string): Promise<string | null> {
    const result = spawnSync(
      this.adb,
      ["-s", deviceId, "exec-out", "screencap", "-p"],
      { encoding: "buffer", timeout: 15_000, maxBuffer: 20 * 1024 * 1024 }
    );

    if (result.status !== 0 || !Buffer.isBuffer(result.stdout) || !isPng(result.stdout)) {
      return null;
    }

    const dir = join(savePath, "..");
    await mkdir(dir, { recursive: true });
    await writeFile(savePath, result.stdout);
    return savePath;
  }

  /** Dump the UI Automator accessibility tree XML. */
  dumpUiAutomator(deviceId: string): string | null {
    // Dump to device-local path
    const dumpResult = spawnSync(
      this.adb,
      ["-s", deviceId, "shell", "uiautomator", "dump", "/sdcard/window_dump.xml"],
      { encoding: "utf8", timeout: 15_000 }
    );
    if (dumpResult.status !== 0) return null;

    // Pull the XML content
    const pullResult = spawnSync(
      this.adb,
      ["-s", deviceId, "shell", "cat", "/sdcard/window_dump.xml"],
      { encoding: "utf8", timeout: 10_000 }
    );
    if (pullResult.status !== 0) return null;

    return pullResult.stdout;
  }

  /** Send a tap event at screen coordinates. */
  tap(deviceId: string, x: number, y: number): boolean {
    const result = spawnSync(
      this.adb,
      ["-s", deviceId, "shell", "input", "tap", String(Math.round(x)), String(Math.round(y))],
      { encoding: "utf8", timeout: 5_000 }
    );
    return result.status === 0;
  }

  /** Press the back button. */
  pressBack(deviceId: string): boolean {
    const result = spawnSync(
      this.adb,
      ["-s", deviceId, "shell", "input", "keyevent", "KEYCODE_BACK"],
      { encoding: "utf8", timeout: 5_000 }
    );
    return result.status === 0;
  }

  /** Type text into the currently focused field. */
  typeText(deviceId: string, text: string): boolean {
    // Escape spaces for adb shell input text
    const escaped = text.replace(/ /g, "%s");
    const result = spawnSync(
      this.adb,
      ["-s", deviceId, "shell", "input", "text", escaped],
      { encoding: "utf8", timeout: 5_000 }
    );
    return result.status === 0;
  }

  /** Wait for a device to be fully booted. */
  waitForBoot(deviceId: string, timeoutMs: number = 60_000): boolean {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const result = spawnSync(
        this.adb,
        ["-s", deviceId, "shell", "getprop", "sys.boot_completed"],
        { encoding: "utf8", timeout: 5_000 }
      );
      if (result.stdout?.trim() === "1") return true;
      spawnSync("timeout", ["/t", "2"], { shell: true, timeout: 3_000 });
    }
    return false;
  }

  /** Check if ADB is available at all. */
  isAvailable(): boolean {
    try {
      const result = spawnSync(this.adb, ["version"], {
        encoding: "utf8",
        timeout: 5_000,
      });
      return result.status === 0;
    } catch {
      return false;
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function resolveAdb(): string | null {
  const executable = process.platform === "win32" ? "adb.exe" : "adb";
  const sdkRoots = [process.env["ANDROID_HOME"], process.env["ANDROID_SDK_ROOT"]].filter(
    (v): v is string => Boolean(v)
  );

  for (const root of sdkRoots) {
    const candidate = join(root, "platform-tools", executable);
    if (existsSync(candidate)) return candidate;
  }

  // Fall back to PATH
  try {
    const result = spawnSync("adb", ["version"], {
      encoding: "utf8",
      shell: process.platform === "win32",
      timeout: 5_000,
    });
    if (result.status === 0) return "adb";
  } catch {
    // not on PATH
  }

  return null;
}

function isPng(bytes: Buffer): boolean {
  return (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}
