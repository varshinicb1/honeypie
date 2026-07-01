# 24 — Decision Log (ADRs)

Format: each entry is a lightweight Architecture Decision Record — Context, Decision, Consequences, Status.

---

## ADR-001: Pipeline of independently-testable stages, not a monolithic script

**Context.** An early sketch considered a single long-running script that drove the emulator, captured screenshots, called an LLM, and rendered images inline, start to finish.

**Decision.** Split into `builder → explorer → vision → copywriter → renderer → publisher`, each persisting a checkpointed artifact, orchestrated by `core`.

**Consequences.** More upfront interface design work, but enables resumability, partial re-runs, independent testability, and a plugin architecture where each stage's implementation is swappable. This is foundational to nearly every other document in this set.

**Status.** Accepted.

---

## ADR-002: Core implementation language — TypeScript-first, Rust for hot paths

**Context.** Considered three paths: pure TypeScript/Node, pure Rust, or a TypeScript orchestrator with Rust native modules for performance-critical pieces (image compositing, perceptual hashing, accessibility-tree diffing).

**Decision.** TypeScript-first for `core`, `cli`, `tui`, and all stage orchestration logic (fastest to iterate on, richest plugin-author ecosystem via npm, best alignment with the primary early-adopter developer audience). Rust native modules (via `napi-rs`) considered for the renderer's rasterization path only if profiling in Phase 2 shows it's a bottleneck — not committed upfront.

**Consequences.** Distribution via npm is natural (see `docs/22-release-process.md`); a future full-Rust core (enabling native `cargo install honeypie`) remains possible but is not the default path and would be its own ADR if pursued.

**Status.** Accepted, with the Rust-hot-path decision deferred pending Phase 2 profiling data.

---

## ADR-003: Renderer uses a headless 2D canvas (Skia-backed), not a browser/HTML-to-image pipeline

**Context.** Considered rendering mockups via a headless browser (Puppeteer + HTML/CSS layout) versus a native 2D canvas library (Skia via `skia-canvas`/`@napi-rs/canvas`).

**Decision.** Skia-backed canvas.

**Consequences.** Faster (no browser process overhead), more deterministic across OSes (fewer font-rendering/CSS-engine version differences to fight), but requires the template system (`docs/13-template-system.md`) to define its own declarative scene-graph format rather than reusing HTML/CSS, which is a small additional design burden but pays off in render throughput (`docs/19-performance-goals.md`) and cross-platform reproducibility (`docs/17-testing-strategy.md`'s visual regression requirement).

**Status.** Accepted.

---

## ADR-004: All AI calls go through a single gateway package

**Context.** Considered letting each stage (`vision`, `copywriter`, `explorer`'s form-fill) import provider SDKs directly for simplicity.

**Decision.** Single `core/ai` gateway as the only caller of any provider SDK (`docs/08-ai-architecture.md`).

**Consequences.** Slightly more indirection per call site, but centralizes redaction, cost tracking, caching, structured-output validation, and the local-only fallback mode — all requirements that would otherwise be duplicated (and inevitably drift) across three+ call sites.

**Status.** Accepted.

---

## ADR-005: Zero-config default, AI-optional (not AI-required)

**Context.** Could have made HoneyPie strictly require a configured AI provider to run at all.

**Decision.** Every AI-dependent decision has a defined deterministic/heuristic fallback (`docs/08-ai-architecture.md`'s fallback table), so `honeypie run --local-only` always produces a complete, if lower-quality, `dist/`.

**Consequences.** More implementation work (two paths per AI-touched decision point) but directly serves the security-conscious/enterprise user story and the "zero manual work" promise even for a developer without an AI API key.

**Status.** Accepted.

---

## Template for New ADRs

```
## ADR-NNN: <short title>
**Context.** What situation prompted this decision.
**Decision.** What was decided.
**Consequences.** Trade-offs, what this enables/forecloses.
**Status.** Proposed | Accepted | Superseded by ADR-NNN
```
