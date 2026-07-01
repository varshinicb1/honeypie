import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { buildDebugApk } from "./build-apk.js";

const demoProjectDir = join(process.cwd(), "..", "..", "examples", "android-compose-demo");

describe("buildDebugApk", () => {
  it("builds the compose demo and reports package/activity metadata", async () => {
    if (!existsSync(join(demoProjectDir, "app", "build.gradle.kts"))) {
      console.warn("skipping: examples/android-compose-demo not found relative to package");
      return;
    }
    const result = await buildDebugApk(demoProjectDir);
    expect(existsSync(result.apkPath)).toBe(true);
    expect(result.packageName).toBe("dev.honeypie.compose.demo");
    expect(result.mainActivity).toBe("dev.honeypie.compose.demo.MainActivity");
  }, 180_000);
});
