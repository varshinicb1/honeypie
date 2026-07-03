// Builder exports from remote (gradle wrapper / build APK)
export { ensureGradleWrapper, type EnsureGradleWrapperResult } from "./gradle-wrapper.js";
export { buildDebugApk, type BuildDebugApkResult } from "./build-apk.js";

// Builder exports from feature branch (detector / runner / device manager)
export { detectFramework, detectFlutter, detectAndroidNative } from "./detector.js";
export type { DetectionResult, FrameworkKind, BuildSystem } from "./detector.js";

export { buildProject, buildFlutterApk, buildGradleApk } from "./build-runner.js";
export type { BuildResult } from "./build-runner.js";

export { DeviceManager } from "./device-manager.js";
export type { DeviceInfo, DeviceManagerOptions } from "./device-manager.js";
