import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectFlutter, detectAndroidNative, detectFramework } from "./detector.js";

const tempDirs: string[] = [];

afterAll(async () => {
  for (const dir of tempDirs) {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "honeypie-builder-test-"));
  tempDirs.push(dir);
  return dir;
}

describe("Flutter detector", () => {
  test("detects Flutter project from pubspec.yaml", async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, "pubspec.yaml"), "name: my_flutter_app\ndescription: A test app\n");
    await mkdir(join(dir, "lib"), { recursive: true });
    await writeFile(join(dir, "lib", "main.dart"), "void main() {}\n");
    await mkdir(join(dir, "android"), { recursive: true });

    const result = await detectFlutter(dir);
    expect(result).not.toBeNull();
    expect(result!.framework).toBe("flutter");
    expect(result!.appName).toBe("My Flutter App");
    expect(result!.buildSystem).toBe("flutter-cli");
    expect(result!.platforms).toContain("android");
    expect(result!.srcFolders.length).toBeGreaterThan(0);
  });

  test("returns null for non-Flutter project", async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, "package.json"), '{"name":"not-flutter"}');

    const result = await detectFlutter(dir);
    expect(result).toBeNull();
  });

  test("discovers Flutter routes", async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, "pubspec.yaml"), "name: route_app\n");
    await mkdir(join(dir, "lib"), { recursive: true });
    await writeFile(
      join(dir, "lib", "main.dart"),
      `
      import 'package:flutter/material.dart';
      final routes = {
        '/home': (context) => HomeScreen(),
        '/settings': (context) => SettingsScreen(),
      };
    `
    );

    const result = await detectFlutter(dir);
    expect(result).not.toBeNull();
    expect(result!.routes.length).toBeGreaterThan(0);
  });
});

describe("Android native detector", () => {
  test("detects Android project from settings.gradle", async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, "settings.gradle"), "rootProject.name = 'MyAndroidApp'\n");
    await mkdir(join(dir, "app", "src", "main", "java", "com", "example"), { recursive: true });
    await writeFile(join(dir, "app", "src", "main", "java", "com", "example", "MainActivity.java"), "class MainActivity {}");

    const result = await detectAndroidNative(dir);
    expect(result).not.toBeNull();
    expect(result!.framework).toBe("android-native");
    expect(result!.appName).toBe("MyAndroidApp");
    expect(result!.buildSystem).toBe("gradle");
    expect(result!.srcFolders.length).toBeGreaterThan(0);
  });

  test("detects Kotlin Gradle project", async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, "settings.gradle.kts"), 'rootProject.name = "ComposeApp"\n');

    const result = await detectAndroidNative(dir);
    expect(result).not.toBeNull();
    expect(result!.appName).toBe("ComposeApp");
  });

  test("returns null for non-Android project", async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, "package.json"), '{"name":"not-android"}');

    const result = await detectAndroidNative(dir);
    expect(result).toBeNull();
  });
});

describe("Auto-detect", () => {
  test("Flutter takes priority over Android", async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, "pubspec.yaml"), "name: dual_project\n");
    await mkdir(join(dir, "lib"), { recursive: true });
    await writeFile(join(dir, "settings.gradle"), "rootProject.name = 'dual'\n");

    const result = await detectFramework(dir);
    expect(result.framework).toBe("flutter");
  });

  test("throws for unsupported project", async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, "README.md"), "# Not a mobile app\n");

    await expect(detectFramework(dir)).rejects.toThrow("No supported mobile framework");
  });
});
