import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type PipelineStageName = "builder" | "explorer" | "vision" | "copywriter" | "renderer" | "publisher" | string;

export interface PipelineContext {
  [stage: string]: unknown;
}

export interface PipelineStage<TArtifact = unknown> {
  name: PipelineStageName;
  run(ctx: PipelineContext): Promise<TArtifact>;
}

export interface CheckpointRecord {
  stage: PipelineStageName;
  artifact: unknown;
  writtenAt: string;
  path: string;
}

export interface PipelineRunResult {
  context: PipelineContext;
  checkpoints: CheckpointRecord[];
}

export interface PipelineOrchestratorOptions {
  projectRoot: string;
  stages: PipelineStage[];
}

export class PipelineOrchestrator {
  constructor(private readonly options: PipelineOrchestratorOptions) {}

  async run(): Promise<PipelineRunResult> {
    const context: PipelineContext = {};
    const checkpoints: CheckpointRecord[] = [];
    for (const stage of this.options.stages) {
      const artifact = await stage.run(context);
      context[stage.name] = artifact;
      checkpoints.push(await this.writeCheckpoint(stage.name, artifact));
    }
    return { context, checkpoints };
  }

  private async writeCheckpoint(stage: PipelineStageName, artifact: unknown): Promise<CheckpointRecord> {
    const dir = join(this.options.projectRoot, ".honeypie", "cache", stage);
    await mkdir(dir, { recursive: true });
    const path = join(dir, "checkpoint.json");
    const record: CheckpointRecord = {
      stage,
      artifact,
      writtenAt: new Date().toISOString(),
      path
    };
    await writeFile(path, `${JSON.stringify(record, null, 2)}\n`);
    return record;
  }
}
