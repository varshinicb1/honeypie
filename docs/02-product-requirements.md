# 02 — Product Requirements

## Functional Requirements

### FR1. Framework Detection
- FR1.1 Detect Flutter, native Android (Java/Kotlin), Jetpack Compose, React Native, Ionic, Expo projects from repository structure with no user input.
- FR1.2 Extract package name, application display name, launcher icon, minimum SDK, supported platforms, build system, and (where feasible) navigation library in use.
- FR1.3 Fail gracefully with a clear diagnostic when a framework cannot be confidently detected, and offer manual override via config or CLI flag.

### FR2. Build & Launch
- FR2.1 Build a debug/instrumented variant of the app suitable for automated exploration.
- FR2.2 Launch an emulator (Android) or simulator (iOS, post-v1) if no running device/emulator is attached.
- FR2.3 Install the built artifact onto the running device/emulator.
- FR2.4 Support an existing physical device as an explicit alternative to emulator launch.

### FR3. Autonomous Exploration
- FR3.1 Traverse the app's reachable UI graph without a pre-written test script.
- FR3.2 Detect and dismiss permission dialogs, system prompts, and app-level modals that would otherwise block traversal.
- FR3.3 Fill forms with plausible synthetic data where doing so unblocks further exploration (e.g., a signup form).
- FR3.4 Detect and avoid infinite loops (e.g., two screens that navigate to each other).
- FR3.5 Maintain a persistent navigation graph (screens as nodes, transitions as edges) across the exploration session.
- FR3.6 Support a configurable time/step budget for exploration.
- FR3.7 Support a configurable exclusion list (screens/flows never to enter — e.g., destructive actions, payment flows).

### FR4. Screenshot Capture & Selection
- FR4.1 Capture a screenshot at each distinct discovered screen state.
- FR4.2 Deduplicate near-identical captures.
- FR4.3 Score each screenshot on visual quality dimensions (see `docs/09-vision-pipeline.md`).
- FR4.4 Select a curated top-N set per output target, respecting each store's required screenshot count and aspect ratio.
- FR4.5 Reject screenshots showing loading states, empty states (unless explicitly desired), error states, or keyboard-obscured content by default, configurable.

### FR5. Marketing Copy Generation
- FR5.1 Generate a headline, subtitle, and per-screen feature caption grounded in what the screen actually shows and does.
- FR5.2 Generate Play Store short/long description, App Store description, README description, website copy, and social captions.
- FR5.3 Avoid generic, templated-sounding copy; ground output in extracted app-specific facts (app name, detected features, screen content).
- FR5.4 Support tone/voice configuration (e.g., playful, professional, minimal).

### FR6. Mockup & Asset Rendering
- FR6.1 Render selected screenshots into device mockups across multiple themes (clean, premium, glass, dark, light, minimal, material).
- FR6.2 Support single-device, multi-device, floating, and angled compositions.
- FR6.3 Render at exact pixel dimensions required by each export target.
- FR6.4 Support custom background gradients, brand colors, and fonts via configuration.

### FR7. Export Pipeline
- FR7.1 Produce a `dist/` directory containing subfolders for screenshots, mockups, Play Store assets, App Store assets, website assets, README assets, social assets, press kit, and metadata.
- FR7.2 Produce `dist/honeypie.json` — a machine-readable manifest of every generated asset and its provenance.
- FR7.3 Produce `dist/report.html` — an interactive, offline-viewable report.
- FR7.4 Produce a ZIP export of the full `dist/` directory on request.

### FR8. CLI & TUI
- FR8.1 Provide a zero-argument `honeypie` command that launches an interactive TUI for the common case.
- FR8.2 Provide a fully scriptable non-interactive mode (`honeypie run --yes --config honeypie.config.json`) for CI usage.
- FR8.3 TUI supports keyboard navigation, mouse support, live progress, collapsible sections, and colored output.

### FR9. Extensibility
- FR9.1 Support third-party plugins for framework detectors, exploration strategies, vision scorers, copywriters, render themes, and export targets.
- FR9.2 Publish a stable Plugin SDK (see `docs/07-plugin-sdk.md`).

## Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Full pipeline on a typical 15–25 screen app completes in under 10 minutes on a modern laptop (see `docs/19-performance-goals.md`) |
| Reliability | A crash in any single plugin must not corrupt already-generated output; partial runs are resumable |
| Portability | Core CLI runs on macOS, Linux, and Windows (WSL2 acceptable for v1 Windows support) |
| Security | No source code, screenshots, or generated copy leaves the developer's machine except through an explicitly configured AI provider, with an explicit opt-in and a local-only mode available |
| Observability | Every pipeline stage emits structured logs and timing data consumable by the TUI and by CI logs |
| Extensibility | Adding a new export target must not require modifying core packages |
| Determinism | Given the same app build and the same AI provider/seed, rendering output (crops, compositing, dimensions) must be bit-for-bit reproducible; AI-influenced choices (which screenshots, what copy) should be reproducible with a fixed seed where the provider supports it |

## User Stories

- As a solo indie developer, I want to run one command and get Play Store assets, because I have no design skill and no time.
- As a team lead, I want to run HoneyPie in CI on every release branch so screenshots are always current with the actual UI.
- As an open-source maintainer, I want polished README screenshots without paying a designer.
- As a plugin author, I want to add a new export target (e.g., Microsoft Store) without touching HoneyPie core.
- As a security-conscious enterprise user, I want a fully local mode where no app data or screenshots are sent to any external AI provider.

## Out of Scope (v1)

See `docs/01-vision.md` Non-Goals and `docs/26-future-ideas.md`.
