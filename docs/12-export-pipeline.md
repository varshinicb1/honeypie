# 12 — Export Pipeline

## Purpose

Assemble every stage's output into the final `dist/` directory: correctly named, correctly sized, per-target files, plus the manifest and HTML report.

## Final Output Structure

```
dist/
├── screenshots/         # raw selected screenshots, unframed
├── mockups/              # framed device mockups, per theme
│   ├── clean/
│   ├── premium/
│   ├── glass/
│   ├── dark/
│   ├── light/
│   ├── minimal/
│   └── material/
├── playstore/
│   ├── phone/
│   ├── tablet-7in/
│   ├── tablet-10in/
│   ├── feature-graphic.png
│   └── icon-512.png
├── appstore/
│   ├── iphone-6.7/
│   ├── iphone-6.5/
│   ├── ipad-12.9/
│   └── app-icon-1024.png
├── website/
│   ├── hero.png
│   ├── hero@2x.png
│   └── og-image.png
├── readme/
│   ├── hero.png
│   ├── screenshot-grid.png
│   └── feature-01.png ... feature-0N.png
├── social/
│   ├── twitter-card.png
│   ├── linkedin-post.png
│   ├── product-hunt-gallery-01.png ... 0N.png
│   └── instagram-post.png
├── press-kit/
│   └── press-kit.zip
├── metadata/
│   ├── store-listing.json    # headline, subtitle, descriptions per platform
│   ├── keywords.json
│   └── copy.md                # human-readable copy dump
├── report.html
└── honeypie.json
```

## Manifest — `honeypie.json`

The single source of truth for what was generated, consumed both by `report.html` and by any CI step that wants to programmatically inspect results.

```json
{
  "version": "1.0",
  "generatedAt": "2026-07-01T02:20:00Z",
  "app": { "framework": "flutter", "packageName": "com.vidyuthlabs.myapp", "appName": "MyApp" },
  "exploration": { "screensDiscovered": 37, "durationMs": 214300 },
  "vision": { "captured": 61, "selected": 24, "rejected": 37 },
  "aiUsage": { "provider": "anthropic", "totalTokens": 84210, "estimatedCostUsd": 0.42 },
  "assets": [
    { "path": "playstore/phone/01.png", "sourceScreen": "settings-notifications", "theme": "clean", "target": "playstore" }
  ],
  "errors": []
}
```

## Export Target Contract

Every `ExportTarget` plugin declares required dimensions and file naming and receives already-rendered assets — it does not render pixels itself, it selects/organizes/packages them (separation of concerns from `docs/11-renderer-architecture.md`):

```ts
export interface ExportTarget {
  id: string;
  requiredDimensions: { name: string; width: number; height: number; minCount: number; maxCount: number }[];
  export(assets: RenderedAsset[], ctx: ExportContext): Promise<ExportedBundle>;
}
```

## ZIP Export

`honeypie export --zip` (or automatic if configured) packages the entire `dist/` tree into `dist.zip` alongside it, using streaming compression to avoid double-buffering large asset sets in memory (relevant at scale — see `docs/19-performance-goals.md`).

## Idempotency & Re-Export

Re-running `honeypie run --from renderer` regenerates only affected files, diffing against `honeypie.json`'s prior manifest so unaffected files (e.g., unrelated theme renders) aren't needlessly rewritten — this keeps CI diffs clean when only copy or one theme changes.
