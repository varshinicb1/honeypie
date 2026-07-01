import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cloneRepo, detectFramework } from "./repo-source.js";

describe("cloneRepo", () => {
  it("rejects strings that aren't plausible git URLs", async () => {
    await expect(cloneRepo({ url: "not a url; rm -rf /" })).rejects.toThrow(/doesn't look like a valid git repository URL/);
    await expect(cloneRepo({ url: "/etc/passwd" })).rejects.toThrow(/doesn't look like a valid git repository URL/);
  });
});

describe("detectFramework", () => {
  let scratchDir: string;

  afterEach(async () => {
    await rm(scratchDir, { recursive: true, force: true });
  });

  it("detects android-native via settings.gradle.kts", async () => {
    scratchDir = await mkdtemp(join(tmpdir(), "honeypie-detect-"));
    await import("node:fs/promises").then((fs) => fs.writeFile(join(scratchDir, "settings.gradle.kts"), ""));
    expect(detectFramework(scratchDir)).toBe("android-native");
  });

  it("returns unknown for a directory with no recognized markers", async () => {
    scratchDir = await mkdtemp(join(tmpdir(), "honeypie-detect-"));
    expect(detectFramework(scratchDir)).toBe("unknown");
  });
});
