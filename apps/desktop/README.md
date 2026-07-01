# HoneyPie Desktop

A one-click installable Windows app (built with [Tauri](https://tauri.app)) that wraps the HoneyPie CLI. It bundles a portable Node.js runtime as a sidecar binary, so the installed app runs the real local-only pipeline with **no Node, pnpm, or Rust required on the end user's machine**.

The Android-native pipeline still requires the Android SDK and an emulator/device on the machine — that dependency can't be bundled into a lightweight installer. This app's one-click "Run" button uses the local-only pipeline, which has zero external dependencies.

## Building the installer

The Node sidecar binary is gitignored (it's ~95MB and platform-specific — don't commit it). Before building, populate `src-tauri/binaries/`:

```bash
# From apps/desktop/
mkdir -p src-tauri/binaries
cp "$(which node)" src-tauri/binaries/node-x86_64-pc-windows-msvc.exe   # Windows x64
# For other targets, name the copy `node-<rustc-target-triple>[.exe]`
# (find your triple with: rustc -Vv | grep host)
```

Then install deps and build:

```bash
npm install
npm run tauri build --bundles msi
```

The MSI is produced at `src-tauri/target/release/bundle/msi/HoneyPie_<version>_x64_en-US.msi`.

Note: like virtually all per-machine MSI installers, installing it requires Administrator privileges (Windows enforces this at the MSI format level — Tauri's WiX bundler doesn't currently support a per-user MSI mode). This is standard behavior, not a defect.

## Development

```bash
npm install
npm run tauri dev
```
