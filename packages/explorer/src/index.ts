// Explorer exports from remote (adb / explore)
export {
  listDevices,
  installApk,
  launchApp,
  isProcessRunning,
  dumpUiXml,
  screencap,
  tap,
  pressBack
} from "./adb.js";
export {
  exploreScreens,
  fingerprintUiXml,
  type ScreenNode,
  type ScreenEdge,
  type ExplorationResult,
  type ExplorationStats,
  type ExploreScreensOptions
} from "./explore.js";

// Explorer exports from feature branch (accessibility / fingerprint / screencap / explorer)
export { parseAccessibilityXml, extractInteractiveElements, rankElements } from "./accessibility.js";
export type { AccessibilityNode, InteractiveElement, ElementType } from "./accessibility.js";

export { fingerprintScreen, isSameScreen } from "./fingerprint.js";

export { captureScreenshot } from "./screencap.js";

export { AutonomousExplorer } from "./explorer.js";
export type { NavigationNode, NavigationEdge, NavigationGraph, ExploreOptions } from "./explorer.js";
export const packageName = "@honeypie/explorer";
