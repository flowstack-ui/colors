import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const temporaryRoot = await mkdtemp(resolve(tmpdir(), "flowstack-colors-package-"));
const packageDirectory = resolve(temporaryRoot, "package");
const consumerDirectory = resolve(temporaryRoot, "consumer");
const cacheDirectory = resolve(temporaryRoot, "npm-cache");

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, npm_config_cache: cacheDirectory },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

try {
  await mkdir(packageDirectory, { recursive: true });
  const output = run("npm", ["pack", "--json", "--silent", "--pack-destination", packageDirectory], repositoryRoot);
  const jsonStart = output.lastIndexOf("\n[");
  const packed = JSON.parse(jsonStart >= 0 ? output.slice(jsonStart + 1) : output);
  assert.equal(packed.length, 1);
  const archive = resolve(packageDirectory, packed[0].filename);
  const listing = run("tar", ["-tzf", archive], repositoryRoot).trim().split("\n").sort();

  for (const expected of [
    "package/CHANGELOG.md",
    "package/LICENSE",
    "package/README.md",
    "package/agents/colors-system.json",
    "package/agents/colors-system.md",
    "package/dist/index.d.ts",
    "package/dist/index.js",
    "package/docs/architecture.md",
    "package/docs/color-foundations.md",
    "package/docs/dependency-qualification.md",
    "package/docs/palette-generation.md",
    "package/docs/testing.md",
    "package/package.json",
  ]) {
    assert.ok(listing.includes(expected), `${expected} is missing from ${basename(archive)}`);
  }
  assert.equal(listing.some((entry) => /package\/(?:src|test|scripts|\.github)\//u.test(entry)), false);

  await mkdir(consumerDirectory, { recursive: true });
  await writeFile(resolve(consumerDirectory, "package.json"), JSON.stringify({ name: "colors-clean-consumer", private: true, type: "module" }, null, 2));
  await writeFile(resolve(consumerDirectory, "index.mjs"), `
import {
  COLOR_GENERATION_REQUEST_SCHEMA,
  generatePaletteCandidate,
} from "@flowstack-ui/colors";
import {
  calculateContrast,
  normalizeColor,
} from "@flowstack-ui/colors";

const candidate = generatePaletteCandidate({
  $schema: COLOR_GENERATION_REQUEST_SCHEMA,
  seeds: [{ id: "primary", color: "#0090ff", profile: "interface" }],
});

const color = normalizeColor("color(display-p3 1 0.5 0)");
const contrast = calculateContrast("#000", "#fff");
console.log(candidate.$schema, candidate.families[0].id, color.srgb.hex, contrast.ratio);
`);
  await writeFile(resolve(consumerDirectory, "index.ts"), `
import {
  calculateContrast,
  convertColor,
  normalizeColor,
  type ColorRecord,
  type StructuredColor,
} from "@flowstack-ui/colors";

const record: ColorRecord = normalizeColor("#3157d5");
const converted: StructuredColor = convertColor(record.color, "oklch").color;
const ratio: number = calculateContrast("#000", "#fff").ratio;
void converted;
void ratio;
`);
  await writeFile(resolve(consumerDirectory, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      module: "NodeNext",
      moduleResolution: "NodeNext",
      target: "ES2022",
      strict: true,
      noEmit: true,
      skipLibCheck: false,
    },
    include: ["index.ts"],
  }, null, 2));

  run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", archive], consumerDirectory);
  const consumerOutput = run(process.execPath, ["index.mjs"], consumerDirectory).trim();
  assert.equal(consumerOutput, "flowstack.colors-candidate.v1 primary #ff7d00 21");
  run(process.execPath, [resolve(repositoryRoot, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.json"], consumerDirectory);

  const installedPackage = JSON.parse(await readFile(resolve(consumerDirectory, "node_modules/@flowstack-ui/colors/package.json"), "utf8"));
  assert.deepEqual(installedPackage.dependencies, {
    culori: "^4.0.2",
  });
  for (const prohibited of ["react", "@flowstack-ui/brick", "@flowstack-ui/theme"]) {
    assert.equal(prohibited in installedPackage.dependencies, false);
  }
  console.log(`Verified ${basename(archive)} and its clean consumer.`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
