import { describe, test, expect } from "vitest";
import { runVisionPipeline } from "./index.js";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

describe("Vision pipeline tests", () => {
  test("deduplicates identical images and scores unique ones", async () => {
    const dir = await mkdtemp(join(tmpdir(), "honeypie-vision-test-"));
    const path1 = join(dir, "shot1.png");
    const path2 = join(dir, "shot2.png");

    const pngBuffer = Buffer.from(TINY_PNG_BASE64, "base64");
    await writeFile(path1, pngBuffer);
    await writeFile(path2, pngBuffer);

    const result = await runVisionPipeline({
      screenshots: [
        { id: "shot1", path: path1, sourceNodeId: "node1" },
        { id: "shot2", path: path2, sourceNodeId: "node2" }
      ],
      forceInclude: ["shot1"]
    });

    // One should be selected, one rejected as duplicate
    expect(result.selected.length).toBe(1);
    expect(result.rejected.length).toBe(1);
    expect(result.rejected[0]!.reason).toBe("duplicate");

    await rm(dir, { recursive: true, force: true });
  });
});
