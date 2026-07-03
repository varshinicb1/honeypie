# HoneyPie — Remaining Work to Ship (Execution Plan for OpenCode)

> **READ THIS ENTIRE FILE BEFORE WRITING ANY CODE.**
> You are finishing a partially-built product. Most of the hard architecture already exists and works.
> Your job is to complete the remaining tasks EXACTLY as specified, one task at a time, in order.
> Do not redesign anything. Do not rename anything. Do not "improve" working code.

---

## 1. What HoneyPie is

HoneyPie turns a mobile app's source code into store-ready marketing assets automatically.
A user drops a project folder (or pastes a GitHub repo URL) into a Windows desktop app.
HoneyPie builds the app, installs it on an Android emulator, taps through its screens,
captures real screenshots, wraps them in device-frame mockups, and writes everything into
a `dist/` folder with a manifest (`honeypie.json`) and an HTML report.

## 2. What already works (DO NOT rebuild these)

| Thing | Where | Status |
|---|---|---|
| Pipeline orchestrator with checkpoints | `packages/core/src/orchestrator.ts` | Working |
| Manifest type | `packages/core/src/manifest.ts` (`HoneyPieManifest`) | Working — keep backward compatible |
| Local-only (synthetic) pipeline | `packages/core/src/local-pipeline.ts` | Working fallback |
| Gradle wrapper bootstrap + real APK build | `packages/builder/src/gradle-wrapper.ts`, `build-apk.ts` | Working |
| adb wrappers (install, launch, screencap, tap, back, uiautomator dump) | `packages/explorer/src/adb.ts` | Working |
| Deterministic BFS screen exploration + fingerprinting | `packages/explorer/src/explore.ts` | Working but basic (see Task B6) |
| SVG device-frame mockup renderer (dependency-free, manual PNG header parse) | `packages/renderer/src/index.ts` | Working |
| dist/ publisher + idempotent README patch | `packages/publisher/src/index.ts`, `readme.ts` | Working |
| Android-native pipeline wiring | `packages/cli/src/android-native-pipeline.ts` | Working — verified end-to-end against `android/sunflower` on a real emulator |
| `--repo <url>` clone + framework auto-detect | `packages/cli/src/repo-source.ts`, `run-from-repo.ts` | Working — verified against `flutter/samples` and `android/sunflower` |
| CLI (`run`, `doctor`, `config init`, flags `--yes --local-only --android-native --repo --dest --max-screens`) | `packages/cli/src/index.ts` | Working |
| Tauri 2 desktop app: drag-drop folder, paste repo URL, inline image gallery, open-output-folder | `apps/desktop/` | Working |
| Node runtime bundled as Tauri sidecar + CLI bundled via esbuild | `apps/desktop/scripts/bundle-cli.mjs`, `src-tauri/binaries/`, `src-tauri/resources/` | Working |
| Real MSI installer with custom logo | `npx tauri build --bundles msi` from `apps/desktop` | Working |
| Cute mascot logo | `assets/logo/honeypie-logo.svg` + generated icon set in `apps/desktop/src-tauri/icons/` | Done |
| CI (build/test/typecheck/boundaries on ubuntu + flutter fixture job) | `.github/workflows/ci.yml` | Green |

## 3. What is honestly missing (this is your work)

Ordered by shipping priority. Do them in this order.

- **A1** Release automation: no way for a customer to download the MSI (no GitHub Release, no CI job that builds it)
- **A2** Desktop app shows a frozen spinner during long runs (no live progress, no cancel)
- **A3** Repo-URL runs write output into a hidden temp cache dir the user can't find
- **A4** Missing-tool errors are raw logs; no friendly "you need git / Android SDK for this mode" guidance
- **B1** No screenshot quality filtering (blank/duplicate screens get published)
- **B2** Store listing metadata is a 2-field JSON stub; no real Play Store folder structure
- **B3** No Flutter support (detected but falls back to synthetic placeholder pipeline)
- **B4** Pipeline requires an ALREADY-RUNNING emulator; should auto-boot an AVD when none is attached
- **B5** Exploration can back out of the app and get stuck; no scrolling; no relaunch-on-crash
- **C1** MSI is unsigned (Windows SmartScreen warning) — config hook only, cert purchase is a human task
- **C2** No auto-update
- **C3** CLI not published to npm

Explicitly OUT OF SCOPE (do not attempt): iOS support, macOS/Linux builds, the TUI package, real AI/LLM integration, vision-model scoring.

---

## 4. Environment facts (memorize these)

- **OS**: Windows 11. Shell commands run under Git Bash (POSIX) or PowerShell. Paths in code must use `node:path` `join()` — never hardcode separators.
- **Node 22, pnpm 10, Turborepo.** Run everything from repo root with `pnpm run <task>` unless told otherwise.
- **Android SDK** is at `ANDROID_HOME` (`C:\Users\varsh\AppData\Local\Android\Sdk`). One AVD exists: `star_trail_emu`. adb resolution logic already exists in `packages/explorer/src/adb.ts` (`resolveAdbPath()`), reuse it — never invoke bare `adb` yourself.
- **CI runs on ubuntu-latest with NO Android SDK, NO device, NO flutter** (except the separate `flutter-fixture` job). Every test you write MUST skip gracefully in that environment (see §5 rule 4).
- **Flutter is NOT installed on the dev machine either.** Flutter code paths must detect `flutter` on PATH and degrade gracefully.
- **git IS installed** on the dev machine but may not be on customer machines.

## 5. Hard rules (violating any of these breaks the build)

1. **`exactOptionalPropertyTypes: true`** is on. Never pass a possibly-`undefined` value to an optional property. Use the spread pattern:
   ```ts
   { required: x, ...(opt !== undefined ? { opt } : {}) }
   ```
2. **Spawning `.bat`/`.cmd` on Windows requires `shell: true`**:
   ```ts
   execFileAsync(gradlewPath, ["assembleDebug"], { shell: process.platform === "win32" })
   ```
3. **New cross-package imports require a declared dependency.** If package X imports `@honeypie/Y`, add `"@honeypie/Y": "workspace:*"` to X's `package.json`, then run `pnpm install`. Turbo's build ordering AND `scripts/check-boundaries.mjs` both depend on this. Then verify with `pnpm run lint:boundaries`.
4. **Device/SDK-dependent tests must skip, not fail**, using this exact established pattern:
   ```ts
   if (!process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) {
     console.warn("skipping: no Android SDK on this machine");
     return;
   }
   const devices = await listDevices();
   if (devices.length === 0) { console.warn("skipping: no adb device attached"); return; }
   ```
5. **The bundled CLI must stay pure-JS.** `apps/desktop/scripts/bundle-cli.mjs` bundles `packages/cli/src/bin.ts` with esbuild into a single `.mjs`. Never add a native-module dependency (sharp, canvas, better-sqlite3, etc.) to core/cli/builder/explorer/renderer/publisher. The renderer already parses PNG headers manually — follow that spirit.
6. **Never modify** `packages/core/src/orchestrator.ts` semantics, the `HoneyPieManifest` existing fields (adding optional fields is OK), the `<!-- honeypie:start -->`/`<!-- honeypie:end -->` README marker logic, or anything under `dist/`, `.honeypie/`, `src-tauri/target/`, `src-tauri/gen/`.
7. **Verification gate — run after EVERY task, all must pass before you commit:**
   ```bash
   pnpm run build && pnpm run test && pnpm run typecheck && pnpm run lint:boundaries
   ```
8. One task = one commit. Commit message: `feat|fix|docs: <what>` plus 2–5 body lines saying what you verified.
9. If a task says "verify manually with emulator" and no emulator is available where you run, still finish the code + unit tests, and note in the commit body: `NOT device-verified: no emulator in this environment`.

---

## 6. TASKS

### Task A1 — GitHub release workflow that builds and publishes the MSI

**Create:** `.github/workflows/release.yml`

Trigger: push of tag matching `v*`. Job runs on `windows-latest`:

1. Checkout; setup pnpm 10.33.4 + Node 22 (copy the setup steps verbatim from `.github/workflows/ci.yml`); `pnpm install --frozen-lockfile`.
2. Install Rust: `dtolnay/rust-toolchain@stable`.
3. Copy the sidecar Node binary (the runner's own node.exe):
   ```powershell
   Copy-Item (Get-Command node).Source apps/desktop/src-tauri/binaries/node-x86_64-pc-windows-msvc.exe
   ```
   (This file is gitignored/absent in CI — the desktop build fails without it.)
4. `pnpm run build` (repo root — builds all packages + bundles the CLI resource).
5. `cd apps/desktop && npx tauri build --bundles msi`.
6. Upload `apps/desktop/src-tauri/target/release/bundle/msi/*.msi` to a GitHub Release for the tag using `softprops/action-gh-release@v2` with `files:` pointing at that glob.

**Also update** the root `README.md`: add a "Download" section linking to `https://github.com/varshinicb1/honeypie/releases/latest`.

**Verify:** you cannot run the workflow locally; validate YAML by eye and ensure `pnpm run build` works locally. Note in commit: `workflow validated statically`.

### Task A2 — Live progress + cancel in the desktop app

**Files:** `apps/desktop/src-tauri/src/lib.rs`, `apps/desktop/src/main.ts`, `apps/desktop/index.html`

In `lib.rs`, inside `spawn_honeypie`'s event loop, emit each output line to the window:
```rust
use tauri::Emitter; // add this import
// inside CommandEvent::Stdout / Stderr arms, after pushing to `output`:
let _ = app.emit("honeypie://progress", String::from_utf8_lossy(&bytes).to_string());
```
(`spawn_honeypie` currently takes `app: &tauri::AppHandle` — `app.emit` works on it directly.)

Add cancel support: store the spawned child's handle in a `tauri::State<Mutex<Option<CommandChild>>>`; add a `#[tauri::command] fn cancel_run(...)` that takes it out of the mutex and calls `.kill()`. Register the state with `.manage(...)` in `run()` and add `cancel_run` to `generate_handler!`.

In `main.ts`: subscribe with `listen("honeypie://progress", ...)` from `@tauri-apps/api/event`; append lines to a scrolling `<pre id="live-log">` inside the status section (keep the spinner); add a Cancel button that invokes `cancel_run`, visible only while running.

**Verify:** `npx tsc --noEmit` in `apps/desktop`; `cargo check --manifest-path src-tauri/Cargo.toml`; then `npx tauri dev` and run a folder — you must see lines streaming.

### Task A3 — Put repo-URL output somewhere the user can find

**Files:** `packages/cli/src/run-from-repo.ts`, `packages/cli/src/index.ts`

Add optional `outputDir?: string` to `RunFromRepoOptions`. When set, after the pipeline finishes, recursively copy the dist folder (`node:fs/promises` `cp(src, dest, { recursive: true })`) to `<outputDir>/<repo-slug>` and return that path as `destination` instead. Derive `repo-slug` from the URL the same way `slugFor()` does in `repo-source.ts` but WITHOUT the hash suffix (just `owner-repo`).

In the CLI, add flag `--output <dir>` wired to it.

In `apps/desktop/src-tauri/src/lib.rs` `run_from_repo_url`: pass `--output` pointing at the user's Downloads folder: resolve it with `app.path().download_dir()` and append `"HoneyPie"`.

**Verify:** unit test in `packages/cli/src/run-from-repo.test.ts` for the slug derivation (pure function — export it). Full gate (§5 rule 7).

### Task A4 — Friendly capability errors in the desktop app

**Files:** `apps/desktop/src-tauri/src/lib.rs`, `apps/desktop/src/main.ts`

Add `#[tauri::command] fn check_tools() -> ToolReport` (sync, no sidecar) that checks, on the host: `git --version` works; `ANDROID_HOME`/`ANDROID_SDK_ROOT` env var set AND `<sdk>/platform-tools/adb.exe` exists. Return `{ git: bool, android_sdk: bool }` (derive `Serialize`). Use `std::process::Command` with `.arg("--version")` and treat any spawn error as `false`.

Frontend: call it on startup. If `!git`, disable the repo-URL form and show under it: *"Repo links need Git installed — get it at git-scm.com. Folder drop still works."* If `!android_sdk`, show a small non-blocking banner: *"No Android SDK detected — HoneyPie will generate placeholder assets instead of real screenshots. Install Android Studio to unlock real capture."* This is honest-by-design: do not hide the limitation.

**Verify:** `cargo check`, `tsc --noEmit`, `npx tauri dev` visual check.

### Task B1 — Screenshot quality filter (dependency-free)

**Create:** `packages/vision/src/index.ts` (replace the 1-line stub), `packages/vision/src/index.test.ts`, `packages/vision/tsconfig.json` (copy from `packages/renderer/tsconfig.json`), add scripts block to `packages/vision/package.json` (copy from renderer's).

Implement:
```ts
export interface ScoredScreen { id: string; path: string; score: number; rejected: boolean; reason?: string }
export async function scoreScreens(screens: Array<{ id: string; path: string }>): Promise<ScoredScreen[]>
```
Rules (all computable from raw bytes, no image decode):
- Read each PNG. Reject (`reason: "duplicate"`) if its sha1 equals an earlier screen's sha1.
- Reject (`reason: "blank"`) if compressed file size < 20 KB for a full-screen capture (a 1080×2400 screencap of a near-uniform screen compresses tiny; real content is 40 KB+). Use 20 000 bytes as the threshold constant.
- Score survivors `100 - (index * 5)` floor 50 (earlier screens are usually the app's main screens).

Wire it into `packages/cli/src/android-native-pipeline.ts` between explorer and publisher: filter `exploration.nodes` to non-rejected ones before `publishDist`, and set the manifest's `vision.captured/selected/rejected` numbers accordingly (publisher already takes `nodes`; pass counts through `publishDist` opts — extend `PublishDistOptions` with optional `rejectedCount?: number`, default 0). Add `@honeypie/vision` dep to cli's package.json (§5 rule 3).

**Tests:** build two identical tiny PNG buffers + one large-random-content PNG in-memory (copy the `buildTestPng` helper from `packages/renderer/src/index.test.ts`, give the big one random pixel bytes so it doesn't compress) → assert dedup + blank rejection + ordering.

### Task B2 — Real store-listing output structure

**File:** `packages/publisher/src/index.ts` (+ its test)

Replace the 2-field `store-listing.json` with:
```
dist/playstore/
  listing.json        # { title (≤30 chars), shortDescription (≤80), fullDescription (≤4000), keywords: string[] }
  screenshots/        # copies of the selected raw PNGs, named 01.png, 02.png ...
dist/metadata/store-listing.json   # keep writing this too (backward compat)
```
Generate text deterministically from the app name and screen count, e.g. title = app name; shortDescription = `"<AppName> — built with care. Explore <N> beautifully crafted screens."` Truncate to the char limits with a helper. No AI, no lorem ipsum.

Add each playstore file to `manifest.assets` with `target: "playstore"`.

**Tests:** extend `packages/publisher/src/readme.test.ts` pattern — run `publishDist` against a temp dir with 2 fake nodes, assert `playstore/listing.json` parses, char limits hold, `playstore/screenshots/01.png` exists.

### Task B3 — Real Flutter support (Flutter → Android APK path)

**Create:** `packages/builder/src/build-flutter-apk.ts`, export from `packages/builder/src/index.ts`.

```ts
export async function buildFlutterApk(projectDir: string): Promise<BuildDebugApkResult>
```
1. Detect flutter binary: `where flutter` / `which flutter` (same pattern as `findSystemGradle()` in `gradle-wrapper.ts`). Throw `HoneyPieError` code `BUILDER_FLUTTER_MISSING` with message "Flutter SDK not found on PATH" if absent.
2. Run `flutter build apk --debug` in `projectDir` (`shell: true` on win32, `maxBuffer` 64 MB, surface last-40-lines on failure — copy the `tail`/`errorOutput` helpers from `build-apk.ts`).
3. APK lands at `build/app/outputs/flutter-apk/app-debug.apk`.
4. `packageName`: parse `applicationId` from `android/app/build.gradle` or `build.gradle.kts` (try both; regex `applicationId\s*[=:]?\s*["']([^"']+)["']`). `mainActivity`: `<packageName>.MainActivity` (Flutter's default).

**Wire framework detection:** in `packages/cli/src/repo-source.ts` `detectFramework`, ADD `"flutter"` to the union: return `"flutter"` when `pubspec.yaml` exists AND the `android/` subfolder exists (check BEFORE the gradle check, since Flutter projects contain `android/settings.gradle`). In `run-from-repo.ts` and `android-native-pipeline.ts`: for flutter, use `buildFlutterApk` as the builder stage and keep explorer/vision/publisher identical (set manifest framework `"flutter"`). If `BUILDER_FLUTTER_MISSING` is thrown, catch it in `run-from-repo.ts` and fall back to `runLocalOnlyPipeline` — printing `"Flutter SDK not installed — falling back to placeholder assets"` into the returned log path (add a `notes: string[]` to the result if needed).

**Tests:** unit-test the applicationId regex against string fixtures (both groovy and kts syntax). The end-to-end flutter path must skip when `flutter` is not on PATH (rule 4 pattern — check with the same `findSystemBinary` helper).

### Task B4 — Auto-boot an emulator when none is attached

**Create:** `packages/explorer/src/emulator.ts`, export from index.

```ts
export async function ensureDevice(timeoutMs = 180_000): Promise<string /* deviceId */>
```
1. `listDevices()` — if non-empty return first.
2. Resolve emulator binary: `<ANDROID_HOME>/emulator/emulator.exe` (or no `.exe` off-Windows). If missing → throw `HoneyPieError` `EXPLORER_NO_DEVICE` with the existing friendly message.
3. `emulator -list-avds` → take first line; if none → same throw.
4. Spawn DETACHED and unref'd: `spawn(emulatorPath, ["-avd", name, "-no-snapshot-save"], { detached: true, stdio: "ignore" }).unref()`.
5. Poll every 3 s until `listDevices()` non-empty AND `adb -s <id> shell getprop sys.boot_completed` trims to `"1"`, else keep waiting; on timeout throw `EXPLORER_EMULATOR_BOOT_TIMEOUT`.

Replace the preflight `listDevices()` check in `android-native-pipeline.ts` with `ensureDevice()`.

**Tests:** none automatable without hardware — verify manually if an emulator exists; otherwise commit with the not-device-verified note.

### Task B5 — Exploration robustness

**File:** `packages/explorer/src/explore.ts` (+ test additions)

Three changes, keep everything else identical:
1. **Don't escape the app:** `exploreScreens` gains optional `packageName?: string`. After every `pressBack()`, if `packageName` is set and `isProcessRunning(packageName)` is false, call `launchApp` again (import from `adb.ts`; you'll need `mainActivity` too — accept optional `relaunch?: { packageName: string; mainActivity: string }` instead and use that). Pass it from `android-native-pipeline.ts`.
2. **Scroll before giving up:** when there is no unvisited tappable, before pressing back, do ONE swipe-up (`adb shell input swipe 540 1600 540 600 300` — add a `swipe()` helper to `adb.ts`) and re-dump; only back out if the fingerprint didn't change.
3. **Loop guard:** if the same fingerprint is seen more than 5 consecutive iterations, break the loop (prevents infinite back-and-forth).

**Tests:** fingerprint/parse logic is already tested; add a pure-function test if you extract the swipe-decision into one. Device behavior: manual-verify note.

### Task C1 — Signing hook (config only)

In `apps/desktop/src-tauri/tauri.conf.json` add:
```json
"bundle": { ...existing..., "windows": { "certificateThumbprint": null, "digestAlgorithm": "sha256", "timestampUrl": "http://timestamp.digicert.com" } }
```
In `.github/workflows/release.yml`, before the tauri build step, add a commented-out block showing how to import a PFX from secrets (`WINDOWS_CERT_PFX_BASE64`, `WINDOWS_CERT_PASSWORD`) and set the thumbprint. Add `docs/28-code-signing.md` explaining: unsigned MSI ⇒ SmartScreen warning; buying an OV/EV cert is a human task; where to paste the thumbprint.

### Task C2 — npm publish workflow for the CLI

`.github/workflows/publish-npm.yml`, trigger `workflow_dispatch`. Steps: checkout, pnpm+node setup with `registry-url: https://registry.npmjs.org`, `pnpm install --frozen-lockfile`, `pnpm run build`, then `cd packages/cli && npm publish --access public` with `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`. First remove `"private": true` from `packages/cli/package.json` if present (check), set `"name": "honeypie-cli"` ONLY IF the `@honeypie` scope is unavailable — otherwise leave the name alone. Also ensure `files: ["dist"]` and a `prepublishOnly: "pnpm run build"` script. Note in docs that `NPM_TOKEN` must be added to repo secrets by a human.

### Task C3 — Docs truth pass

Update `README.md` Status section and `HONEYPIE.md` so every claim matches reality after your tasks: Flutter = real when Flutter SDK present (APK path), vision = heuristic filter (not AI), copywriter = deterministic templates, signing = pending cert. Do not oversell. Keep the existing screenshots/images.

---

## 7. Definition of DONE (shipping checklist)

- [ ] A tag push produces a GitHub Release with a downloadable MSI
- [ ] Desktop app streams live progress and can cancel a run
- [ ] Repo-URL runs land in `Downloads/HoneyPie/<repo>` and open-folder works
- [ ] Missing git/SDK produce friendly in-app guidance, not stack traces
- [ ] Duplicate/blank screenshots are filtered with counts in the manifest
- [ ] `dist/playstore/` exists with valid listing.json + numbered screenshots
- [ ] A Flutter project with Flutter SDK installed gets REAL screenshots via the APK path; without the SDK it falls back loudly, not silently
- [ ] Pipeline auto-boots `star_trail_emu`-style AVDs when no device is attached
- [ ] Exploration never permanently exits the app under test
- [ ] `pnpm run build && pnpm run test && pnpm run typecheck && pnpm run lint:boundaries` all green on a machine WITHOUT Android SDK (simulate: unset ANDROID_HOME/ANDROID_SDK_ROOT)
- [ ] README/docs make no claim the product doesn't meet

## 8. If you get stuck

- Build fails with `Cannot find module '@honeypie/core'` → run `pnpm run build` from repo root first (turbo builds deps in order), and check you added the workspace dep (§5 rule 3).
- `spawn EINVAL` on Windows → you forgot `shell: true` (§5 rule 2).
- TS error mentioning `exactOptionalPropertyTypes` → use the spread pattern (§5 rule 1).
- Test fails only in CI → you violated rule 4 (missing SDK/device skip).
- esbuild bundle error in `desktop:build` → you added a dependency the bundler can't inline; remove it (§5 rule 5).
- Do NOT delete or regenerate `pnpm-lock.yaml` wholesale; only change it via `pnpm install` after editing a package.json.
