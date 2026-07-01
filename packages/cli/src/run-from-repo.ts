import { join } from "node:path";
import { runLocalOnlyPipeline, type ConfigCliOverrides, type HoneyPieManifest } from "@honeypie/core";
import { runAndroidNativePipeline } from "./android-native-pipeline.js";
import { cloneRepo, detectFramework } from "./repo-source.js";

export interface RunFromRepoOptions {
  url: string;
  cliOverrides?: ConfigCliOverrides;
  maxNodes?: number;
  maxDurationMs?: number;
}

export interface RunFromRepoResult {
  manifest: HoneyPieManifest;
  destination: string;
  projectDir: string;
  framework: "android-native" | "local-only";
}

/** Clone a repo by URL, auto-detect its framework, and run the appropriate real pipeline. */
export async function runFromRepo(options: RunFromRepoOptions): Promise<RunFromRepoResult> {
  const { projectDir } = await cloneRepo({ url: options.url });
  const detected = detectFramework(projectDir);
  const destinationName = options.cliOverrides?.destination ?? "dist";

  if (detected === "android-native") {
    const result = await runAndroidNativePipeline({
      projectRoot: projectDir,
      destination: join(projectDir, destinationName),
      ...(options.maxNodes !== undefined ? { maxNodes: options.maxNodes } : {}),
      ...(options.maxDurationMs !== undefined ? { maxDurationMs: options.maxDurationMs } : {})
    });
    return { ...result, projectDir, framework: "android-native" };
  }

  const result = await runLocalOnlyPipeline({
    projectRoot: projectDir,
    ...(options.cliOverrides !== undefined ? { cliOverrides: options.cliOverrides } : {})
  });
  return { ...result, projectDir, framework: "local-only" };
}
