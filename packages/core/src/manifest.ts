export interface HoneyPieManifest {
  version: "1.0";
  generatedAt: string;
  app: {
    framework: string;
    packageName: string;
    appName: string;
  };
  exploration: {
    screensDiscovered: number;
    durationMs: number;
  };
  vision: {
    captured: number;
    selected: number;
    rejected: number;
  };
  aiUsage: {
    provider: string;
    totalTokens: number;
    estimatedCostUsd: number;
  };
  assets: Array<{
    path: string;
    sourceScreen: string;
    theme?: string;
    target: string;
  }>;
  errors: unknown[];
}
