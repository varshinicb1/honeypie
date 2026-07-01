# 19 — Performance Goals

## Target End-to-End Budgets

| App size (screens) | Target total pipeline time | Notes |
|---|---|---|
| Small (≤10) | < 4 min | e.g. counter/demo apps |
| Medium (10–30) | < 8 min | typical indie app |
| Large (30–60) | < 15 min | `maxScreens` default cap is 60 |

These are wall-clock budgets on a "modern laptop" baseline (defined for benchmarking purposes as: 8-core Apple Silicon or equivalent x86, 16GB RAM, wired broadband) — see `docs/16-benchmarking-strategy.md` for the CI runner spec used to track this over time.

## Stage-Level Budgets

| Stage | Budget (medium app) | Primary cost driver |
|---|---|---|
| Build | < 60s | Framework build system (Gradle/Flutter/Metro) — largely outside HoneyPie's control, cached where possible |
| Emulator launch | < 45s | Cold boot; warm-reuse of an already-running emulator skips this entirely |
| Exploration | < 4 min | Bounded by `timeBudget` config; dominated by per-interaction settle-time waits |
| Vision scoring | < 60s (cloud) / < 20s (local) | VLM call latency × screenshot count, parallelized |
| Copywriting | < 30s | LLM call latency, batched where provider supports it |
| Rendering | < 90s | CPU-bound compositing, parallelized across worker pool |
| Publish/export | < 15s | I/O bound (file writes, ZIP compression) |

## Parallelism Budgets

- `vision` worker pool: default `min(8, cpuCount)` concurrent scoring calls.
- `renderer` worker pool: default `cpuCount` concurrent render jobs (CPU-bound, no benefit beyond core count).
- `copywriter`: bounded concurrency of 4 concurrent LLM calls by default (provider rate-limit friendly), configurable.

## Memory Budgets

- Peak resident memory for a large (60-screen) run should stay under 2GB for the orchestrator process (excluding the emulator itself, which is a separate process managed by the OS/Android tooling).
- Screenshot buffers are streamed to disk rather than held fully in memory across stages — only the current stage's working set is memory-resident.

## Caching for Speed

- Build caching: unchanged app source (content hash) skips rebuild.
- AI response caching: identical (prompt+image hash) calls within and across runs (for unchanged screenshots) skip redundant AI calls — critical for iterative `--from renderer` re-runs.
- Device frame/template assets are loaded once and reused across all render jobs in a run.

## Scaling Beyond a Single Machine (Future)

Distributed exploration (parallel emulators across a device farm) and distributed rendering (render worker fleet) are explicitly out of scope for v1 but the checkpoint-based architecture (`docs/03-architecture.md`) is designed so this is additive, not a rewrite — see `docs/26-future-ideas.md`.
