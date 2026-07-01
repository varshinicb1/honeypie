# Real Android Capture Pipeline — Design

Date: 2026-07-01

## Problem

HoneyPie's vision (`HONEYPIE.md`) is a one-command pipeline that builds a mobile app, launches it,
explores it, captures real screenshots, renders mockups, and publishes marketing assets. Today,
9 of 12 packages are 1-line stubs, and the only working pipeline (`core/local-pipeline.ts`) is
entirely synthetic: it detects the framework via regex, then fabricates a placeholder `.txt`
"screenshot" and a static SVG with the app name on it. No build, launch, exploration, or capture
actually happens.

This spec covers replacing that fake pipeline with a real one for **native Android/Compose**
projects, using what's actually available in this environment: Android SDK, a running emulator
(`emulator-5554`), and `adb`. Flutter support is explicitly deferred — no Flutter SDK is installed
here, and adding a second framework backend is out of scope for this pass.

## Scope

In scope:
- Bootstrap a Gradle wrapper for `examples/android-compose-demo` (no wrapper is committed).
- Real build (`gradlew assembleDebug`), real install (`adb install`), real launch (`adb shell am start`).
- Deterministic (non-AI) breadth-first exploration via `uiautomator dump` + tap, with screen
  fingerprinting to avoid revisits and a node/time budget to guarantee termination.
- Real screenshot capture via `adb exec-out screencap -p`.
- A dependency-free SVG device-frame mockup that embeds the real screenshot as base64.
- Real `dist/` output: screenshots/, mockups/, metadata/, report.html, honeypie.json manifest,
  idempotent README patching.
- A stress-test pass exercising failure modes (no emulator, build failure, crash-on-launch,
  exploration budget exhaustion, re-run idempotency).

Out of scope (explicitly deferred, not built now):
- Flutter support of any kind (web or native).
- Real AI/LLM calls for exploration or copywriting — v1 uses deterministic/templated logic.
- Vision-model screenshot scoring/selection.
- Any non-Android target (iOS, React Native, etc).
- TUI (`packages/tui` stays a stub).

## Architecture

Stage implementations move from being inlined in `core/local-pipeline.ts` into their real
packages, matching the intended plugin architecture. `core/orchestrator.ts` (checkpointing runner)
is reused unchanged.

```
packages/builder    -> ensureGradleWrapper(), buildDebugApk()
packages/explorer    -> installAndLaunch(), exploreScreens() [uiautomator BFS + adb screencap]
packages/renderer    -> renderDeviceFrameSvg(screenshotPngBuffer, appName) -> svg string
packages/publisher   -> writeDist(), patchReadme() [idempotent]
packages/core        -> runAndroidNativePipeline() wires the above via PipelineOrchestrator
packages/cli         -> bin.ts invokes runAndroidNativePipeline for android-native projects,
                        keeps runLocalOnlyPipeline as an explicit --local-only/no-device fallback
```

### Data flow

1. **builder**: locate `examples/android-compose-demo` (or detected project root), write a
   Gradle wrapper (`gradlew`, `gradle/wrapper/gradle-wrapper.properties` +
   `gradle-wrapper.jar`) if absent, run `./gradlew assembleDebug`, return APK path + package/
   activity name (parsed from `AndroidManifest.xml` / `build.gradle.kts`).
2. **explorer**: `adb install -r <apk>`, `adb shell am start -n <pkg>/<activity>`. Loop up to
   `maxNodes` (default 8) or `maxDurationMs` (default 60s): dump UI XML, hash a normalized view
   of it (resource-ids + text, positions stripped) as the fingerprint, screencap if new, pick the
   next unvisited tappable element (by resource-id) and tap it via `adb shell input tap x y`
   (coordinates from the XML bounds), track a simple graph (node = fingerprint, edge = tapped
   element). Back out via `adb shell input keyevent KEYCODE_BACK` when a branch is a dead end
   (all children visited), matching a plain BFS/DFS-with-backtrack.
3. **capture**: PNGs pulled to `.honeypie/cache/raw/<nodeId>.png` as part of the explorer step
   (screencap is cheap enough not to warrant a separate orchestrator stage).
4. **renderer**: for each selected screenshot, produce an SVG: dark device chrome rect + rounded
   "screen" `<image>` element with `href="data:image/png;base64,..."` + app name caption. Pure
   string templating, zero new dependencies.
5. **publisher**: write `dist/screenshots/*.png` (raw captures), `dist/mockups/*.svg` (framed),
   `dist/metadata/store-listing.json` (still templated, not AI, per scope), `dist/report.html`,
   `dist/honeypie.json` manifest (reusing the existing `HoneyPieManifest` shape), and patch the
   README's `<!-- honeypie:start -->` block to reference a real mockup file — reusing the existing
   idempotent marker-replace logic already in `local-pipeline.ts::updateReadme`.

### Error handling

- No `adb` on PATH / no device attached → fail fast with a clear `ConfigError`-style message
  listing `adb devices` output, before attempting any build.
- Gradle wrapper bootstrap or `assembleDebug` failure → surface the last ~40 lines of Gradle
  output in the thrown error; do not proceed to install.
- `adb install` failure (e.g. `INSTALL_FAILED_*`) → clear error with the raw adb output.
- App crash immediately after launch (process not present shortly after `am start`) → detected via
  `adb shell pidof <pkg>`; treated as a distinct, clearly labeled error rather than silently
  producing an empty exploration graph.
- Exploration budget exhaustion is **not** an error — it's recorded as
  `stats.budgetExhausted = true` in the manifest (field already exists), and the pipeline still
  publishes whatever was captured.
- Fingerprint collisions (two different screens hashing the same) degrade gracefully — worst case
  is under-exploration, not a crash.
- Re-running the whole pipeline must be idempotent for the README patch (already covered by the
  existing marker-based replace) and must not fail if `dist/` already exists (overwrite, don't
  merge stale files).

### Testing / stress test plan

- Unit tests per package (fingerprinting/hashing logic, SVG templating, manifest shape,
  README patch idempotency) using `vitest`, following the existing `*.test.ts` convention.
- One real end-to-end run against `examples/android-compose-demo` on `emulator-5554`, asserting:
  real PNG files exist and are non-trivial size, `dist/honeypie.json` validates against the
  manifest shape, `report.html` references real files, README contains exactly one
  `honeypie:start/end` block after two consecutive runs.
- Deliberate failure-mode runs (stress test): temporarily rename `adb` / disconnect device to
  hit the "no device" path; introduce a transient Gradle syntax error to hit the build-failure
  path; verify budget exhaustion path with `maxNodes: 1`. Restore state after each.
- Confirm no leaked processes (stray `gradle` daemons, no zombie app left mid-crash-loop) after
  the stress run.

## Non-goals / follow-ups (not built now)

- Flutter backend (web or native) behind the same `builder`/`explorer` plugin interface.
- Real AI provider wiring for exploration decisions and marketing copy.
- Vision-based screenshot quality scoring and selection.
- TUI implementation.
