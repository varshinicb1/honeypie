export type PluginType =
  | "FrameworkDetector"
  | "ExplorationStrategy"
  | "VisionScorer"
  | "Copywriter"
  | "RenderTheme"
  | "ExportTarget";

export interface PluginManifest {
  id: string;
  type: PluginType;
  version: string;
  sdkVersion: string;
  entry: string;
  displayName?: string;
  description?: string;
}

export interface FrameworkDetector {
  id: string;
  priority: number;
  detect(repoPath: string): Promise<DetectionResult | null>;
}

export interface DetectionResult {
  framework: "flutter" | "android-native" | "react-native" | "ionic" | "expo" | string;
  packageName: string;
  appName: string;
  iconPath?: string;
  buildSystem: "gradle" | "flutter-cli" | "metro" | "eas" | string;
  platforms: ("android" | "ios")[];
  confidence: number;
}

export interface DeviceSession {
  id: string;
  platform: "android" | "ios";
}

export interface ExploreOptions {
  timeBudget: string;
  maxScreens: number;
  exclusions: string[];
}

export interface NavigationGraph {
  nodes: NavigationNode[];
  edges: NavigationEdge[];
  stats: {
    nodesDiscovered: number;
    edgesTraversed: number;
    durationMs: number;
    budgetExhausted: boolean;
  };
}

export interface NavigationNode {
  id: string;
  label: string;
  screenType: string;
  fingerprint: string;
  capturePaths: string[];
}

export interface NavigationEdge {
  from: string;
  to: string;
  action: string;
  target: string;
}

export interface ExplorationStrategy {
  id: string;
  explore(session: DeviceSession, opts: ExploreOptions): Promise<NavigationGraph>;
}

export interface Screenshot {
  id: string;
  path: string;
  width: number;
  height: number;
}

export interface ScreenContext {
  node: NavigationNode;
}

export interface VisionScorer {
  id: string;
  score(shot: Screenshot, ctx: ScreenContext): Promise<ScoreResult>;
}

export interface ScoreResult {
  score: number;
  dimensions: {
    visualQuality: number;
    clutter: number;
    readability: number;
    aesthetic: number;
  };
  rejected: boolean;
  rejectionReason?: "loading-state" | "empty-state" | "dialog-open" | "keyboard-visible" | "duplicate" | "low-quality" | string;
}

export interface CopyContext {
  appName: string;
  graph: NavigationGraph;
}

export interface CopyResult {
  headline: string;
  subtitle: string;
  descriptions: Record<string, string>;
  captions: Record<string, string>;
}

export interface Copywriter {
  id: string;
  generate(ctx: CopyContext): Promise<CopyResult>;
}

export interface SelectedScreenshot extends Screenshot {
  sourceNodeId: string;
  score: ScoreResult;
}

export interface RenderSpec {
  width: number;
  height: number;
  target: string;
}

export interface RenderedAsset {
  path: string;
  sourceScreen: string;
  theme: string;
  target: string;
  width: number;
  height: number;
}

export interface RenderTheme {
  id: string;
  displayName: string;
  render(shot: SelectedScreenshot, spec: RenderSpec): Promise<RenderedAsset>;
}

export interface AssetDimension {
  name: string;
  width: number;
  height: number;
  minCount: number;
  maxCount: number;
}

export interface ExportContext {
  destination: string;
}

export interface ExportedBundle {
  target: string;
  assets: string[];
}

export interface ExportTarget {
  id: string;
  requiredDimensions: AssetDimension[];
  export(assets: RenderedAsset[], ctx: ExportContext): Promise<ExportedBundle>;
}
