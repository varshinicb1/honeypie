import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { dumpUiXml, pressBack, screencap, tap } from "./adb.js";

export interface ScreenNode {
  id: string;
  fingerprint: string;
  capturePaths: string[];
}

export interface ScreenEdge {
  from: string;
  to: string;
  action: string;
}

export interface ExplorationStats {
  nodesDiscovered: number;
  edgesTraversed: number;
  durationMs: number;
  budgetExhausted: boolean;
}

export interface ExplorationResult {
  nodes: ScreenNode[];
  edges: ScreenEdge[];
  stats: ExplorationStats;
}

export interface ExploreScreensOptions {
  deviceId?: string;
  maxNodes: number;
  maxDurationMs: number;
  cacheDir: string;
}

interface TappableElement {
  x: number;
  y: number;
  key: string;
}

/**
 * Fingerprints a ui-automator XML dump by stripping volatile `bounds="..."` attributes
 * (screen coordinates), so the fingerprint reflects screen *structure* rather than pixel
 * layout, then hashing the remaining resource-id/text/class content.
 */
export function fingerprintUiXml(xml: string): string {
  const normalized = xml.replace(/\sbounds="\[[^\]]*\]\[[^\]]*\]"/g, "");
  return createHash("sha1").update(normalized).digest("hex");
}

function parseTappableElements(xml: string): TappableElement[] {
  const nodeRegex = /<node\b[^>]*\/>/g;
  const elements: TappableElement[] = [];
  for (const match of xml.matchAll(nodeRegex)) {
    const tag = match[0];
    if (!/clickable="true"/.test(tag)) continue;
    const boundsMatch = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(tag);
    if (!boundsMatch) continue;
    const [, x1, y1, x2, y2] = boundsMatch.map(Number) as unknown as [number, number, number, number, number];
    const resourceId = /resource-id="([^"]*)"/.exec(tag)?.[1] ?? "";
    const text = /text="([^"]*)"/.exec(tag)?.[1] ?? "";
    const key = `${resourceId}|${text}`;
    elements.push({ x: (x1 + x2) / 2, y: (y1 + y2) / 2, key });
  }
  return elements;
}

export async function exploreScreens(options: ExploreScreensOptions): Promise<ExplorationResult> {
  const startedAt = Date.now();
  const rawDir = join(options.cacheDir, "raw");
  await mkdir(rawDir, { recursive: true });

  const nodes: ScreenNode[] = [];
  const edges: ScreenEdge[] = [];
  const seenFingerprints = new Set<string>();
  const visitedTapKeys = new Set<string>();
  let budgetExhausted = false;

  let previousNodeId: string | null = null;
  let previousTapKey: string | null = null;

  while (nodes.length < options.maxNodes) {
    if (Date.now() - startedAt >= options.maxDurationMs) {
      budgetExhausted = true;
      break;
    }

    const xml = await dumpUiXml(options.deviceId);
    const fingerprint = fingerprintUiXml(xml);
    const isNewNode = !seenFingerprints.has(fingerprint);

    if (isNewNode) {
      seenFingerprints.add(fingerprint);
      const nodeId = `screen-${nodes.length}`;
      const capturePath = join(rawDir, `${nodeId}.png`);
      const png = await screencap(options.deviceId);
      await writeFile(capturePath, png);
      nodes.push({ id: nodeId, fingerprint, capturePaths: [capturePath] });
      if (previousNodeId && previousTapKey) {
        edges.push({ from: previousNodeId, to: nodeId, action: previousTapKey });
      }
      previousNodeId = nodeId;
    }

    if (nodes.length >= options.maxNodes) {
      budgetExhausted = true;
      break;
    }

    const tappable = parseTappableElements(xml);
    const unvisited = tappable.find((element) => !visitedTapKeys.has(element.key));

    if (!unvisited) {
      // Dead end on this screen: back out and let the next loop iteration re-dump.
      if (previousNodeId === null) break;
      await pressBack(options.deviceId);
      previousTapKey = null;
      continue;
    }

    visitedTapKeys.add(unvisited.key);
    previousTapKey = unvisited.key;
    await tap(unvisited.x, unvisited.y, options.deviceId);
  }

  return {
    nodes,
    edges,
    stats: {
      nodesDiscovered: nodes.length,
      edgesTraversed: edges.length,
      durationMs: Date.now() - startedAt,
      budgetExhausted
    }
  };
}
