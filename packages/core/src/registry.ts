import { PluginCompatibilityError } from "./errors.js";

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

export interface RegisteredPlugin {
  id: string;
  priority?: number;
  [key: string]: unknown;
}

export interface PluginRegistryOptions {
  sdkVersion: string;
}

export class PluginRegistry {
  private readonly plugins = new Map<PluginType, RegisteredPlugin[]>();

  constructor(private readonly options: PluginRegistryOptions) {}

  registerManifest(manifest: PluginManifest, plugin: RegisteredPlugin): void {
    if (!isCompatibleSdkRange(manifest.sdkVersion, this.options.sdkVersion)) {
      throw new PluginCompatibilityError(`Plugin ${manifest.id} requires SDK ${manifest.sdkVersion}, installed ${this.options.sdkVersion}`, {
        pluginId: manifest.id,
        required: manifest.sdkVersion,
        installed: this.options.sdkVersion
      });
    }
    const current = this.plugins.get(manifest.type) ?? [];
    current.push({ ...plugin, id: plugin.id || manifest.id });
    current.sort((a, b) => (Number(b.priority ?? 0) - Number(a.priority ?? 0)));
    this.plugins.set(manifest.type, current);
  }

  resolve(type: PluginType): RegisteredPlugin[] {
    return [...(this.plugins.get(type) ?? [])];
  }
}

function isCompatibleSdkRange(range: string, installed: string): boolean {
  if (range === installed || range === "*") return true;
  const major = installed.split(".")[0];
  return range === `^${major}.0.0` || range.startsWith(`^${major}.`);
}
