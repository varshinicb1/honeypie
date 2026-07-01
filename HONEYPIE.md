# 🍯 HoneyPie

> From source code to store-ready assets.

---

# Vision

HoneyPie is an open-source AI-native developer tool that completely automates the generation of marketing assets for mobile applications.

The developer should never manually:

- take screenshots
- create mockups
- crop images
- create gradients
- add device frames
- write Play Store captions
- build social media images
- organize assets

Instead, the developer simply runs:

```bash
honeypie
```

inside any supported mobile application repository.

HoneyPie automatically builds the application, launches it, explores every screen intelligently, understands the application, captures beautiful screenshots, generates premium mockups, creates marketing assets and exports everything into a publish-ready folder.

The developer should be able to publish immediately after HoneyPie finishes.

---

# Mission

Become the industry standard AI-powered publishing pipeline for mobile applications.

---

# Design Philosophy

## One Command

```bash
cd MyApp
honeypie
```

Zero configuration for common projects.

---

# Supported Frameworks

Initially:

- Flutter
- Native Android
- Kotlin
- Jetpack Compose

Future:

- React Native
- Expo
- Ionic
- Capacitor
- MAUI
- Compose Multiplatform

Architecture must be plugin-based.

---

# Definition of Done

A developer runs one command and receives production-ready marketing assets suitable for:

- Google Play Store
- Apple App Store
- GitHub README
- Landing Pages
- Product Hunt
- LinkedIn
- Twitter/X
- Press Kits

---

# Terminal User Interface

HoneyPie should present a modern interactive TUI.

Example:

```text
🍯 HoneyPie

✓ Flutter detected
✓ Android supported
✓ Firebase detected
✓ 26 routes discovered

Outputs

[x] Screenshots
[x] Device Mockups
[x] Play Store Assets
[x] App Store Assets
[x] README Images
[x] Website Hero
[x] Social Media Kit
[ ] Promo Video

Destination:
dist/

Estimated Time: 4m 12s

Press ENTER to begin.
```

Requirements:

- Keyboard navigation
- Mouse support
- Progress bars
- Live logs
- ETA
- Resumable jobs

---

# Pipeline

1. Analyze project automatically.
2. Build the app.
3. Launch emulator/device.
4. Explore the app intelligently.
5. Capture high-quality screenshots.
6. Score screenshots with vision models.
7. Understand features.
8. Generate marketing copy.
9. Render premium mockups.
10. Export all assets into `dist/`.

---

# Output Structure

```text
dist/
├── screenshots/
├── mockups/
├── playstore/
├── appstore/
├── website/
├── social/
├── readme/
├── press-kit/
├── metadata/
└── report.html
```

---

# Research Targets

Study and integrate ideas from:

- Maestro
- Appium
- UI Automator
- Espresso
- Fastlane
- Flutter DevTools
- Android Debug Bridge
- Gradle
- Rotato
- Shots
- Previewed
- Figma workflows

Document:

- strengths
- weaknesses
- APIs
- licensing
- integration opportunities

Reuse mature open-source libraries instead of reinventing solved problems.

---

# AI Guidelines

Use AI for:

- navigation reasoning
- screenshot selection
- feature understanding
- marketing copy

Prefer deterministic algorithms where appropriate.

Support pluggable AI providers.

---

# Engineering Standards

Every feature must include:

- tests
- documentation
- examples
- logging
- benchmarks where appropriate

Keep the project modular and maintainable.

---

# Instructions for AI Coding Agents

Treat this document as the product specification.

1. Read this document before each milestone.
2. Break work into small deliverable milestones.
3. Keep the repository buildable after every milestone.
4. Update documentation continuously.
5. Reuse proven libraries where appropriate.
6. If blocked, document the blocker, propose alternatives, continue independent work, and revisit later.
7. Continue iterating until the milestones are complete or explicitly deferred with documented reasons.

HoneyPie is not a screenshot generator.

HoneyPie is an AI-powered publishing pipeline for modern mobile applications.
