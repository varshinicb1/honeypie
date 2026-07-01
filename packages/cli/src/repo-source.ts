import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { HoneyPieError } from "@honeypie/core";

const execFileAsync = promisify(execFile);

export interface CloneRepoOptions {
  url: string;
  cacheRoot?: string;
}

export interface CloneRepoResult {
  projectDir: string;
}

/** Validates the string is a plausible git remote URL, not a local path or shell-meaningful value. */
function isValidRepoUrl(url: string): boolean {
  return /^(https:\/\/|git@)[\w.-]+[/:][\w./-]+?(\.git)?\/?$/.test(url.trim());
}

function slugFor(url: string): string {
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 10);
  const name = url
    .trim()
    .replace(/\.git$/, "")
    .split(/[/:]/)
    .slice(-2)
    .join("-")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${name}-${hash}`;
}

/**
 * Shallow-clones a git repository into a cache directory keyed by URL, so re-running against
 * the same repo doesn't re-clone. Re-clones from scratch if the cached checkout is corrupt.
 */
export async function cloneRepo(options: CloneRepoOptions): Promise<CloneRepoResult> {
  const url = options.url.trim();
  if (!isValidRepoUrl(url)) {
    throw new HoneyPieError(`"${url}" doesn't look like a valid git repository URL (expected an https:// or git@ URL)`, "REPO_URL_INVALID", {
      url
    });
  }

  const cacheRoot = options.cacheRoot ?? join(tmpdir(), "honeypie-repos");
  await mkdir(cacheRoot, { recursive: true });
  const projectDir = join(cacheRoot, slugFor(url));

  if (existsSync(join(projectDir, ".git"))) {
    return { projectDir };
  }
  await rm(projectDir, { recursive: true, force: true });

  try {
    // core.longpaths avoids spurious clone failures on Windows for repos with deeply nested
    // paths (e.g. iOS CocoaPods artifacts) exceeding the legacy 260-character path limit.
    await execFileAsync("git", ["clone", "--depth", "1", "-c", "core.longpaths=true", url, projectDir], {
      maxBuffer: 1024 * 1024 * 64
    });
  } catch (error) {
    const record = error as { stdout?: string; stderr?: string; message?: string };
    throw new HoneyPieError(
      `Failed to clone ${url}: ${record.stderr || record.message || String(error)}`,
      "REPO_CLONE_FAILED",
      { url }
    );
  }

  return { projectDir };
}

export type DetectedFramework = "android-native" | "unknown";

/** Cheap, file-presence-based detection of which real pipeline (if any) applies. */
export function detectFramework(projectDir: string): DetectedFramework {
  if (existsSync(join(projectDir, "settings.gradle.kts")) || existsSync(join(projectDir, "settings.gradle"))) {
    return "android-native";
  }
  return "unknown";
}
