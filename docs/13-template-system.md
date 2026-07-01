# 13 — Template System

## Purpose

Themes and export-target layouts are data (declarative scene-graph templates), not code, so they're easy to author, review, diff, and extend without touching the renderer.

## Template Anatomy

A theme is a directory:

```
plugins/theme-glass/
├── honeypie-plugin.json
├── template.yaml
├── assets/
│   ├── background-blur.png
│   └── noise-texture.png
└── fonts/
    └── Inter-Bold.ttf
```

`template.yaml` defines parameterized scene graphs per composition type:

```yaml
name: Glass
compositions:
  single-device:
    canvas: { width: 1242, height: 2688 }
    layers:
      - type: image
        src: assets/background-blur.png
      - type: deviceFrame
        model: "{{device.model}}"
        x: "{{layout.deviceX}}"
        y: "{{layout.deviceY}}"
        angle: -4
      - type: screenshot
        src: "{{screenshot.path}}"
        clipTo: deviceFrame
      - type: text
        content: "{{copy.caption}}"
        font: fonts/Inter-Bold.ttf
        size: 60
        color: "#ffffff"
        x: center
        y: 200
  multi-device-hero:
    canvas: { width: 2400, height: 1600 }
    layers:
      - type: image
        src: assets/background-blur.png
      - type: deviceFrame
        model: "{{devices.0.model}}"
        angle: -8
        x: 300
        y: 200
      - type: deviceFrame
        model: "{{devices.1.model}}"
        angle: 0
        x: 900
        y: 100
      - type: deviceFrame
        model: "{{devices.2.model}}"
        angle: 8
        x: 1500
        y: 200
```

## Template Variables

Available bindings injected by the renderer at execution time:

| Variable | Source |
|---|---|
| `{{screenshot.path}}` | Selected screenshot from `vision` stage |
| `{{copy.caption}}`, `{{copy.headline}}` | `copywriter` stage output |
| `{{device.model}}` | Device frame requested by export target |
| `{{brand.primaryColor}}`, `{{brand.font}}` | `honeypie.config.json` brand overrides |
| `{{layout.*}}` | Computed layout values (auto-centering, safe margins) |

## First-Party Themes

| Theme | Aesthetic |
|---|---|
| `clean` | Flat solid background, no shadow tricks, minimal chrome |
| `premium` | Deep gradient, soft device shadow, subtle reflection |
| `glass` | Frosted/blurred background, translucent panels |
| `dark` | Dark background optimized for dark-mode-first apps |
| `light` | Bright, airy, pastel backgrounds |
| `minimal` | Maximum white space, single accent color, no gradients |
| `material` | Material Design 3 color tokens and elevation shadows |

## Custom Themes

Third-party theme plugins follow the identical `template.yaml` contract — see `docs/07-plugin-sdk.md`. `honeypie plugins add honeypie-plugin-theme-neon` makes a new theme immediately selectable in the TUI's output selection screen and CLI `--theme` flag with zero core changes.

## Brand Configuration

`honeypie.config.json`'s `brand` block lets any theme be re-skinned without a new plugin:

```json
{
  "brand": {
    "primaryColor": "#FF6B35",
    "secondaryColor": "#1A1A2E",
    "font": "Inter",
    "logo": "./assets/logo.svg"
  }
}
```
