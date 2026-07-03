import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
    globals: false,
    alias: {
      "@honeypie/builder": resolve(__dirname, "./packages/builder/src/index.ts"),
      "@honeypie/explorer": resolve(__dirname, "./packages/explorer/src/index.ts"),
      "@honeypie/vision": resolve(__dirname, "./packages/vision/src/index.ts")
    }
  }
});
