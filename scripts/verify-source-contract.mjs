import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const packageJson = JSON.parse(await readFile(resolve("package.json"), "utf8"));
const sourcePaths = [
  "src/color.ts",
  "src/constants.ts",
  "src/culori-adapter.ts",
  "src/errors.ts",
  "src/generator.ts",
  "src/index.ts",
  "src/named-palettes.ts",
  "src/provenance.ts",
  "src/types.ts",
  "agents/colors-system.json",
  "agents/colors-system.md",
  "AGENTS.md",
  "CHANGELOG.md",
  "README.md",
  "docs/architecture.md",
  "docs/color-foundations.md",
  "docs/compatibility.md",
  "docs/dependency-qualification.md",
  "docs/installation.md",
  "docs/palette-generation.md",
  "docs/releasing.md",
  "docs/testing.md",
];
const joined = (await Promise.all(sourcePaths.map((path) => readFile(resolve(path), "utf8")))).join("\n");
const forbiddenUpstreamPaletteName = new RegExp(
  String.fromCharCode(114, 97, 100, 105, 120),
  "iu",
);

assert.equal(packageJson.name, "@flowstack-ui/colors");
assert.equal(packageJson.version, "0.1.0");
assert.equal(packageJson.type, "module");
assert.equal(packageJson.sideEffects, false);
assert.equal(packageJson.repository.url, "git+https://github.com/flowstack-ui/colors.git");
assert.deepEqual(packageJson.dependencies, { culori: "4.0.2" });
assert.equal(packageJson.scripts.prepare, "npm run build");
assert.doesNotMatch(joined, /from\s+["'](?:react|@flowstack-ui\/brick|@flowstack-ui\/theme|@flowstack-ui\/atom|@brick-ui\/colors)/u);
assert.doesNotMatch(joined, /localStorage|document\.|window\.|createContext|use client/u);
assert.doesNotMatch(
  joined,
  forbiddenUpstreamPaletteName,
  "public package must remain standalone and must not name an external palette system",
);
assert.match(joined, /flowstack\.colors-candidate\.v1/u);
assert.match(joined, /flowstack-palette-v1/u);

console.log("Verified public Colors source and documentation boundary.");
