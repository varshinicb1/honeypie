# 21 — Contribution Guide

(Full contributor-facing version lives at the repository root as `CONTRIBUTING.md`; this document is the engineering-process companion.)

## Getting Started

```bash
git clone https://github.com/honeypie/honeypie
cd honeypie
pnpm install
pnpm build
pnpm test
```

Run the CLI against a fixture app during development:

```bash
cd examples/flutter-counter-plus
pnpm --filter @honeypie/cli exec honeypie run --local-only --dry-run
```

## Where to Start

- **Good first issues** are labeled `good-first-issue` and scoped to a single package with a clear acceptance test.
- **New export target?** Start from `docs/12-export-pipeline.md`'s `ExportTarget` interface and an existing plugin (e.g., `plugins/export-readme/`) as a template.
- **New theme?** Start from `docs/13-template-system.md` — no code required beyond a `template.yaml` and asset files for most themes.
- **New framework detector?** Start from `docs/07-plugin-sdk.md`'s `FrameworkDetector` interface; add a fixture app under `examples/` that exercises it.

## Review Process

1. Open an issue or discussion before large architectural changes (anything touching `core` or `plugin-sdk` public interfaces) — these require a lightweight ADR (`docs/24-decision-log.md` template) before implementation.
2. All PRs require passing CI gates (`docs/17-testing-strategy.md`) plus one maintainer approval.
3. Plugin PRs (new first-party plugins in `plugins/*`) additionally require passing the conformance suite (`honeypie-plugin-test conformance`).

## Communication

- Design discussions happen in GitHub Discussions, not buried in PR comment threads.
- Breaking-change proposals to `plugin-sdk` require a deprecation plan (see `docs/22-release-process.md`) before merge.

## Code of Conduct

Standard Contributor Covenant, referenced from the root `CONTRIBUTING.md` (full text to be added before public release).

## Recognition

Contributors are credited in `dist/report.html`'s footer generation notes (opt-in) and in release notes generated per `docs/22-release-process.md`.
