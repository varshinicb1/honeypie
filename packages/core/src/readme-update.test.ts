import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import { runLocalOnlyPipeline } from "./index.js";

let tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs = [];
});

async function tempAndroidProject(readme: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "honeypie-readme-"));
  tempDirs.push(dir);
  await mkdir(join(dir, "app"), { recursive: true });
  await writeFile(join(dir, "settings.gradle.kts"), "rootProject.name = \"Readme Demo\"\ninclude(\":app\")\n");
  await writeFile(join(dir, "README.md"), readme);
  return dir;
}

async function tempNestedFlutterProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "honeypie-nested-"));
  tempDirs.push(dir);
  await mkdir(join(dir, "apps", "mobile", "lib"), { recursive: true });
  await writeFile(join(dir, "README.md"), "# Root Product\n\nRepository overview.\n");
  await writeFile(join(dir, "apps", "mobile", "pubspec.yaml"), "name: nested_mobile\ndescription: Nested app\n");
  await writeFile(join(dir, "apps", "mobile", "lib", "main.dart"), "void main() {}\n");
  return dir;
}

describe("README export target", () => {
  test("writes a readme mockup asset and inserts a guarded README block", async () => {
    const projectRoot = await tempAndroidProject("# Readme Demo\n\nExisting project notes.\n");

    const result = await runLocalOnlyPipeline({ projectRoot, cliOverrides: { localOnly: true, destination: "dist" } });

    const readme = await readFile(join(projectRoot, "README.md"), "utf8");
    const asset = await readFile(join(projectRoot, "dist", "readme", "hero.svg"), "utf8");
    expect(result.manifest.assets.some((entry) => entry.path === "readme/hero.svg" && entry.target === "readme")).toBe(true);
    expect(asset).toContain("Readme Demo");
    expect(readme).toContain("Existing project notes.");
    expect(readme).toContain("<!-- honeypie:start -->");
    expect(readme).toContain("![Readme Demo app mockup](dist/readme/hero.svg)");
    expect(readme).toContain("<!-- honeypie:end -->");
  });

  test("replaces an existing guarded README block idempotently", async () => {
    const projectRoot = await tempAndroidProject(
      "# Readme Demo\n\n<!-- honeypie:start -->\nold generated content\n<!-- honeypie:end -->\n\nManual section.\n"
    );

    await runLocalOnlyPipeline({ projectRoot, cliOverrides: { localOnly: true, destination: "dist" } });
    await runLocalOnlyPipeline({ projectRoot, cliOverrides: { localOnly: true, destination: "dist" } });

    const readme = await readFile(join(projectRoot, "README.md"), "utf8");
    expect(readme).not.toContain("old generated content");
    expect(readme.match(/<!-- honeypie:start -->/g)).toHaveLength(1);
    expect(readme).toContain("Manual section.");
  });

  test("detects nested mobile projects while updating the repository README", async () => {
    const projectRoot = await tempNestedFlutterProject();

    const result = await runLocalOnlyPipeline({ projectRoot, cliOverrides: { localOnly: true, destination: "dist" } });

    const readme = await readFile(join(projectRoot, "README.md"), "utf8");
    expect(result.manifest.app.framework).toBe("flutter");
    expect(result.manifest.app.appName).toBe("Nested Mobile");
    expect(readme).toContain("Repository overview.");
    expect(readme).toContain("![Nested Mobile app mockup](dist/readme/hero.svg)");
  });
});
