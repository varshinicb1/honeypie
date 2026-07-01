import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { createAIGateway } from "./ai.js";
import type { ConfigCliOverrides } from "./config.js";
import { loadConfig } from "./config.js";
import { ConfigError } from "./errors.js";
import type { HoneyPieManifest } from "./manifest.js";
import { PipelineOrchestrator, type PipelineStage } from "./orchestrator.js";

export interface RunLocalOnlyPipelineOptions {
  projectRoot: string;
  cliOverrides?: ConfigCliOverrides;
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
  const flutterMarker = await findProjectMarker(projectRoot, "pubspec.yaml");
  if (flutterMarker) {
    const name = matchYamlScalar(flutterMarker.content, "name") ?? basename(flutterMarker.dir);
    return {
      app: {
        framework: "flutter",
        packageName: `dev.honeypie.${name.replace(/[^a-zA-Z0-9_]/g, "_")}`,
        appName: titleCase(name)
      }
    };
  }
  const gradleMarker = await findFirstProjectMarker(projectRoot, ["settings.gradle.kts", "settings.gradle"]);
  if (gradleMarker) {
    const name = matchGradleAssignment(gradleMarker.content, "rootProject.name") ?? basename(gradleMarker.dir);
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

interface ProjectMarker {
  dir: string;
  content: string;
}

async function findFirstProjectMarker(projectRoot: string, filenames: string[]): Promise<ProjectMarker | null> {
  for (const filename of filenames) {
    const marker = await findProjectMarker(projectRoot, filename);
    if (marker) return marker;
  }
  return null;
}

async function findProjectMarker(projectRoot: string, filename: string): Promise<ProjectMarker | null> {
  const rootContent = await readTextIfExists(join(projectRoot, filename));
  if (rootContent) return { dir: projectRoot, content: rootContent };
  const candidates = await findNestedFiles(projectRoot, filename, 3);
  const first = candidates[0];
  if (!first) return null;
  return { dir: first.dir, content: await readFile(first.path, "utf8") };
}

async function findNestedFiles(root: string, filename: string, maxDepth: number): Promise<Array<{ dir: string; path: string }>> {
  const ignored = new Set([".git", ".honeypie", "node_modules", "build", "dist", ".dart_tool"]);
  const results: Array<{ dir: string; path: string }> = [];

  async function visit(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isFile() && entry.name === filename) {
        results.push({ dir, path: fullPath });
      }
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || ignored.has(entry.name)) continue;
      await visit(join(dir, entry.name), depth + 1);
    }
  }

  await visit(root, 0);
  return results.sort((a, b) => a.path.localeCompare(b.path));
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
  await mkdir(join(input.destination, "readme"), { recursive: true });
  await mkdir(join(input.destination, "metadata"), { recursive: true });
  const assetPath = "screenshots/home.txt";
  const readmeAssetPath = "readme/hero.svg";
  await writeFile(join(input.destination, assetPath), `${input.app.appName}\nSelected local-only screenshot artifact\n`);
  await writeFile(join(input.destination, readmeAssetPath), renderReadmeHeroSvg(input.app.appName));
  await writeFile(
    join(input.destination, "metadata", "store-listing.json"),
    `${JSON.stringify({ headline: input.app.appName, subtitle: "Generated in local-only mode" }, null, 2)}\n`
  );
  await updateReadme({
    projectRoot: join(input.destination, ".."),
    appName: input.app.appName,
    destinationName: basename(input.destination),
    assetPath: readmeAssetPath
  });
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
    assets: [
      { path: assetPath, sourceScreen: "home", target: "screenshots" },
      { path: readmeAssetPath, sourceScreen: "home", target: "readme", theme: "local-only" }
    ],
    errors: []
  };
  await writeFile(join(input.destination, "honeypie.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(input.destination, "report.html"), renderReport(manifest));
  return manifest;
}

async function updateReadme(input: { projectRoot: string; appName: string; destinationName: string; assetPath: string }): Promise<void> {
  const readmePath = join(input.projectRoot, "README.md");
  const existing = await readTextIfExists(readmePath);
  const base = existing ?? `# ${input.appName}\n`;
  const imagePath = `${input.destinationName}/${input.assetPath}`.replace(/\\/g, "/");
  const block = [
    "<!-- honeypie:start -->",
    "## App Preview",
    "",
    `![${input.appName} app mockup](${imagePath})`,
    "",
    "_Generated by HoneyPie in local-only mode._",
    "<!-- honeypie:end -->"
  ].join("\n");
  const markerPattern = /<!-- honeypie:start -->[\s\S]*?<!-- honeypie:end -->/;
  const next = markerPattern.test(base) ? base.replace(markerPattern, block) : appendReadmeBlock(base, block);
  await writeFile(readmePath, ensureTrailingNewline(next));
}

function appendReadmeBlock(readme: string, block: string): string {
  return `${readme.trimEnd()}\n\n${block}`;
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function renderReadmeHeroSvg(appName: string): string {
  const title = escapeHtml(appName);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" role="img" aria-label="${title} app mockup">
  <rect width="1280" height="720" fill="#101828"/>
  <rect x="470" y="70" width="340" height="580" rx="42" fill="#111827" stroke="#f97316" stroke-width="8"/>
  <rect x="500" y="120" width="280" height="480" rx="24" fill="#fff7ed"/>
  <text x="640" y="270" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="42" font-weight="700" fill="#1f2937">${title}</text>
  <text x="640" y="330" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="24" fill="#4b5563">Generated app preview</text>
  <rect x="550" y="390" width="180" height="52" rx="26" fill="#f97316"/>
  <text x="640" y="424" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700" fill="#ffffff">HoneyPie</text>
</svg>
`;
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

function matchGradleAssignment(source: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*=\\s*["']([^"']+)["']`).exec(source);
  return match?.[1]?.trim() ?? null;
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
