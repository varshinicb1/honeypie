import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listDevices } from "@honeypie/explorer";
import { runAndroidNativePipeline } from "./android-native-pipeline.js";

const demoProjectDir = join(process.cwd(), "..", "..", "examples", "android-compose-demo");

describe("runAndroidNativePipeline", () => {
  let destination: string | undefined;

  afterEach(async () => {
    if (destination) await rm(destination, { recursive: true, force: true });
    destination = undefined;
  });

  it("builds, installs, explores, captures, and publishes real screenshots end-to-end", async () => {
    const devices = await listDevices();
    if (devices.length === 0) {
      console.warn("skipping: no adb device/emulator attached in this environment");
      return;
    }
    if (!existsSync(join(demoProjectDir, "app", "build.gradle.kts"))) {
      console.warn("skipping: examples/android-compose-demo not found relative to package");
      return;
    }

    destination = await mkdtemp(join(tmpdir(), "honeypie-dist-"));

    const result = await runAndroidNativePipeline({
      projectRoot: demoProjectDir,
      destination,
      maxNodes: 3,
      maxDurationMs: 45_000
    });

    expect(result.manifest.exploration.screensDiscovered).toBeGreaterThanOrEqual(1);
    expect(existsSync(join(destination, "honeypie.json"))).toBe(true);
    expect(existsSync(join(destination, "screenshots", "screen-0.png"))).toBe(true);
    expect(existsSync(join(destination, "mockups", "screen-0.svg"))).toBe(true);
    expect(result.manifest.assets.length).toBeGreaterThanOrEqual(2);
  }, 120_000);
});
