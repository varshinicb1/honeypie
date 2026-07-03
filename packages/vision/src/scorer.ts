import type { Screenshot, ScreenContext, ScoreResult, VisionScorer } from "@honeypie/plugin-sdk";

export class LocalVisionScorer implements VisionScorer {
  readonly id = "local-scorer";

  async score(shot: Screenshot, ctx: ScreenContext): Promise<ScoreResult> {
    // 1. Simple heuristic metrics based on image parameters and content
    // Check dimensions
    const isLandscape = shot.width > shot.height;
    
    // Readability: based on presence of text elements in context if available
    const hasInteractiveElements = ctx?.node?.label && ctx.node.label !== "Launch Screen";
    const readability = hasInteractiveElements ? 80 : 65;

    // Visual quality: local default
    const visualQuality = 75;

    // Clutter: heuristic base
    const clutter = ctx?.node?.label?.length ? Math.min(95, 50 + ctx.node.label.length) : 60;

    // Aesthetic: neutral default
    const aesthetic = 70;

    // Final weighted score (equal weights)
    const score = Math.round((visualQuality + clutter + readability + aesthetic) / 4);

    return {
      score,
      dimensions: {
        visualQuality,
        clutter,
        readability,
        aesthetic
      },
      rejected: false
    };
  }
}
