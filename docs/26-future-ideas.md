# 26 — Future Ideas (Post-v1)

These are deliberately **not** committed roadmap items — they're a parking lot of ideas worth revisiting once the core pipeline (Phases 1–4) is proven, so the vision document stays honest about what v1 actually delivers.

## Direct Store Publishing
Integrate Play Console API / App Store Connect API so `honeypie ship --publish` can push generated assets and metadata directly to a draft store listing, not just export them locally. Requires careful scoping of OAuth permissions and a strong confirmation UX given the destructive potential of touching a live store listing.

## Promotional Video Generation
Record video during exploration (not just stills), then use AI-assisted editing (scene selection, music-synced cuts, animated text overlays) to produce a 15–30 second App Store/Play Store preview video and a longer marketing/demo cut.

## Full Marketing Website Generation
Beyond a hero image, generate a complete, deployable single-page marketing site (copy, screenshots, feature sections, CTA) as a static site, using the same navigation-graph understanding already built for the asset pipeline.

## Distributed/Fleet Exploration
Run exploration across a device farm in parallel (multiple form factors, multiple OS versions simultaneously) rather than one device per run — the checkpoint architecture (`docs/03-architecture.md`) was designed to make this additive.

## Sandboxed Plugin Execution
Address the plugin trust-boundary limitation noted in `docs/18-security-considerations.md` by running render-theme (and eventually all third-party) plugins in a sandboxed subprocess/WASM runtime rather than in-process.

## A/B Screenshot Variant Testing Integration
Export multiple screenshot/copy variants tagged for direct use with Play Store's built-in store listing experiments, closing the loop between "generated" and "actually validated to convert."

## Localization Pipeline
Auto-translate generated copy (and re-render text-overlay mockups) into multiple store locales, grounded in the same app-fact extraction already used for English copy generation.

## Accessibility Audit Pass
Since exploration already walks the accessibility tree, surface a lightweight a11y audit (missing labels, poor contrast, small touch targets) as a bonus report section — adjacent value from data HoneyPie already collects.

## Design Partner Program
Before committing to any of the above, run a structured design-partner program with a small group of real indie developers and teams (Phase 3–4 timeframe) to validate which of these ideas actually matter versus which are interesting-but-low-value — this list should be treated as hypotheses, not commitments.
