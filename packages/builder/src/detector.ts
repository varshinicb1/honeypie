import { readFile, readdir, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";

// ─── Public types ───────────────────────────────────────────────────────────

export type FrameworkKind = "flutter" | "android-native";
export type BuildSystem = "flutter-cli" | "gradle";

export interface DetectionResult {
  framework: FrameworkKind;
  packageName: string;
  appName: string;
  buildSystem: BuildSystem;
  platforms: ("android" | "ios")[];
  confidence: number;
  srcFolders: string[];
  routes: string[];
}

// ─── Flutter detector ───────────────────────────────────────────────────────

export async function detectFlutter(projectRoot: string): Promise<DetectionResult | null> {
  const pubspecPath = await findFileUp(projectRoot, "pubspec.yaml", 3);
  if (!pubspecPath) return null;

  const pubspec = await readFile(pubspecPath, "utf8");
  const name = matchYamlScalar(pubspec, "name") ?? basename(projectRoot);
  const description = matchYamlScalar(pubspec, "description") ?? "";

  const libDir = join(projectRoot, "lib");
  const srcFolders = await discoverSrcFolders(libDir, ".dart");
  const routes = await discoverFlutterRoutes(libDir);

  const platforms: ("android" | "ios")[] = [];
  if (await dirExists(join(projectRoot, "android"))) platforms.push("android");
  if (await dirExists(join(projectRoot, "ios"))) platforms.push("ios");

  return {
    framework: "flutter",
    packageName: `dev.honeypie.${sanitizePackageName(name)}`,
    appName: titleCase(name),
    buildSystem: "flutter-cli",
    platforms,
    confidence: 95,
    srcFolders,
    routes,
  };
}

// ─── Android native detector ────────────────────────────────────────────────

export async function detectAndroidNative(projectRoot: string): Promise<DetectionResult | null> {
  const gradlePath = await findFirstFile(projectRoot, [
    "settings.gradle.kts",
    "settings.gradle",
  ]);
  if (!gradlePath) return null;

  const gradleContent = await readFile(gradlePath, "utf8");
  const name =
    matchGradleAssignment(gradleContent, "rootProject.name") ?? basename(projectRoot);

  // Scan for source folders
  const appSrc = join(projectRoot, "app", "src", "main");
  const javaSrc = join(appSrc, "java");
  const kotlinSrc = join(appSrc, "kotlin");

  const srcFolders: string[] = [];
  if (await dirExists(javaSrc)) srcFolders.push(...(await discoverSrcFolders(javaSrc, ".java")));
  if (await dirExists(kotlinSrc)) srcFolders.push(...(await discoverSrcFolders(kotlinSrc, ".kt")));
  if (srcFolders.length === 0 && (await dirExists(appSrc))) {
    srcFolders.push(...(await discoverSrcFolders(appSrc, ".kt")));
    srcFolders.push(...(await discoverSrcFolders(appSrc, ".java")));
  }

  const routes = await discoverAndroidRoutes(projectRoot);

  return {
    framework: "android-native",
    packageName: `dev.honeypie.${sanitizePackageName(name)}`,
    appName: titleCase(name),
    buildSystem: "gradle",
    platforms: ["android"],
    confidence: 90,
    srcFolders,
    routes,
  };
}

// ─── Auto-detect (tries all detectors in priority order) ────────────────────

export async function detectFramework(projectRoot: string): Promise<DetectionResult> {
  const flutter = await detectFlutter(projectRoot);
  if (flutter) return flutter;

  const android = await detectAndroidNative(projectRoot);
  if (android) return android;

  throw new Error(
    `No supported mobile framework detected in ${projectRoot}. ` +
      `Expected pubspec.yaml (Flutter) or settings.gradle (Android).`
  );
}

// ─── Route discovery ────────────────────────────────────────────────────────

async function discoverFlutterRoutes(libDir: string): Promise<string[]> {
  const routes: string[] = [];
  const dartFiles = await findFilesRecursive(libDir, ".dart", 8);

  for (const file of dartFiles) {
    try {
      const content = await readFile(file, "utf8");
      // Match MaterialPageRoute, GoRoute path definitions, Navigator.pushNamed
      const routePatterns = [
        /MaterialPageRoute\s*<[^>]*>?\s*\(\s*builder/g,
        /GoRoute\s*\(\s*path\s*:\s*['"]([^'"]+)['"]/g,
        /Navigator\.pushNamed\s*\([^,]+,\s*['"]([^'"]+)['"]/g,
        /routes\s*:\s*\{[^}]*['"]([^'"]+)['"]\s*:/g,
        /(\/[a-z][a-z0-9_-]*)(?=['"\s,)])/g,
      ];

      for (const pattern of routePatterns) {
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(content)) !== null) {
          const route = match[1];
          if (route && route.startsWith("/") && route.length > 1 && route.length < 50) {
            routes.push(route);
          }
        }
      }
    } catch {
      // skip unreadable files
    }
  }

  return [...new Set(routes)];
}

async function discoverAndroidRoutes(projectRoot: string): Promise<string[]> {
  const routes: string[] = [];
  const manifestPath = join(projectRoot, "app", "src", "main", "AndroidManifest.xml");

  try {
    const manifest = await readFile(manifestPath, "utf8");
    // Find activity declarations
    const activityPattern = /android:name="([^"]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = activityPattern.exec(manifest)) !== null) {
      const name = match[1];
      if (name && !name.includes("$")) {
        routes.push(name.split(".").pop() ?? name);
      }
    }
  } catch {
    // manifest not found, try scanning kotlin/java files
  }

  return [...new Set(routes)];
}

// ─── Source folder discovery ────────────────────────────────────────────────

async function discoverSrcFolders(root: string, ext: string): Promise<string[]> {
  const folders: string[] = [];
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const hasFiles = entries.some((e) => e.isFile() && extname(e.name) === ext);
    if (hasFiles) folders.push(root);

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        const sub = await discoverSrcFolders(join(root, entry.name), ext);
        folders.push(...sub);
      }
    }
  } catch {
    // directory doesn't exist or unreadable
  }
  return folders;
}

// ─── File system helpers ────────────────────────────────────────────────────

async function findFileUp(root: string, filename: string, maxDepth: number): Promise<string | null> {
  const direct = join(root, filename);
  if (await fileExists(direct)) return direct;

  const nested = await findFilesRecursive(root, filename, maxDepth);
  return nested.find((f) => basename(f) === filename) ?? null;
}

async function findFirstFile(root: string, filenames: string[]): Promise<string | null> {
  for (const name of filenames) {
    const path = join(root, name);
    if (await fileExists(path)) return path;
  }
  return null;
}

async function findFilesRecursive(root: string, extOrName: string, maxDepth: number): Promise<string[]> {
  const ignored = new Set([".git", ".honeypie", "node_modules", "build", "dist", ".dart_tool", ".idea"]);
  const results: string[] = [];

  async function visit(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isFile()) {
        if (entry.name === extOrName || extname(entry.name) === extOrName) {
          results.push(fullPath);
        }
      }
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || ignored.has(entry.name)) continue;
      await visit(join(dir, entry.name), depth + 1);
    }
  }

  await visit(root, 0);
  return results;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isFile();
  } catch {
    return false;
  }
}

async function dirExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

// ─── String helpers ─────────────────────────────────────────────────────────

function matchYamlScalar(source: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^${escaped}:\\s*([^\\r\\n#]+)`, "m").exec(source);
  return match?.[1]?.trim().replace(/^["']|["']$/g, "") ?? null;
}

function matchGradleAssignment(source: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*=\\s*["']([^"']+)["']`).exec(source);
  return match?.[1]?.trim() ?? null;
}

function sanitizePackageName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
