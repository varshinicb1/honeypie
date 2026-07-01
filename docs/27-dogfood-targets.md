# 27 — Dogfood Targets

HoneyPie should be tested against real mobile repositories in addition to maintained fixtures. Do not commit cloned third-party repositories into this repo; keep them under `.honeypie/test-projects/` or another ignored local path.

## Current Targets

| Repository | Type | Current Result |
|---|---|---|
| `varshinicb1/Parakram-edge` | Native Android / Gradle / Compose-style Kotlin UI | `honeypie run --yes --local-only --dest dist-honeypie` produces a local-only manifest, offline report, README mockup SVG, and guarded README update with the current Phase 1 synthetic exploration path. Real emulator exploration is blocked until ADB/emulator tooling is available locally. |
| `varshinicb1/craft_app` | Flutter | Root run detects `pubspec.yaml`, writes `dist-honeypie/readme/hero.svg`, and inserts the guarded README preview block. |
| `varshinicb1/pcb-operations` | Nested Flutter app under `pcb_operations/` | Root run detects nested `pubspec.yaml`, creates root `README.md` when absent, writes `dist-honeypie/readme/hero.svg`, and inserts the guarded README preview block. |
| `varshinicb1/coka-token` | Nested Flutter app under `app/coka_billing/` | Root run detects nested `pubspec.yaml`, writes `dist-honeypie/readme/hero.svg`, and inserts or refreshes the guarded README preview block. |

## Reproduction

```bash
mkdir -p .honeypie/test-projects
git clone https://github.com/varshinicb1/Parakram-edge.git .honeypie/test-projects/Parakram-edge
pnpm build
cd .honeypie/test-projects/Parakram-edge
node ../../../packages/cli/dist/bin.js run --yes --local-only --dest dist-honeypie
```

Run `node packages/cli/dist/bin.js doctor` from the HoneyPie repo root before attempting full emulator exploration.
