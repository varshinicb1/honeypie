import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import { runCli } from "./index.js";

let tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs = [];
});

async function tempFlutterProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "honeypie-cli-"));
  tempDirs.push(dir);
  await mkdir(join(dir, "lib"), { recursive: true });
  await writeFile(join(dir, "pubspec.yaml"), "name: cli_counter\ndescription: CLI fixture\n");
  await writeFile(join(dir, "lib", "main.dart"), "void main() {}\n");
  return dir;
}

describe("runCli", () => {
  test("runs non-interactive local-only pipeline", async () => {
    const cwd = await tempFlutterProject();
    const result = await runCli(["run", "--yes", "--local-only", "--dest", "dist"], { cwd });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("dist/honeypie.json");
    const manifest = JSON.parse(await readFile(join(cwd, "dist", "honeypie.json"), "utf8"));
    expect(manifest.app.appName).toBe("Cli Counter");
  });
});
