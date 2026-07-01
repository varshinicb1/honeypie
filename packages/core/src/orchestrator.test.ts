import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import { PipelineOrchestrator, type PipelineStage } from "./index.js";

let tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs = [];
});

async function tempProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "honeypie-orchestrator-"));
  tempDirs.push(dir);
  return dir;
}

describe("PipelineOrchestrator", () => {
  test("runs stages in order and writes checkpoint artifacts", async () => {
    const projectRoot = await tempProject();
    const stages: PipelineStage[] = [
      { name: "builder", run: async () => ({ app: { framework: "flutter", packageName: "dev.honeypie.fixture", appName: "Fixture" } }) },
      { name: "explorer", run: async (ctx) => ({ graph: { nodes: [{ id: "home" }], app: ctx.builder.app } }) }
    ];
    const orchestrator = new PipelineOrchestrator({ projectRoot, stages });

    const result = await orchestrator.run();

    expect(result.checkpoints.map((checkpoint) => checkpoint.stage)).toEqual(["builder", "explorer"]);
    const checkpoint = JSON.parse(await readFile(join(projectRoot, ".honeypie", "cache", "explorer", "checkpoint.json"), "utf8"));
    expect(checkpoint.artifact.graph.nodes[0].id).toBe("home");
  });
});
