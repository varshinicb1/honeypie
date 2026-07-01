# 01 — Vision

## Problem Statement

Shipping a mobile app to the Play Store or App Store requires a large amount of production work that has nothing to do with engineering: capturing representative screenshots, cropping and framing them in device mockups, designing store listing graphics at exact pixel dimensions, writing store copy that isn't generic, generating README and website assets, and packaging all of it into the specific formats each platform demands. This work is repetitive, mechanical, and disconnected from the app's source code — yet it's currently done by hand, every release, by developers who would rather be writing code.

Existing tools solve slices of this problem (Fastlane automates *uploading* assets, Maestro/Appium automate *testing* flows, Rotato/Previewed automate *mockup rendering*), but nothing owns the full pipeline from "here is my repo" to "here is a publish-ready asset package."

## Thesis

The entire pipeline — build, explore, understand, capture, select, mock up, write copy, export — can be automated end-to-end because each step is now individually tractable with today's tooling:

- **Build & launch** is a solved problem (Gradle, Flutter CLI, emulators, ADB).
- **Exploration** can be automated with accessibility-tree-driven graph traversal, the same primitives Maestro/Appium expose, but driven autonomously instead of via fixed scripts.
- **Understanding** what a screen *is* and whether a screenshot is *good* is now within reach of vision-language models.
- **Writing** product-aware marketing copy is within reach of LLMs when given real screen context instead of a blank prompt.
- **Rendering** mockups and store graphics is deterministic image compositing — no AI needed, just good templates.

HoneyPie's job is to wire these together into one coherent, inspectable, extensible pipeline, using AI only where judgment is required and deterministic code everywhere else.

## What Success Looks Like

A developer runs one command inside their project:

```
cd my-app
honeypie
```

Some minutes later, `dist/` contains a complete, ready-to-publish asset package, and `dist/report.html` explains exactly what HoneyPie did, which screens it found, which screenshots it kept or rejected and why, and what copy it generated. The developer never touched a screenshot, a cropping tool, or a mockup template.

## Non-Goals (v1)

- HoneyPie is not a testing framework. It does not assert correctness; it explores and captures.
- HoneyPie does not publish to app stores on the developer's behalf in v1 (no App Store Connect / Play Console API integration yet — see `docs/26-future-ideas.md`).
- HoneyPie does not generate promotional video in v1 (planned, see roadmap).
- HoneyPie does not replace a human designer for a brand's signature marketing site — it produces strong defaults, not final brand design.

## Guiding Principles

1. **AI where judgment is needed, code where determinism is better.** Cropping, resizing, and compositing are deterministic. Judging "is this screenshot good" and "what does this screen do" are not.
2. **Every decision is inspectable.** Nothing is a black box — the HTML report surfaces every screenshot HoneyPie rejected and why.
3. **Plugin-first.** Framework detectors, exploration strategies, render themes, and export targets are all plugins against stable interfaces, not hardcoded branches.
4. **Zero-config for the common case, fully configurable for the rest.**
5. **Provider-agnostic AI.** No hard dependency on a single LLM/VLM vendor.
6. **Cross-platform from day one** in design, even if v1 ships Android-first (see `docs/23-milestone-roadmap.md` for sequencing rationale).
