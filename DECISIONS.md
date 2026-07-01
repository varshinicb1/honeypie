# HoneyPie — Decisions (Pointer)

The full, authoritative Architecture Decision Record log lives at `docs/24-decision-log.md`. This root-level file exists purely for repository-root discoverability (many contributors look for `DECISIONS.md` before finding `docs/`).

Current accepted decisions (see `docs/24-decision-log.md` for full context/consequences):

- **ADR-001** — Pipeline of independently-testable stages, not a monolithic script
- **ADR-002** — TypeScript-first core, Rust for hot paths only if profiling justifies it
- **ADR-003** — Skia-backed headless 2D canvas renderer, not browser/HTML-to-image
- **ADR-004** — All AI calls go through a single gateway package
- **ADR-005** — Zero-config default; AI is optional, never required, via deterministic fallbacks
