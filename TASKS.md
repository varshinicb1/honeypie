# HoneyPie — Phase 1 Task Breakdown

This is a living implementation task list for the current phase (Phase 1 — see `docs/23-milestone-roadmap.md`). It will be superseded by the project's issue tracker once implementation begins; it exists here so Phase 1 has a concrete starting checklist.

## `core`
- [x] Config loader + JSON Schema validation (`docs/15-configuration-system.md`)
- [x] Plugin registry: load, validate manifest, version-compatibility check (`docs/07-plugin-sdk.md`)
- [x] Orchestrator: stage sequencing, checkpoint read/write (`docs/03-architecture.md`)
- [x] AI gateway skeleton with local-only fallback provider implemented first (`docs/08-ai-architecture.md`)
- [x] Typed error hierarchy (`docs/20-coding-standards.md`)
- [ ] Structured logging + JSON event stream (`docs/05-cli-specification.md` `--json` mode)

## `builder`
- [ ] Flutter framework detector
- [ ] Native Android/Compose framework detector
- [ ] Gradle/Flutter build invocation wrappers
- [ ] ADB device/emulator lifecycle management
- [ ] `honeypie doctor` environment diagnostics

## `explorer`
- [ ] Accessibility-tree extraction layer (Android)
- [ ] Screen fingerprinting
- [ ] Frontier-based exploration policy (`docs/10-exploration-engine.md`)
- [ ] Permission dialog / modal detection & dismissal
- [ ] Synthetic form-fill (fixture-based first, LLM-assisted later)
- [ ] Navigation graph serialization

## `vision`
- [ ] Perceptual-hash deduplication
- [ ] Rule-based filtering (blank frame, keyboard, loading spinner detection)
- [ ] Local-heuristic scorer (blur/exposure/edge-density/OCR-based readability)
- [ ] Selection algorithm per export target aspect ratio/count

## `cli`
- [x] `honeypie run` (non-interactive path first)
- [x] `honeypie doctor`
- [x] `honeypie config init`
- [ ] Exit code mapping (`docs/05-cli-specification.md`)

## Testing / Infra
- [x] `examples/flutter-counter-plus` fixture app
- [x] `examples/android-compose-demo` fixture app
- [x] CI pipeline: unit + integration + architecture-boundary lint (`docs/17-testing-strategy.md`)
- [ ] Benchmark harness skeleton (`docs/16-benchmarking-strategy.md`)

## Exit Criteria for Phase 1
See `docs/23-milestone-roadmap.md` — `honeypie run --local-only` produces a real `dist/` (unframed screenshots + basic metadata) against both fixture apps.
