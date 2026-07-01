# 20 — Coding Standards

## Languages

- Primary implementation: TypeScript (strict mode) across `packages/*` and `plugins/*`.
- Performance-critical native pieces (image compositing rasterizer, perceptual hashing) may be implemented in Rust and exposed via native bindings (`napi-rs`) if profiling justifies it — see `docs/24-decision-log.md#adr-002` for the full core-language decision.

## Style

- Enforced via ESLint + Prettier, config lives in `packages/shared/lint/`, inherited by every package — no per-package style drift.
- No default exports (named exports only) for consistent import ergonomics and better tree-shaking/refactor tooling.
- Strict TypeScript: `noImplicitAny`, `strictNullChecks`, `exactOptionalPropertyTypes` all on.
- All public interfaces (anything exported from `plugin-sdk` or `core`'s public API) require TSDoc comments; enforced via `eslint-plugin-tsdoc` in CI.

## Error Handling

- No thrown strings — all errors are typed (`HoneyPieError` subclasses per category: `DetectionError`, `BuildError`, `ExplorationError`, `RenderError`, `ConfigError`) with a stable `code` field consumed by both CLI exit-code mapping (`docs/05-cli-specification.md`) and the HTML report's error panel.
- Plugin errors are always caught at the orchestrator boundary (`docs/03-architecture.md`'s isolation model) — a plugin must never be able to crash the whole process.

## Commit & PR Conventions

- Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `perf:`, `chore:`) — drives automated changelog generation (`docs/22-release-process.md`).
- Every PR touching a public interface (`core`, `plugin-sdk`) must update the relevant doc in `docs/` in the same PR — docs are not a follow-up task.
- Every PR touching `renderer`/`templates` must include updated golden images if visual output intentionally changed (`docs/17-testing-strategy.md`).

## Naming Conventions

- Packages: `@honeypie/<name>` for core packages, `honeypie-plugin-<type>-<name>` for plugin packages (e.g., `honeypie-plugin-theme-neon`).
- Config keys: `camelCase` throughout `honeypie.config.json`.
- CLI flags: `--kebab-case`.

## Dependency Policy

- New runtime dependencies require justification in the PR description (what problem, why not implement in-house, license check).
- No dependency with a copyleft license (GPL/AGPL) in any package that ships in the CLI binary, to keep HoneyPie's own license (see `LICENSE.md`) uncomplicated for downstream users.

## Documentation-as-Code

Every `packages/*` package's `README.md` is generated/checked against its actual exported public API (via a doc-linting script) so package docs cannot silently drift from the code — a `pnpm docs:check` script runs in CI.
