import type { FrameworkDetector } from "@honeypie/plugin-sdk";

export const flutterDetector: FrameworkDetector = {
  id: "detector-flutter",
  priority: 100,
  async detect() {
    return null;
  }
};
