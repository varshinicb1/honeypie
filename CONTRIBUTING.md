# Contributing to HoneyPie

Thanks for your interest in HoneyPie! This project is in early Phase 1 implementation. The docs are still the source of truth for architecture and interfaces, and the current codebase is the first working slice toward that roadmap.

## Before You Start

1. Read `docs/01-vision.md` and `docs/02-product-requirements.md` to understand what HoneyPie is and isn't trying to be.
2. Read `docs/03-architecture.md` and `docs/04-repository-layout.md` to understand the module boundaries.
3. Check `docs/23-milestone-roadmap.md` to see what phase the project is in and what's currently in scope.
4. For anything touching a public interface (`core`, `plugin-sdk`), open a discussion first — see `docs/21-contribution-guide.md`.

## Development Setup

```bash
git clone https://github.com/honeypie/honeypie
cd honeypie
pnpm install
pnpm build
pnpm test
pnpm lint:boundaries
```

## Ways to Contribute

- **Framework detectors** — see `docs/07-plugin-sdk.md`
- **Render themes** — see `docs/13-template-system.md` (often no code required)
- **Export targets** — see `docs/12-export-pipeline.md`
- **Documentation** — this doc set is a living specification; PRs that clarify or correct it are welcome
- **Fixture apps** — `examples/` needs maintained apps exercising forms, dialogs, and navigation depth

## Code of Conduct

See `CODE_OF_CONDUCT.md`.

## Full Process Details

See `docs/21-contribution-guide.md` and `docs/22-release-process.md`.
