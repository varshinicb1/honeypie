# Diagrams

Standalone Mermaid source files, mirroring diagrams embedded inline throughout `docs/`. Kept here separately so they can be rendered independently (e.g., exported to PNG/SVG for the docs site or press kit) without extracting them from Markdown.

- `system-overview.mmd` — top-level pipeline diagram (see `docs/03-architecture.md`)

Additional diagrams (navigation-graph example, exploration state machine, plugin lifecycle sequence, TUI state machine) are currently embedded inline in their respective `docs/*.md` files (`docs/10-exploration-engine.md`, `docs/07-plugin-sdk.md`, `docs/06-tui-specification.md`) — extract here as standalone `.mmd` files as needed once a docs-site renderer is wired up (Phase 2, see `docs/23-milestone-roadmap.md`).
