import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative, win32 } from "node:path";
import { runLocalOnlyPipeline, type ConfigCliOverrides, defaultConfig } from "@honeypie/core";
import { spawnSync } from "node:child_process";
import { runAndroidNativePipeline } from "./android-native-pipeline.js";
import { runFromRepo } from "./run-from-repo.js";

export interface CliEnvironment {
  cwd: string;
}

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runCli(argv: string[], env: CliEnvironment = { cwd: process.cwd() }): Promise<CliResult> {
  const [command = "run", ...rest] = argv.length === 0 ? ["run", "--interactive"] : argv;
  try {
    if (command === "run" || command === "ship") {
      const args = command === "ship" ? ["--yes", ...rest] : rest;
      const parsed = parseRunArgs(args);
      if (parsed.interactive) {
        return { exitCode: 0, stdout: "HoneyPie TUI is not implemented yet; use honeypie run --yes --local-only.\n", stderr: "" };
      }
      if (parsed.repoUrl) {
        const result = await runFromRepo({
          url: parsed.repoUrl,
          cliOverrides: parsed.overrides,
          ...(parsed.overrides.maxScreens !== undefined ? { maxNodes: parsed.overrides.maxScreens } : {})
        });
        const manifestPath = join(result.destination, "honeypie.json").replace(/\\/g, "/");
        return {
          exitCode: 0,
          stdout: `Cloned ${parsed.repoUrl}\nDetected framework: ${result.framework}\nGenerated ${manifestPath}\n`,
          stderr: ""
        };
      }
      const result = parsed.androidNative
        ? await runAndroidNativePipeline({
            projectRoot: env.cwd,
            destination: join(env.cwd, parsed.overrides.destination ?? defaultConfig.destination),
            ...(parsed.overrides.maxScreens !== undefined ? { maxNodes: parsed.overrides.maxScreens } : {})
          })
        : await runLocalOnlyPipeline({ projectRoot: env.cwd, cliOverrides: parsed.overrides });
      const manifestPath = relative(env.cwd, join(result.destination, "honeypie.json")).replace(/\\/g, "/");
      return { exitCode: 0, stdout: `Generated ${manifestPath}\nUpdated README.md with HoneyPie mockup block\n`, stderr: "" };
    }
    if (command === "doctor") {
      return runDoctor();
    }
    if (command === "config" && rest[0] === "init") {
      const path = join(env.cwd, "honeypie.config.json");
      await writeFile(path, `${JSON.stringify(defaultConfig, null, 2)}\n`, { flag: "wx" });
      return { exitCode: 0, stdout: "Created honeypie.config.json\n", stderr: "" };
    }
    return { exitCode: 1, stdout: "", stderr: `Unknown command: ${command}\n` };
  } catch (error) {
    return { exitCode: "code" in asRecord(error) && asRecord(error).code === "CONFIG_INVALID" ? 10 : 1, stdout: "", stderr: `${formatError(error)}\n` };
  }
}

function parseRunArgs(argv: string[]): { interactive: boolean; androidNative: boolean; repoUrl?: string; overrides: ConfigCliOverrides } {
  const overrides: ConfigCliOverrides = {};
  let interactive = argv.length === 0;
  let androidNative = false;
  let repoUrl: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--interactive":
        interactive = true;
        break;
      case "--yes":
        interactive = false;
        break;
      case "--android-native":
        androidNative = true;
        break;
      case "--repo":
        repoUrl = requireValue(argv, ++index, "--repo");
        interactive = false;
        break;
      case "--local-only":
        overrides.localOnly = true;
        break;
      case "--dest":
        overrides.destination = requireValue(argv, ++index, "--dest");
        break;
      case "--provider":
        overrides.provider = requireValue(argv, ++index, "--provider");
        break;
      case "--outputs":
        overrides.outputs = requireValue(argv, ++index, "--outputs").split(",").filter(Boolean);
        break;
      case "--theme":
        overrides.theme = requireValue(argv, ++index, "--theme").split(",").filter(Boolean);
        break;
      case "--max-screens":
        overrides.maxScreens = Number(requireValue(argv, ++index, "--max-screens"));
        break;
      case "--time-budget":
        overrides.timeBudget = requireValue(argv, ++index, "--time-budget");
        break;
      default:
        if (arg?.startsWith("--")) {
          throw new Error(`Unsupported option: ${arg}`);
        }
    }
  }
  return { interactive, androidNative, ...(repoUrl !== undefined ? { repoUrl } : {}), overrides };
}

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

async function runDoctor(): Promise<CliResult> {
  const checks = [
    checkCommand("node", ["--version"], "Node.js"),
    checkCommand("pnpm", ["--version"], "pnpm"),
    checkCommand("flutter", ["--version"], "Flutter"),
    checkCommand(resolveAndroidTool("adb") ?? "adb", ["version"], "Android Debug Bridge"),
    checkCommand(resolveAndroidTool("emulator") ?? "emulator", ["-version"], "Android emulator")
  ];
  const failed = checks.filter((check) => !check.ok);
  const stdout = checks.map((check) => `${check.ok ? "ok" : "missing"} ${check.label}${check.detail ? ` - ${check.detail}` : ""}`).join("\n") + "\n";
  return { exitCode: failed.length === 0 ? 0 : 2, stdout, stderr: failed.length === 0 ? "" : "Environment is missing required Android tooling.\n" };
}

export interface ToolResolverFs {
  exists(path: string): boolean;
}

export function resolveAndroidTool(
  tool: "adb" | "emulator",
  env: NodeJS.ProcessEnv = process.env,
  fs: ToolResolverFs = { exists: existsSync }
): string | null {
  // Always join using Windows path semantics, not the platform-dependent `join` from
  // "node:path": this product only ever ships/runs on Windows, and ANDROID_HOME/ANDROID_SDK_ROOT
  // values (and this function's tests) use Windows-style paths regardless of what OS the code
  // happens to execute on (e.g. CI runs this test suite on Linux, where the platform-dependent
  // `join` treats backslashes as literal characters instead of separators and silently produces
  // a path that never matches on disk).
  const executable = `${tool}.exe`;
  const sdkRoots = [env.ANDROID_HOME, env.ANDROID_SDK_ROOT]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => uniqueCaseVariants(value));
  const relativePath = tool === "adb" ? win32.join("platform-tools", executable) : win32.join("emulator", executable);
  for (const sdkRoot of sdkRoots) {
    const candidate = win32.join(sdkRoot, relativePath);
    if (fs.exists(candidate)) return candidate;
  }
  return null;
}

function uniqueCaseVariants(path: string): string[] {
  const variants = [path];
  if (path.includes("\\Sdk")) variants.push(path.replace("\\Sdk", "\\sdk"));
  if (path.includes("\\sdk")) variants.push(path.replace("\\sdk", "\\Sdk"));
  return [...new Set(variants)];
}

function checkCommand(command: string, args: string[], label: string): { label: string; ok: boolean; detail: string } {
  const result = spawnSync(command, args, { encoding: "utf8", shell: true, timeout: 10_000 });
  const detail = (result.stdout || result.stderr || "").split(/\r?\n/)[0]?.trim() ?? "";
  return { label, ok: result.status === 0, detail };
}

function formatError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}
