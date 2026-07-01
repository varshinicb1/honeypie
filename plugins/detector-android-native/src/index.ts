import type { FrameworkDetector } from "@honeypie/plugin-sdk";

export const androidNativeDetector: FrameworkDetector = {
  id: "detector-android-native",
  priority: 90,
  async detect() {
    return null;
  }
};
