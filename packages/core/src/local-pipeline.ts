import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { createAIGateway } from "./ai.js";
import type { ConfigCliOverrides } from "./config.js";
import { loadConfig } from "./config.js";
import { ConfigError } from "./errors.js";
import { PipelineOrchestrator, type PipelineStage } from "./orchestrator.js";

export interface RunLocalOnlyPipelineOptions {
  projectRoot: string;
  cliOverrides?: ConfigCliOverrides;
}

export interface HoneyPieManifest {
  version: "1.0";
  generatedAt: string;
  app: {
    framework: string;
    packageName: string;
    appName: string;
  };
  exploration: {
    screensDiscovered: number;
    durationMs: number;
  };
  vision: {
    captured: number;
    selected: number;
    rejected: number;
  };
  aiUsage: {
    provider: string;
    totalTokens: number;
    estimatedCostUsd: number;
  };
  assets: Array<{
    path: string;
    sourceScreen: string;
    theme?: string;
    target: string;
  }>;
  errors: unknown[];
}

export interface LocalPipelineResult {
  manifest: HoneyPieManifest;
  destination: string;
}

interface BuildArtifact {
  app: HoneyPieManifest["app"];
}

interface ExplorationArtifact {
  graph: {
    nodes: Array<{ id: string; label: string; screenType: string; fingerprint: string; capturePaths: string[] }>;
    edges: Array<{ from: string; to: string; action: string; target: string }>;
    stats: { nodesDiscovered: number; edgesTraversed: number; durationMs: number; budgetExhausted: boolean };
  };
}

interface VisionArtifact {
  selected: Array<{ id: string; path: string; sourceNodeId: string; score: number }>;
  rejected: unknown[];
}

export async function runLocalOnlyPipeline(options: RunLocalOnlyPipelineOptions): Promise<LocalPipelineResult> {
  const config = await loadConfig({
    projectRoot: options.projectRoot,
    cliOverrides: { ...(options.cliOverrides ?? {}), localOnly: true }
  });
  const ai = createAIGateway({ mode: "local", provider: config.ai.provider });
  const destination = join(options.projectRoot, config.destination);
  const stages: PipelineStage[] = [
    {
      name: "builder",
      run: async () => detectProject(options.projectRoot)
    },
    {
      name: "explorer",
      run: async (ctx) => createSyntheticExploration(options.projectRoot, ctx.builder as BuildArtifact)
    },
    {
      name: "vision",
      run: async (ctx) => scoreSyntheticScreens(ctx.explorer as ExplorationArtifact)
    },
    {
      name: "publisher",
      run: async (ctx) =>
        publishMinimalDist({
          destination,
          app: (ctx.builder as BuildArtifact).app,
          exploration: ctx.explorer as ExplorationArtifact,
          vision: ctx.vision as VisionArtifact,
          aiUsage: ai.usage()
        })
    }
  ];
  const run = await new PipelineOrchestrator({ projectRoot: options.projectRoot, stages }).run();
  return {
    manifest: run.context.publisher as HoneyPieManifest,
    destination
  };
}

async function detectProject(projectRoot: string): Promise<BuildArtifact> {
  const pubspec = await readTextIfExists(join(projectRoot, "pubspec.yaml"));
  if (pubspec) {
    const name = matchYamlScalar(pubspec, "name") ?? basename(projectRoot);
    return {
      app: {
        framework: "flutter",
        packageName: `dev.honeypie.${name.replace(/[^a-zA-Z0-9_]/g, "_")}`,
        appName: titleCase(name)
      }
    };
  }
  const gradle = await readTextIfExists(join(projectRoot, "settings.gradle.kts")) ?? await readTextIfExists(join(projectRoot, "settings.gradle"));
  if (gradle) {
    const name = basename(projectRoot);
    return {
      app: {
        framework: "android-native",
        packageName: `dev.honeypie.${name.replace(/[^a-zA-Z0-9_]/g, "_")}`,
        appName: titleCase(name)
      }
    };
  }
  throw new ConfigError("No supported Flutter or Android project markers found", { projectRoot });
}

async function createSyntheticExploration(projectRoot: string, build: BuildArtifact): Promise<ExplorationArtifact> {
  const rawDir = join(projectRoot, ".honeypie", "cache", "raw");
  await mkdir(rawDir, { recursive: true });
  const rawPath = join(rawDir, "home.txt");
  await writeFile(rawPath, `${build.app.appName}\nHome screen\nLocal-only capture placeholder\n`);
  return {
    graph: {
      nodes: [
        {
          id: "home",
          label: "Home",
          screenType: "home",
          fingerprint: `${build.app.framework}:home`,
          capturePaths: [rawPath]
        }
      ],
      edges: [],
      stats: { nodesDiscovered: 1, edgesTraversed: 0, durationMs: 0, budgetExhausted: false }
    }
  };
}

function scoreSyntheticScreens(exploration: ExplorationArtifact): VisionArtifact {
  return {
    selected: exploration.graph.nodes.map((node) => ({
      id: node.id,
      path: node.capturePaths[0] ?? "",
      sourceNodeId: node.id,
      score: 75
    })),
    rejected: []
  };
}

async function publishMinimalDist(input: {
  destination: string;
  app: HoneyPieManifest["app"];
  exploration: ExplorationArtifact;
  vision: VisionArtifact;
  aiUsage: HoneyPieManifest["aiUsage"];
}): Promise<HoneyPieManifest> {
  await mkdir(join(input.destination, "screenshots"), { recursive: true });
  await mkdir(join(input.destination, "metadata"), { recursive: true });
  const assetPath = "screenshots/home.txt";
  await writeFile(join(input.destination, assetPath), `${input.app.appName}\nSelected local-only screenshot artifact\n`);
  await writeFile(
    join(input.destination, "metadata", "store-listing.json"),
    `${JSON.stringify({ headline: input.app.appName, subtitle: "Generated in local-only mode" }, null, 2)}\n`
  );
  const manifest: HoneyPieManifest = {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    app: input.app,
    exploration: {
      screensDiscovered: input.exploration.graph.stats.nodesDiscovered,
      durationMs: input.exploration.graph.stats.durationMs
    },
    vision: {
      captured: input.exploration.graph.nodes.length,
      selected: input.vision.selected.length,
      rejected: input.vision.rejected.length
    },
    aiUsage: input.aiUsage,
    assets: [{ path: assetPath, sourceScreen: "home", target: "screenshots" }],
    errors: []
  };
  await writeFile(join(input.destination, "honeypie.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(input.destination, "report.html"), renderReport(manifest));
  return manifest;
}

function renderReport(manifest: HoneyPieManifest): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>HoneyPie Report - ${escapeHtml(manifest.app.appName)}</title>
<style>body{font-family:system-ui,sans-serif;margin:2rem;line-height:1.5}code{background:#f3f4f6;padding:.15rem .3rem}</style>
</head>
<body>
<h1>${escapeHtml(manifest.app.appName)}</h1>
<p>Framework: <code>${escapeHtml(manifest.app.framework)}</code></p>
<p>Screens discovered: ${manifest.exploration.screensDiscovered}</p>
<p>Selected screenshots: ${manifest.vision.selected}</p>
</body>
</html>
`;
}

async function readTextIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

function matchYamlScalar(source: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^${escaped}:\\s*([^\\r\\n#]+)`, "m").exec(source);
  return match?.[1]?.trim().replace(/^["']|["']$/g, "") ?? null;
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
