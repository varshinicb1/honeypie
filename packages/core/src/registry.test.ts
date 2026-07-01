import { describe, expect, test } from "vitest";
import { PluginRegistry, PluginCompatibilityError } from "./index.js";

describe("PluginRegistry", () => {
  test("registers compatible plugins and resolves by type in priority order", () => {
    const registry = new PluginRegistry({ sdkVersion: "1.0.0" });
    registry.registerManifest({ id: "a", type: "FrameworkDetector", version: "1.0.0", sdkVersion: "^1.0.0", entry: "./a.js" }, { id: "a", priority: 1 });
    registry.registerManifest({ id: "b", type: "FrameworkDetector", version: "1.0.0", sdkVersion: "^1.0.0", entry: "./b.js" }, { id: "b", priority: 10 });

    expect(registry.resolve("FrameworkDetector").map((plugin) => plugin.id)).toEqual(["b", "a"]);
  });

  test("rejects incompatible sdk versions with typed error", () => {
    const registry = new PluginRegistry({ sdkVersion: "1.0.0" });

    expect(() =>
      registry.registerManifest({ id: "old", type: "VisionScorer", version: "1.0.0", sdkVersion: "^2.0.0", entry: "./old.js" }, { id: "old" })
    ).toThrow(PluginCompatibilityError);
  });
});
