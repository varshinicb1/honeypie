import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { updateReadme } from "./readme.js";

describe("updateReadme", () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "honeypie-readme-"));
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("is idempotent across repeated runs", async () => {
    const opts = { projectRoot, appName: "Demo", destinationName: "dist", assetPath: "mockups/screen-0.svg" };
    await updateReadme(opts);
    await updateReadme(opts);
    const readme = await readFile(join(projectRoot, "README.md"), "utf8");
    expect((readme.match(/honeypie:start/g) ?? []).length).toBe(1);
    expect((readme.match(/honeypie:end/g) ?? []).length).toBe(1);
    expect(readme).toContain("dist/mockups/screen-0.svg");
  });
});
