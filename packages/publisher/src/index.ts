import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { HoneyPieManifest } from "@honeypie/core";
import { renderDeviceFrameSvg } from "@honeypie/renderer";
import { updateReadme } from "./readme.js";

export { updateReadme, type UpdateReadmeOptions } from "./readme.js";

export interface PublishNode {
  id: string;
  capturePaths: string[];
}

export interface PublishDistOptions {
  destination: string;
  app: HoneyPieManifest["app"];
  nodes: PublishNode[];
  exploration: { screensDiscovered: number; durationMs: number };
  aiUsage: HoneyPieManifest["aiUsage"];
}

export async function publishDist(options: PublishDistOptions): Promise<HoneyPieManifest> {
  const { destination } = options;
  await mkdir(join(destination, "screenshots"), { recursive: true });
  await mkdir(join(destination, "mockups"), { recursive: true });
  await mkdir(join(destination, "metadata"), { recursive: true });

  const assets: HoneyPieManifest["assets"] = [];

  for (const node of options.nodes) {
    const sourcePng = node.capturePaths[0];
    if (!sourcePng) continue;
    const screenshotRelPath = `screenshots/${node.id}.png`;
    await copyFile(sourcePng, join(destination, screenshotRelPath));
    assets.push({ path: screenshotRelPath, sourceScreen: node.id, target: "screenshots" });

    const png = await readFile(sourcePng);
    const svg = renderDeviceFrameSvg({ screenshotPng: png, appName: options.app.appName });
    const mockupRelPath = `mockups/${node.id}.svg`;
    await writeFile(join(destination, mockupRelPath), svg);
    assets.push({ path: mockupRelPath, sourceScreen: node.id, target: "mockups", theme: "device-frame" });
  }

  const firstMockup = assets.find((asset) => asset.target === "mockups");

  await writeFile(
    join(destination, "metadata", "store-listing.json"),
    `${JSON.stringify(
      {
        headline: options.app.appName,
        subtitle: `${options.nodes.length} screen${options.nodes.length === 1 ? "" : "s"} captured`
      },
      null,
      2
    )}\n`
  );

  const manifest: HoneyPieManifest = {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    app: options.app,
    exploration: options.exploration,
    vision: {
      captured: options.nodes.length,
      selected: options.nodes.length,
      rejected: 0
    },
    aiUsage: options.aiUsage,
    assets,
    errors: []
  };

  await writeFile(join(destination, "honeypie.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(destination, "report.html"), renderReport(manifest));

  if (firstMockup) {
    await updateReadme({
      projectRoot: join(destination, ".."),
      appName: options.app.appName,
      destinationName: basename(destination),
      assetPath: firstMockup.path
    });
  }

  return manifest;
}

function renderReport(manifest: HoneyPieManifest): string {
  const screenshotItems = manifest.assets
    .filter((asset) => asset.target === "screenshots")
    .map((asset) => `<li><img src="${escapeHtml(asset.path)}" alt="${escapeHtml(asset.sourceScreen)}" width="240" /></li>`)
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>HoneyPie Report - ${escapeHtml(manifest.app.appName)}</title>
<style>body{font-family:system-ui,sans-serif;margin:2rem;line-height:1.5}code{background:#f3f4f6;padding:.15rem .3rem}ul{display:flex;gap:1rem;flex-wrap:wrap;list-style:none;padding:0}</style>
</head>
<body>
<h1>${escapeHtml(manifest.app.appName)}</h1>
<p>Framework: <code>${escapeHtml(manifest.app.framework)}</code></p>
<p>Screens discovered: ${manifest.exploration.screensDiscovered}</p>
<p>Selected screenshots: ${manifest.vision.selected}</p>
<ul>
${screenshotItems}
</ul>
</body>
</html>
`;
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
