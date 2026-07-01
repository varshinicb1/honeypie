import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import { runLocalOnlyPipeline } from "./index.js";

let tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs = [];
});

async function tempFlutterProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "honeypie-fixture-"));
  tempDirs.push(dir);
  await mkdir(join(dir, "lib"), { recursive: true });
  await writeFile(join(dir, "pubspec.yaml"), "name: counter_plus\ndescription: Counter Plus fixture\n");
  await writeFile(join(dir, "lib", "main.dart"), "void main() {}\n");
  return dir;
}

describe("runLocalOnlyPipeline", () => {
  test("produces a minimal offline dist for a detected Flutter app", async () => {
    const projectRoot = await tempFlutterProject();

    const result = await runLocalOnlyPipeline({ projectRoot, cliOverrides: { localOnly: true, destination: "dist" } });

    expect(result.manifest.app.framework).toBe("flutter");
    expect(result.manifest.vision.selected).toBeGreaterThan(0);
    const manifest = JSON.parse(await readFile(join(projectRoot, "dist", "honeypie.json"), "utf8"));
    const report = await readFile(join(projectRoot, "dist", "report.html"), "utf8");
    expect(manifest.assets[0].path).toBe("screenshots/home.txt");
    expect(report).toContain("Counter Plus");
    expect(report).not.toContain("http://");
    expect(report).not.toContain("https://");
  });
});
