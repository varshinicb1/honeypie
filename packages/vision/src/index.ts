import { readFileSync } from "node:fs";
import { extname } from "node:path";
import type { Screenshot, ScreenContext, SelectedScreenshot, ScoreResult } from "@honeypie/plugin-sdk";
import { computeAverageHash, hammingDistance } from "./dedup.js";
import { filterScreenshot } from "./filter.js";
import { LocalVisionScorer } from "./scorer.js";
import { selectScreenshots } from "./selector.js";

export { computeAverageHash, hammingDistance } from "./dedup.js";
export { filterScreenshot } from "./filter.js";
export { LocalVisionScorer } from "./scorer.js";
export { selectScreenshots } from "./selector.js";

export interface RunVisionPipelineOptions {
  screenshots: Array<{ id: string; path: string; sourceNodeId: string }>;
  forceInclude?: string[];
  forceExclude?: string[];
}

export interface VisionResult {
  selected: SelectedScreenshot[];
  rejected: Array<{ id: string; path: string; reason: string }>;
}

export async function runVisionPipeline(options: RunVisionPipelineOptions): Promise<VisionResult> {
  const selected: SelectedScreenshot[] = [];
  const rejected: Array<{ id: string; path: string; reason: string }> = [];
  
  // 1. Deduplicate by perceptual hash
  const uniqueShots: Array<{ id: string; path: string; sourceNodeId: string; pHash: string }> = [];
  
  for (const shot of options.screenshots) {
    try {
      const buffer = readFileSync(shot.path);
      const pHash = computeAverageHash(buffer);
      
      // Check if we already have a similar screenshot (Hamming distance < 5)
      const isDuplicate = uniqueShots.some(u => hammingDistance(u.pHash, pHash) < 5);
      if (isDuplicate && !options.forceInclude?.includes(shot.id)) {
        rejected.push({ id: shot.id, path: shot.path, reason: "duplicate" });
      } else {
        uniqueShots.push({ ...shot, pHash });
      }
    } catch {
      rejected.push({ id: shot.id, path: shot.path, reason: "file-unreadable" });
    }
  }

  // 2. Filter & score remaining
  const scorer = new LocalVisionScorer();

  for (const shot of uniqueShots) {
    if (options.forceExclude?.includes(shot.id)) {
      rejected.push({ id: shot.id, path: shot.path, reason: "force-excluded" });
      continue;
    }

    const filterResult = await filterScreenshot(shot.path);
    if (filterResult.rejected && !options.forceInclude?.includes(shot.id)) {
      rejected.push({ id: shot.id, path: shot.path, reason: filterResult.rejectionReason || "filtered" });
      continue;
    }

    // Mock dimensions for raw screenshots
    const screenshotObj: Screenshot = {
      id: shot.id,
      path: shot.path,
      width: 1080,
      height: 1920
    };

    const ctx: ScreenContext = {
      node: {
        id: shot.sourceNodeId,
        label: shot.id,
        screenType: "unknown",
        fingerprint: shot.pHash,
        capturePaths: [shot.path]
      }
    };

    const scoreResult = await scorer.score(screenshotObj, ctx);

    selected.push({
      ...screenshotObj,
      sourceNodeId: shot.sourceNodeId,
      score: scoreResult
    });
  }

  return {
    selected,
    rejected
  };
}
