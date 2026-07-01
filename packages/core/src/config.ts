import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { ConfigError } from "./errors.js";

const configSchema = z.object({
  $schema: z.string().optional(),
  outputs: z.array(z.string()).min(1),
  destination: z.string().min(1),
  exploration: z.object({
    timeBudget: z.string().min(1),
    maxScreens: z.number().int().positive(),
    exclusions: z.array(z.string())
  }),
  vision: z.object({
    weights: z.object({
      visualQuality: z.number().positive(),
      clutter: z.number().positive(),
      readability: z.number().positive(),
      aesthetic: z.number().positive()
    }),
    forceInclude: z.array(z.string()),
    forceExclude: z.array(z.string())
  }),
  copy: z.object({
    tone: z.string().min(1),
    language: z.string().min(2)
  }),
  themes: z.array(z.string()).min(1),
  brand: z.object({
    primaryColor: z.string(),
    secondaryColor: z.string(),
    font: z.string(),
    logo: z.string().optional()
  }),
  ai: z.object({
    provider: z.string().min(1),
    mode: z.enum(["cloud", "local"]),
    models: z.record(z.string()),
    redaction: z.object({
      patterns: z.array(z.string()),
      blurRegions: z.array(z.unknown())
    })
  }),
  plugins: z.array(z.string()),
  devices: z.object({
    android: z.string().nullable(),
    ios: z.string().nullable()
  })
});

export type HoneyPieConfig = z.infer<typeof configSchema>;

export interface ConfigCliOverrides {
  destination?: string;
  maxScreens?: number;
  localOnly?: boolean;
  provider?: string;
  outputs?: string[];
  theme?: string[];
  timeBudget?: string;
}

export interface LoadConfigOptions {
  projectRoot: string;
  configPath?: string;
  cliOverrides?: ConfigCliOverrides;
}

export const defaultConfig: HoneyPieConfig = {
  $schema: "https://honeypie.dev/schema/v1/config.json",
  outputs: ["playstore", "appstore", "readme", "website", "opengraph", "social"],
  destination: "dist",
  exploration: {
    timeBudget: "8m",
    maxScreens: 60,
    exclusions: ["Delete Account", "Payment*", "Logout"]
  },
  vision: {
    weights: { visualQuality: 1, clutter: 1, readability: 1, aesthetic: 1 },
    forceInclude: [],
    forceExclude: []
  },
  copy: {
    tone: "professional",
    language: "en"
  },
  themes: ["clean", "premium", "glass"],
  brand: {
    primaryColor: "#FF6B35",
    secondaryColor: "#1A1A2E",
    font: "Inter"
  },
  ai: {
    provider: "anthropic",
    mode: "cloud",
    models: { vision: "claude-sonnet-5", copywriting: "claude-sonnet-5" },
    redaction: { patterns: ["email", "phone"], blurRegions: [] }
  },
  plugins: [],
  devices: {
    android: "Pixel_7_API_34",
    ios: null
  }
};

export async function loadConfig(options: LoadConfigOptions): Promise<HoneyPieConfig> {
  const localConfig = await readJsonIfExists(join(options.projectRoot, "honeypie.config.local.json"));
  const sharedConfig = await readJsonIfExists(options.configPath ?? join(options.projectRoot, "honeypie.config.json"));
  const withFiles = deepMerge(defaultConfig, localConfig, sharedConfig);
  const withCli = applyCliOverrides(withFiles, options.cliOverrides ?? {});
  const parsed = configSchema.safeParse(withCli);
  if (!parsed.success) {
    throw new ConfigError("Invalid HoneyPie configuration", parsed.error.flatten());
  }
  return parsed.data;
}

async function readJsonIfExists(path: string): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

function applyCliOverrides(config: HoneyPieConfig, overrides: ConfigCliOverrides): HoneyPieConfig {
  const next = structuredClone(config);
  if (overrides.destination) next.destination = overrides.destination;
  if (overrides.maxScreens !== undefined) next.exploration.maxScreens = overrides.maxScreens;
  if (overrides.localOnly) next.ai.mode = "local";
  if (overrides.provider) next.ai.provider = overrides.provider;
  if (overrides.outputs) next.outputs = overrides.outputs;
  if (overrides.theme) next.themes = overrides.theme;
  if (overrides.timeBudget) next.exploration.timeBudget = overrides.timeBudget;
  return next;
}

function deepMerge<T>(base: T, ...overlays: unknown[]): T {
  let result: unknown = structuredClone(base);
  for (const overlay of overlays) {
    result = mergeTwo(result, overlay);
  }
  return result as T;
}

function mergeTwo(base: unknown, overlay: unknown): unknown {
  if (!isRecord(base) || !isRecord(overlay)) {
    return overlay === undefined ? base : overlay;
  }
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    merged[key] = key in merged ? mergeTwo(merged[key], value) : value;
  }
  return merged;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
