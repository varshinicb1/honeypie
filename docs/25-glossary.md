# 25 — Glossary

| Term | Definition |
|---|---|
| **Navigation Graph** | HoneyPie's internal representation of an app's UI: nodes are distinct screen states (identified by a fingerprint), edges are the interactions that transition between them. |
| **Screen Fingerprint** | A hash derived from a screen's accessibility tree structure and visible text set, used to determine whether a captured state is "new" or "already seen" during exploration. |
| **Exploration Session** | One continuous run of the exploration engine against a single device/emulator, bounded by a time or step budget. |
| **Vision Scorer** | A plugin that judges a screenshot's quality across visualQuality/clutter/readability/aesthetic dimensions and produces a selection/rejection verdict. |
| **Selected Screenshot** | A screenshot that survived deduplication, rule-based filtering, and vision scoring, and was chosen for at least one export target. |
| **Scene Graph** | A declarative, data-only description of a render composition (background, device frame, screenshot, text layers) that the renderer executes identically regardless of theme. |
| **Render Theme** | A plugin providing a set of scene-graph templates (a visual "look") — e.g., `clean`, `premium`, `glass`. |
| **Export Target** | A plugin that organizes and packages rendered assets into a specific platform's required format — e.g., Play Store, App Store, README. |
| **Checkpoint** | A persisted artifact written to `.honeypie/cache/<stage>/` at the boundary between pipeline stages, enabling resumability and partial re-runs. |
| **AI Gateway** | The single `core/ai` module through which every LLM/VLM call passes, handling provider routing, redaction, caching, and cost tracking. |
| **Local-Only Mode** | A run mode that disables all external AI provider calls, using deterministic/heuristic fallbacks throughout the pipeline instead. |
| **Plugin SDK** | The published package of stable interfaces (`FrameworkDetector`, `ExplorationStrategy`, `VisionScorer`, `Copywriter`, `RenderTheme`, `ExportTarget`) that both first-party and third-party plugins implement. |
| **Manifest (`honeypie.json`)** | The machine-readable record of everything generated in a run — assets, AI usage, errors — that both the HTML report and CI tooling consume. |
| **Report (`report.html`)** | The self-contained, offline-viewable interactive artifact letting a developer inspect every decision made during a run. |
| **Redaction** | Configured stripping/blurring of PII patterns and screen regions before any content is sent to an external AI provider. |
| **Frontier (exploration)** | The set of currently-known, not-yet-visited interactive elements/screens the exploration policy chooses from at each step. |
