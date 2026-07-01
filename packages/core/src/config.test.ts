import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import { ConfigError, loadConfig } from "./index.js";

let tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs = [];
});

async function tempProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "honeypie-config-"));
  tempDirs.push(dir);
  return dir;
}

describe("loadConfig", () => {
  test("returns schema-valid zero-config defaults", async () => {
    const projectRoot = await tempProject();

    const config = await loadConfig({ projectRoot, cliOverrides: { localOnly: true } });

    expect(config.destination).toBe("dist");
    expect(config.ai.mode).toBe("local");
    expect(config.exploration.maxScreens).toBe(60);
    expect(config.themes).toEqual(["clean", "premium", "glass"]);
  });

  test("deep merges local config below shared config and CLI overrides above both", async () => {
    const projectRoot = await tempProject();
    await writeFile(
      join(projectRoot, "honeypie.config.local.json"),
      JSON.stringify({ destination: "local-dist", exploration: { maxScreens: 5 }, ai: { mode: "local" } })
    );
    await writeFile(
      join(projectRoot, "honeypie.config.json"),
      JSON.stringify({ destination: "shared-dist", exploration: { timeBudget: "2m" } })
    );

    const config = await loadConfig({
      projectRoot,
      cliOverrides: { destination: "cli-dist", maxScreens: 7 }
    });

    expect(config.destination).toBe("cli-dist");
    expect(config.exploration.timeBudget).toBe("2m");
    expect(config.exploration.maxScreens).toBe(7);
    expect(config.ai.mode).toBe("local");
  });

  test("throws ConfigError with field path for invalid config", async () => {
    const projectRoot = await tempProject();
    await writeFile(join(projectRoot, "honeypie.config.json"), JSON.stringify({ exploration: { maxScreens: 0 } }));

    await expect(loadConfig({ projectRoot })).rejects.toMatchObject({
      name: "ConfigError",
      code: "CONFIG_INVALID"
    } satisfies Partial<ConfigError>);
  });
});
