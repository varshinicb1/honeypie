import { describe, expect, test } from "vitest";
import { resolveAndroidTool } from "./index.js";

describe("resolveAndroidTool", () => {
  test("finds Android tools under ANDROID_HOME when they are not on PATH", () => {
    const result = resolveAndroidTool("adb", {
      PATH: "",
      ANDROID_HOME: "C:\\Android\\Sdk"
    }, {
      exists: (path) => path === "C:\\Android\\Sdk\\platform-tools\\adb.exe"
    });

    expect(result).toEqual("C:\\Android\\Sdk\\platform-tools\\adb.exe");
  });

  test("finds emulator under ANDROID_SDK_ROOT", () => {
    const result = resolveAndroidTool("emulator", {
      PATH: "",
      ANDROID_SDK_ROOT: "D:\\Sdk"
    }, {
      exists: (path) => path === "D:\\Sdk\\emulator\\emulator.exe"
    });

    expect(result).toEqual("D:\\Sdk\\emulator\\emulator.exe");
  });
});
