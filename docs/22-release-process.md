# 22 — Release Process

## Versioning

Semantic Versioning across all published packages. `core`, `cli`, and `tui` release in lockstep (they share the orchestration contract). Individual `plugins/*` and non-lockstep `packages/*` version independently, using Changesets for coordinated multi-package releases within a monorepo.

## Distribution Channels

| Channel | Priority | Rationale |
|---|---|---|
| npm (`npm install -g honeypie`) | v1, primary | Fastest path to distribution; Node ecosystem overlaps heavily with React Native/Expo/Ionic developers who are HoneyPie's early adopters |
| Homebrew (`brew install honeypie`) | v1.1 | macOS developer convenience once the CLI is stable |
| Cargo (`cargo install honeypie`) | Post-v1, conditional | Only prioritized if/when the Rust-core path (`docs/24-decision-log.md#adr-002`) is adopted; otherwise a thin Rust-wrapper distribution is possible but not native |
| Standalone binaries (GitHub Releases) | v1.1 | Via `pkg`/`bun build --compile` to avoid requiring a Node install for non-Node developers |

## Release Cadence

- **Patch releases**: as needed, no fixed cadence, for bug fixes.
- **Minor releases**: every 2–4 weeks during active development, bundling completed roadmap items.
- **Major releases**: only for breaking `plugin-sdk` or `honeypie.config.json` schema changes, always accompanied by a migration guide and `honeypie config migrate` support.

## Release Checklist

1. All CI gates green on `main` (`docs/17-testing-strategy.md`).
2. Performance benchmarks within regression thresholds (`docs/16-benchmarking-strategy.md`).
3. Changelog generated from Conventional Commits since last tag.
4. `docs/` reviewed for drift against any interface changes in the release.
5. Fixture apps (`examples/*`) re-run end-to-end against the release candidate build.
6. Tag, publish packages, publish binaries, publish docs-site update.
7. Release notes posted, highlighting any `plugin-sdk` version bumps and their deprecation timelines.

## Deprecation Policy

Any breaking change to a public interface (`core`'s orchestration contract, `plugin-sdk` interfaces, `honeypie.config.json` schema) ships with:
- A deprecation warning at least one minor release before removal.
- A codemod or `honeypie config migrate` / `honeypie plugins migrate` path where mechanically possible.
- Two-major-version SDK compatibility window per `docs/07-plugin-sdk.md`.

## Pre-1.0 Caveat

Until v1.0.0, minor version bumps may include breaking changes with clear release-note callouts — standard pre-1.0 semver practice — but the deprecation-warning courtesy above still applies wherever feasible.
