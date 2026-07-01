import { describe, expect, test } from "vitest";
import type { FrameworkDetector, PluginManifest } from "./index.js";

describe("plugin-sdk public surface", () => {
  test("models first-party and third-party plugin manifests", () => {
    const manifest: PluginManifest = {
      id: "detector-flutter",
      type: "FrameworkDetector",
      version: "1.0.0",
      sdkVersion: "^1.0.0",
      entry: "./dist/index.js"
    };
    const detector: FrameworkDetector = {
      id: manifest.id,
      priority: 100,
      detect: async () => null
    };

    expect(manifest.type).toBe("FrameworkDetector");
    expect(detector.priority).toBe(100);
  });
});
