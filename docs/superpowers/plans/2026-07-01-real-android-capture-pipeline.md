# Real Android Capture Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the fake local-only pipeline with a real build → install → launch → explore → capture → mockup → publish pipeline for the native Android/Compose example, running against the live `emulator-5554`.

**Architecture:** Implement real logic in `packages/builder`, `packages/explorer`, `packages/renderer`, `packages/publisher` (all currently 1-line stubs), wire them together in a new `core/android-native-pipeline.ts` using the existing `PipelineOrchestrator`. Reuse the existing `HoneyPieManifest` shape and README-patch logic.

**Tech Stack:** Node.js/TypeScript, `adb`/`uiautomator` (Android SDK, already installed), Gradle wrapper (bootstrapped fresh — none committed), vitest.

---

### Task 1: Gradle wrapper bootstrap (`packages/builder`)
**Files:** Create `packages/builder/src/gradle-wrapper.ts`, `packages/builder/src/index.ts` (replace stub), `packages/builder/src/gradle-wrapper.test.ts`
- Write `ensureGradleWrapper(projectDir: string): Promise<{ gradlewPath: string }>` — checks for `gradlew`/`gradlew.bat`; if absent, writes `gradle/wrapper/gradle-wrapper.properties` (pointing at `gradle-8.9-bin.zip`), and a minimal `gradlew.bat`/`gradlew` script that invokes `gradle wrapper` if no local `gradle` binary is cached, falling back to downloading the wrapper jar via the Gradle services API. On Windows, prefer invoking system `gradle` (if present) to generate the wrapper via `gradle wrapper --gradle-version 8.9`; else write wrapper files by hand using known-good boilerplate.
- Test: mkdtemp a scratch dir, call `ensureGradleWrapper`, assert `gradlew.bat` exists and is non-empty.

### Task 2: Debug APK build (`packages/builder`)
**Files:** Modify `packages/builder/src/index.ts`, `packages/builder/src/build-apk.ts`, test `packages/builder/src/build-apk.test.ts`
- Write `buildDebugApk(projectDir: string): Promise<{ apkPath: string; packageName: string; mainActivity: string }>` — runs `gradlew assembleDebug` via `node:child_process.execFile`, on failure throws an error containing the last 40 lines of stdout/stderr; parses `packageName`/`mainActivity` from `app/build.gradle.kts` (`applicationId`) and the manifest (`<activity ... android:name>` with `MAIN`/`LAUNCHER` intent filter, or first activity); locates the built APK under `app/build/outputs/apk/debug/*.apk`.
- Test: run against `examples/android-compose-demo` for real (integration test, skipped if `adb devices` shows none — but build itself doesn't need a device). Assert APK file exists.

### Task 3: Install + launch + UI dump helpers (`packages/explorer`)
**Files:** Create `packages/explorer/src/adb.ts`, `packages/explorer/src/index.ts` (replace stub), test `packages/explorer/src/adb.test.ts`
- Write small adb wrappers: `installApk(apkPath, deviceId?)`, `launchApp(pkg, activity, deviceId?)`, `isProcessRunning(pkg, deviceId?)`, `dumpUiXml(deviceId?): Promise<string>`, `screencap(deviceId?): Promise<Buffer>`, `tap(x, y, deviceId?)`, `pressBack(deviceId?)`, `listDevices(): Promise<string[]>`.
- Test: `listDevices()` against the real environment returns at least one device (skip test with a clear message if none — do not fail CI in device-less environments).

### Task 4: Deterministic BFS exploration (`packages/explorer`)
**Files:** Create `packages/explorer/src/explore.ts`, test `packages/explorer/src/explore.test.ts`
- Define `ScreenNode { id: string; fingerprint: string; capturePaths: string[] }`, `ScreenEdge { from: string; to: string; action: string }`.
- Write `fingerprintUiXml(xml: string): string` — strip `bounds="..."` attributes, hash the remaining resource-id/text/class structure with `node:crypto` `createHash('sha1')`.
- Write `exploreScreens(opts: { deviceId?: string; maxNodes: number; maxDurationMs: number; cacheDir: string }): Promise<{ nodes: ScreenNode[]; edges: ScreenEdge[]; stats: { nodesDiscovered: number; edgesTraversed: number; durationMs: number; budgetExhausted: boolean } }>` — loop: dump XML, fingerprint, if new: screencap+save to `cacheDir/raw/<fingerprint>.png`, record node; find first unvisited tappable element (`clickable="true"` with parsed `bounds`), tap its center; if no unvisited element, `pressBack()`; stop when `maxNodes` reached, `maxDurationMs` elapsed, or no more back-tracking possible (root reached with nothing left).
- Test: this needs a real device — integration test skipped when `listDevices()` is empty. With `maxNodes: 1`, assert exactly 1 node and `budgetExhausted === false` (root captured, nothing else attempted only if that's genuinely all — otherwise assert `budgetExhausted === true` when more taps were available). Assert `nodes[0].capturePaths[0]` file exists and is a valid PNG (starts with the PNG magic bytes `89 50 4E 47`).

### Task 5: SVG device-frame renderer (`packages/renderer`)
**Files:** Create `packages/renderer/src/index.ts` (replace stub), test `packages/renderer/src/index.test.ts`
- Write `renderDeviceFrameSvg(opts: { screenshotPng: Buffer; appName: string; widthPx?: number; heightPx?: number }): string` — returns an SVG string: outer dark rounded-rect "device" frame, inner `<image>` with `href="data:image/png;base64,${screenshotPng.toString('base64')}"`, width/height defaulting to a 9:19.5 phone aspect scaled from the actual PNG dimensions (read via a tiny manual PNG header parser: width/height are big-endian uint32 at bytes 16 and 20 of the IHDR chunk — no external PNG library needed), plus a caption text element with `appName`.
- Test: build a minimal 1x1 red PNG in-memory (hand-rolled valid PNG bytes, or reuse `zlib.deflateSync` to build one), call the function, assert the output string contains `<svg`, contains `data:image/png;base64,`, and contains the escaped `appName`.

### Task 6: Real dist publisher (`packages/publisher`)
**Files:** Create `packages/publisher/src/index.ts` (replace stub), `packages/publisher/src/readme.ts`, test `packages/publisher/src/readme.test.ts`
- Move `updateReadme`/`appendReadmeBlock`/`ensureTrailingNewline` logic out of `core/local-pipeline.ts` into `packages/publisher/src/readme.ts`, unchanged in behavior (still marker-based idempotent replace).
- Write `publishDist(opts: { destination: string; app: { framework: string; packageName: string; appName: string }; nodes: ScreenNode[]; aiUsage: {...} }): Promise<HoneyPieManifest>` — for each node: copy raw PNG into `dist/screenshots/<id>.png`, render+write an SVG mockup into `dist/mockups/<id>.svg` (via `renderDeviceFrameSvg` from Task 5), write `dist/metadata/store-listing.json` (templated: `{ headline: appName, subtitle: "N screens captured" }`), write `dist/honeypie.json` manifest, write `dist/report.html` listing every captured screenshot with an `<img>` tag, call `updateReadme` pointing at the first mockup SVG.
- Test: call twice against a scratch dist dir with 2 fake nodes/PNGs, assert `dist/screenshots` has 2 files, `honeypie.json` parses, and after two publishes the README has exactly one `honeypie:start`...`honeypie:end` block (`(readme.match(/honeypie:start/g) ?? []).length === 1`).

### Task 7: Wire the real pipeline (`packages/core`)
**Files:** Create `packages/core/src/android-native-pipeline.ts`, test `packages/core/src/android-native-pipeline.test.ts`, modify `packages/core/src/index.ts` to export it
- Write `runAndroidNativePipeline(opts: { projectRoot: string; destination: string; maxNodes?: number; maxDurationMs?: number }): Promise<{ manifest: HoneyPieManifest; destination: string }>` using `PipelineOrchestrator` with 4 stages: `builder` (Task 1+2), `explorer` (Task 3+4, with an up-front `listDevices()` check that throws a clear `ConfigError` — "No Android device/emulator attached. Run `adb devices` to check." — if empty, before touching Gradle), `renderer+publisher` combined as `publisher` stage (Task 5+6).
- Test: full integration test against `examples/android-compose-demo` (guarded: skip with a console message if `listDevices()` returns empty), asserting the returned manifest's `exploration.screensDiscovered >= 1` and `existsSync(join(destination, 'honeypie.json'))`.

### Task 8: CLI wiring
**Files:** Modify `packages/cli/src/bin.ts`, `packages/cli/src/index.ts`
- Add a `--project <path>` and `--android-native` flag path that calls `runAndroidNativePipeline`; keep existing `runLocalOnlyPipeline` as the default/fallback for non-Android or `--local-only`.

### Task 9: Stress test pass (manual + scripted, not committed as new source)
- Run the full pipeline once for real against `examples/android-compose-demo` + `emulator-5554`; inspect `dist/` output.
- Run it a second time immediately; confirm README has exactly one honeypie block (idempotency).
- Simulate "no device": run with `ANDROID_SERIAL` pointed at a bogus serial or temporarily via a wrapped adb path that returns empty `devices`; confirm the clear pre-flight error fires before any Gradle invocation.
- Simulate a Gradle failure: temporarily break a Kotlin file in the example app, run, confirm the error surfaces the log tail; revert the break.
- Run with `maxNodes: 1` and confirm `budgetExhausted` reflects reality.
- Confirm no leftover `gradle`/`java` daemon processes or app-under-test process after a full run (`adb shell pidof <pkg>` returns nothing once done, if the pipeline is expected to leave the app closed — otherwise document that it's left running, which is fine since it's just installed for inspection).

### Task 10: Final full test suite + commit
- `pnpm install && pnpm -w test` (or equivalent), fix any fallout.
- Update `HONEYPIE.md`/`ROADMAP.md` status notes only if they claim things that are now true/false (keep edits minimal, factual).
- Commit all changes.
