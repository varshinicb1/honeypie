import type { SelectedScreenshot, RenderedAsset, AssetDimension } from "@honeypie/plugin-sdk";

/**
 * Greedily selects top-scoring, screen-type-diverse screenshots to satisfy
 * the required dimensions and bounds.
 */
export function selectScreenshots(
  screenshots: SelectedScreenshot[],
  dimensions: AssetDimension
): SelectedScreenshot[] {
  // Filter out rejected ones first
  const active = screenshots.filter((s) => !s.score.rejected);

  // Sort by score descending
  active.sort((a, b) => b.score.score - a.score.score);

  // Try to pick diverse screen types/labels to avoid showing the same screen repeatedly
  const selected: SelectedScreenshot[] = [];
  const selectedLabels = new Set<string>();

  for (const shot of active) {
    if (selected.length >= dimensions.maxCount) break;

    const label = shot.sourceNodeId || "unknown";
    if (!selectedLabels.has(label)) {
      selected.push(shot);
      selectedLabels.add(label);
    }
  }

  // If we still need more to meet the minCount, fill with remaining high-scoring ones
  if (selected.length < dimensions.minCount) {
    for (const shot of active) {
      if (selected.length >= dimensions.maxCount) break;
      if (!selected.some((s) => s.id === shot.id)) {
        selected.push(shot);
      }
    }
  }

  return selected;
}
