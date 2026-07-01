# 27 — Dogfood Targets

HoneyPie should be tested against real mobile repositories in addition to maintained fixtures. Do not commit cloned third-party repositories into this repo; keep them under `.honeypie/test-projects/` or another ignored local path.

## Current Targets

| Repository | Type | Current Result |
|---|---|---|
| `varshinicb1/Parakram-edge` | Native Android / Gradle / Compose-style Kotlin UI | `honeypie run --yes --local-only --dest dist-honeypie` produces a local-only manifest and offline report with the current Phase 1 synthetic exploration path. Real emulator exploration is blocked until ADB/emulator tooling is available locally. |

## Reproduction

```bash
mkdir -p .honeypie/test-projects
git clone https://github.com/varshinicb1/Parakram-edge.git .honeypie/test-projects/Parakram-edge
pnpm build
cd .honeypie/test-projects/Parakram-edge
node ../../../packages/cli/dist/bin.js run --yes --local-only --dest dist-honeypie
```

Run `node packages/cli/dist/bin.js doctor` from the HoneyPie repo root before attempting full emulator exploration.
