# HoneyPie Architecture (Summary)

This file is a short pointer document. The authoritative, detailed architecture lives in `docs/03-architecture.md`, with supporting deep-dives in:

- `docs/04-repository-layout.md` — package/module boundaries
- `docs/07-plugin-sdk.md` — extensibility model
- `docs/08-ai-architecture.md` — AI gateway design
- `docs/09-vision-pipeline.md`, `docs/10-exploration-engine.md`, `docs/11-renderer-architecture.md`, `docs/12-export-pipeline.md` — per-stage architecture

## One-Paragraph Summary

HoneyPie is a checkpointed pipeline (`builder → explorer → vision → copywriter → renderer → publisher`) orchestrated by a plugin-registry-driven `core`. Every extensible surface is a plugin against a stable SDK interface. All AI calls route through a single gateway with deterministic fallbacks, so the pipeline works with or without a configured AI provider. Output is a fully inspectable `dist/` directory plus a self-contained HTML report that visualizes every decision the pipeline made.

```mermaid
flowchart LR
    Repo[Source Repo] --> builder --> explorer --> vision --> copywriter --> renderer --> publisher --> Dist[dist/]
```
