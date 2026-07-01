# 16 — Benchmarking Strategy

## Why Benchmark

HoneyPie's value proposition is time saved; if the pipeline itself is slow or its AI-driven decisions are low quality, that value proposition collapses. Benchmarks exist for two distinct concerns: **performance** (how fast) and **quality** (how good are the AI-influenced choices).

## Performance Benchmarks

Run against a fixed set of fixture apps in `examples/` (small/medium/large by screen count) on a standardized CI runner spec, tracked over time to catch regressions.

| Benchmark | Fixture | Target (see `docs/19-performance-goals.md`) |
|---|---|---|
| Build time | flutter-counter-plus (small) | < 45s |
| Exploration throughput | android-compose-demo (medium, ~25 screens) | < 4 min to discover 90% of reachable screens |
| Vision scoring throughput | 60 captured screenshots | < 60s with cloud VLM, < 20s local-heuristic mode |
| Render throughput | 24 screenshots × 3 themes × 4 targets | < 90s |
| End-to-end (medium app) | react-native-demo | < 8 min total |

Performance benchmarks run on every PR touching `builder`, `explorer`, `vision`, or `renderer`, with regression thresholds (>15% slower fails CI, see `docs/17-testing-strategy.md`).

## Quality Benchmarks

Quality is harder to automate but not impossible:

1. **Screenshot selection quality** — a held-out fixture set of screenshots pre-labeled by human reviewers (good/bad + reason) is scored by the current `VisionScorer` implementation; agreement rate with human labels is tracked over releases (target: >85% agreement on "rejected" classification).
2. **Copy quality** — a fixture set of app contexts with human-written reference copy; generated copy is evaluated both by an automated rubric (LLM-as-judge against defined criteria: specificity, absence of generic filler phrases, factual grounding in extracted app facts) and periodically spot-checked by maintainers. Regressions in the automated rubric score block a prompt-template change from merging without explicit maintainer sign-off.
3. **Exploration coverage** — for fixture apps with a known total screen count, track % of screens discovered within the default time budget across releases.

## Benchmark Infrastructure

- Benchmarks live in `packages/*/bench/` using a consistent harness (`@honeypie/bench-kit`) producing structured JSON results.
- Results are published to a historical dashboard (static site generated from committed JSON, no external service dependency) so trends are visible without special tooling.
- `docs/23-milestone-roadmap.md` gates certain milestones on benchmark thresholds being met, not just features being "done."

## Non-Goals for Benchmarking

Benchmarks are not a substitute for real-world dogfooding. First-party maintainers are expected to run HoneyPie against their own real apps each release cycle and file discrepancies as issues — see `docs/21-contribution-guide.md`.
