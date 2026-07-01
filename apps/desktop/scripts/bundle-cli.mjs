import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");

await build({
  entryPoints: [join(repoRoot, "packages", "cli", "src", "bin.ts")],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outfile: join(here, "..", "src-tauri", "resources", "honeypie-cli.mjs"),
  banner: {
    js: "import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);"
  }
});

console.log("Bundled honeypie-cli.mjs");
