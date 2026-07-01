# 04 — Repository Layout

HoneyPie ships as a monorepo (pnpm + Turborepo, or Cargo workspace if the Rust implementation path is chosen — see `docs/24-decision-log.md#adr-002`). Layout below assumes the TypeScript-first path; the Rust-core hybrid variant mirrors this structure under `crates/`.

```
honeypie/
├── packages/
│   ├── core/                 # orchestration, config, plugin registry, AI gateway
│   ├── cli/                  # `honeypie` binary entry, command parsing
│   ├── tui/                  # interactive terminal UI
│   ├── builder/              # framework detection, build, device lifecycle
│   ├── explorer/             # autonomous exploration engine
│   ├── vision/               # screenshot scoring & selection
│   ├── copywriter/           # marketing copy generation
│   ├── renderer/             # mockup & asset rendering
│   ├── templates/            # theme definitions
│   ├── publisher/            # dist/ assembly, HTML report, ZIP export
│   ├── plugin-sdk/           # public plugin interfaces & test harness
│   └── shared/                # shared types, schemas, utilities
├── plugins/
│   ├── detector-flutter/
│   ├── detector-android-native/
│   ├── detector-react-native/
│   ├── detector-expo/
│   ├── detector-ionic/
│   ├── theme-clean/
│   ├── theme-premium/
│   ├── theme-glass/
│   ├── theme-dark/
│   ├── theme-light/
│   ├── theme-minimal/
│   ├── theme-material/
│   ├── export-playstore/
│   ├── export-appstore/
│   ├── export-readme/
│   ├── export-website/
│   ├── export-opengraph/
│   ├── export-social/
│   └── export-presskit/
├── apps/
│   └── docs-site/            # public documentation website (Docusaurus)
├── examples/
│   ├── flutter-counter-plus/ # sample fixture apps used in e2e tests
│   ├── react-native-demo/
│   └── android-compose-demo/
├── docs/                      # this documentation set
├── scripts/                   # release, changelog, fixture-build scripts
├── .github/workflows/
├── turbo.json
├── package.json
├── README.md
├── ARCHITECTURE.md
├── CONTRIBUTING.md
├── ROADMAP.md
├── DECISIONS.md
└── LICENSE.md
```

## Package Boundary Rules

- `core` has zero dependencies on any other HoneyPie package — everything depends on `core`, never the reverse.
- `cli` and `tui` depend on `core` only; they never import `builder`/`explorer`/etc. directly — they invoke the orchestrator, which resolves stages via the plugin registry.
- Every `plugins/*` package depends only on `plugin-sdk` (which re-exports the minimal interface surface from `core`), never on internal `core` modules. This is enforced by `docs/17-testing-strategy.md`'s architecture-boundary lint.
- `shared` contains only types/schemas/zod validators — no runtime logic — to avoid circular dependencies.

## Versioning Units

Each `packages/*` is independently versioned and published (see `docs/22-release-process.md`), except `core`, `cli`, and `tui`, which are released in lockstep as they share the orchestration contract version.
