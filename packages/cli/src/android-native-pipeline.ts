import { join } from "node:path";
import { buildDebugApk } from "@honeypie/builder";
import {
  exploreScreens,
  installApk,
  isProcessRunning,
  launchApp,
  listDevices,
  type ExplorationResult
} from "@honeypie/explorer";
import { publishDist } from "@honeypie/publisher";
import { HoneyPieError, PipelineOrchestrator, type HoneyPieManifest, type PipelineStage } from "@honeypie/core";

export interface RunAndroidNativePipelineOptions {
  projectRoot: string;
  destination: string;
  maxNodes?: number;
  maxDurationMs?: number;
}

export interface AndroidNativePipelineResult {
  manifest: HoneyPieManifest;
  destination: string;
}

interface BuilderArtifact {
  apkPath: string;
  packageName: string;
  mainActivity: string;
  deviceId: string;
}

export async function runAndroidNativePipeline(
  options: RunAndroidNativePipelineOptions
): Promise<AndroidNativePipelineResult> {
  const destination = options.destination;
  const maxNodes = options.maxNodes ?? 8;
  const maxDurationMs = options.maxDurationMs ?? 60_000;

  const stages: PipelineStage[] = [
    {
      name: "builder",
      run: async (): Promise<BuilderArtifact> => {
        const devices = await listDevices();
        if (devices.length === 0) {
          throw new HoneyPieError(
            "No Android device/emulator attached. Run `adb devices` to check, then start an emulator or connect a device before running HoneyPie.",
            "EXPLORER_NO_DEVICE"
          );
        }
        const built = await buildDebugApk(options.projectRoot);
        return { ...built, deviceId: devices[0] ?? "" };
      }
    },
    {
      name: "explorer",
      run: async (ctx): Promise<ExplorationResult> => {
        const builder = ctx.builder as BuilderArtifact;
        await installApk(builder.apkPath, builder.deviceId);
        await launchApp(builder.packageName, builder.mainActivity, builder.deviceId);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const running = await isProcessRunning(builder.packageName, builder.deviceId);
        if (!running) {
          throw new HoneyPieError(
            `${builder.packageName} did not stay running after launch — it likely crashed on startup.`,
            "EXPLORER_APP_CRASHED",
            { packageName: builder.packageName }
          );
        }
        return exploreScreens({
          deviceId: builder.deviceId,
          maxNodes,
          maxDurationMs,
          cacheDir: join(options.projectRoot, ".honeypie", "cache")
        });
      }
    },
    {
      name: "publisher",
      run: async (ctx): Promise<HoneyPieManifest> => {
        const builder = ctx.builder as BuilderArtifact;
        const exploration = ctx.explorer as ExplorationResult;
        return publishDist({
          destination,
          app: {
            framework: "android-native",
            packageName: builder.packageName,
            appName: titleCaseFromPackage(builder.packageName)
          },
          nodes: exploration.nodes,
          exploration: {
            screensDiscovered: exploration.stats.nodesDiscovered,
            durationMs: exploration.stats.durationMs
          },
          aiUsage: { provider: "none", totalTokens: 0, estimatedCostUsd: 0 }
        });
      }
    }
  ];

  const run = await new PipelineOrchestrator({ projectRoot: options.projectRoot, stages }).run();
  return { manifest: run.context.publisher as HoneyPieManifest, destination };
}

function titleCaseFromPackage(packageName: string): string {
  const last = packageName.split(".").pop() ?? packageName;
  return last
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
