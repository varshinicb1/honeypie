import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const violations = [];

const corePackage = JSON.parse(readFileSync(join(root, "packages", "core", "package.json"), "utf8"));
for (const dependencyBlock of ["dependencies", "devDependencies", "peerDependencies"]) {
  for (const name of Object.keys(corePackage[dependencyBlock] ?? {})) {
    if (name.startsWith("@honeypie/")) {
      violations.push(`@honeypie/core must not depend on ${name}`);
    }
  }
}

const pluginsDir = join(root, "plugins");
if (existsSync(pluginsDir)) {
  for (const plugin of readdirSync(pluginsDir)) {
    const packagePath = join(pluginsDir, plugin, "package.json");
    if (!existsSync(packagePath)) continue;
    const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
    for (const dependencyBlock of ["dependencies", "devDependencies", "peerDependencies"]) {
      for (const name of Object.keys(pkg[dependencyBlock] ?? {})) {
        if (name.startsWith("@honeypie/") && name !== "@honeypie/plugin-sdk") {
          violations.push(`${pkg.name ?? plugin} must depend on @honeypie/plugin-sdk only, not ${name}`);
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exit(1);
}

console.log("Architecture boundaries ok");
