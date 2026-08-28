import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import ts from "typescript";

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
  assert.equal(packed[0].version, "0.1.1");
  const archive = resolve(packageDirectory, packed[0].filename);
  const listing = run("tar", ["-tzf", archive], repositoryRoot).trim().split("\n").sort();

  for (const expected of [
    "package/CHANGELOG.md",
    "package/LICENSE",
    "package/README.md",
    "package/agents/colors-system.json",
    "package/agents/colors-system.md",
    "package/agents/catalog.json",
    "package/dist/agents/colors-system.json",
    "package/dist/agents/colors-system.md",
    "package/dist/agents/coverage.json",
    "package/dist/agents/manifest.json",
    "package/dist/index.d.ts",
    "package/dist/index.js",
    "package/docs/architecture.md",
    "package/docs/agent-knowledge.md",
    "package/docs/color-foundations.md",
    "package/docs/compatibility.md",
    "package/docs/dependency-qualification.md",
    "package/docs/installation.md",
    "package/docs/palette-generation.md",
    "package/docs/releasing.md",
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
  calculateColorDifference,
  calculateContrast,
  convertColor,
  createColorProvenance,
  generatePaletteCandidate,
  getNamedPalette,
  mapColorToGamut,
  normalizeColor,
  parseColor,
  reviewPaletteCandidate,
  validateColor,
} from "@flowstack-ui/colors";

const candidate = generatePaletteCandidate({
  $schema: COLOR_GENERATION_REQUEST_SCHEMA,
  seeds: [{ id: "primary", color: "#0090ff", profile: "interface" }],
});
const reviewed = reviewPaletteCandidate(candidate, { status: "accepted" });

const color = normalizeColor("color(display-p3 1 0.5 0)");
const contrast = calculateContrast("#000", "#fff");
const parsed = parseColor("#3157d5");
const validation = validateColor(parsed);
const converted = convertColor(parsed, "oklch");
const mapped = mapColorToGamut("oklch(90% 0.4 100)", "srgb");
const difference = calculateColorDifference("#ff0000", "#ff1100");
const named = getNamedPalette("blue");
const provenance = createColorProvenance("convert", { target: "oklch" });
console.log(
  candidate.$schema,
  candidate.families[0].id,
  reviewed.review.status,
  color.srgb.hex,
  contrast.ratio,
  validation.valid,
  converted.color.colorSpace,
  mapped.targetGamut,
  difference.method,
  named.name,
  provenance.operation.name,
);
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
  assert.equal(consumerOutput, "flowstack.colors-candidate.v1 primary accepted #ff7d00 21 true oklch srgb delta-e-ok blue convert");
  run(process.execPath, [resolve(repositoryRoot, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.json"], consumerDirectory);

  const installedPackage = JSON.parse(await readFile(resolve(consumerDirectory, "node_modules/@flowstack-ui/colors/package.json"), "utf8"));
  assert.equal(installedPackage.version, "0.1.1");
  assert.notEqual(installedPackage.private, true);
  assert.deepEqual(installedPackage.dependencies, {
    culori: "4.0.2",
  });
  for (const prohibited of ["react", "@flowstack-ui/brick", "@flowstack-ui/theme"]) {
    assert.equal(prohibited in installedPackage.dependencies, false);
  }
  const installedRequire = createRequire(resolve(consumerDirectory, "index.mjs"));
  const manifest = installedRequire("@flowstack-ui/colors/agents/manifest.json");
  const coverage = installedRequire("@flowstack-ui/colors/agents/coverage.json");
  const directGuide = installedRequire("@flowstack-ui/colors/agents/colors-system.json");
  assert.equal(manifest.schema, "flowstack.agent-manifest.v1");
  assert.equal(manifest.package, installedPackage.name);
  assert.equal(manifest.packageVersion, installedPackage.version);
  assert.equal(manifest.components.length, 0);
  assert.equal(manifest.operations.length, 6);
  assert.equal(coverage.schema, "flowstack.agent-coverage.v1");
  assert.equal(coverage.packageVersion, installedPackage.version);
  assert.deepEqual(coverage.profile, { kind: "operation-package", ownerUnit: "operation" });
  assert.equal(coverage.summary.publicSurfaces, 76);
  assert.equal(coverage.summary.classifiedPublicSurfaces, 76);
  assert.equal(coverage.summary.ownerUnits, 6);
  assert.equal(coverage.summary.guidedOwnerUnits, 6);
  assert.equal(coverage.failures.length, 0);
  for (const field of [
    "unclassified",
    "invalidExclusions",
    "unresolvedSelections",
    "invalidRegistryItems",
    "unresolvedDependencies",
  ]) assert.equal(coverage.summary[field], 0, `${field} must be zero`);
  assert.equal(directGuide.id, manifest.guides[0].id);

  for (const guide of manifest.guides) {
    const jsonPath = `@flowstack-ui/colors/agents/${guide.json.replace(/^\.\//u, "")}`;
    const markdownPath = `@flowstack-ui/colors/agents/${guide.markdown.replace(/^\.\//u, "")}`;
    assert.equal(installedRequire(jsonPath).id, guide.id);
    const markdown = await readFile(installedRequire.resolve(markdownPath), "utf8");
    assert.match(markdown, new RegExp(`^# ${guide.name}`, "u"));
  }

  const installedDist = resolve(consumerDirectory, "node_modules/@flowstack-ui/colors/dist");
  const declarationSource = await readFile(resolve(installedDist, "index.d.ts"), "utf8");
  const declarationFile = ts.createSourceFile("index.d.ts", declarationSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declaredSymbols = new Set();
  for (const statement of declarationFile.statements) {
    if (!ts.isExportDeclaration(statement) || !statement.exportClause || !ts.isNamedExports(statement.exportClause)) continue;
    for (const element of statement.exportClause.elements) declaredSymbols.add(element.name.text);
  }
  assert.equal(declaredSymbols.size, 76);
  assert.deepEqual([...declaredSymbols].sort(), coverage.surfaces.map(({ symbol }) => symbol).sort());
  const installedRuntime = await import(resolve(installedDist, "index.js"));
  for (const surface of coverage.surfaces) {
    assert.ok(declaredSymbols.has(surface.symbol), `installed declaration is missing ${surface.symbol}`);
    if (surface.surfaceKind === "value") {
      assert.ok(surface.symbol in installedRuntime, `installed runtime is missing ${surface.symbol}`);
    }
  }
  const installedSources = await Promise.all(
    (await readdir(installedDist, { recursive: true }))
      .filter((entry) => entry.endsWith(".js"))
      .map((entry) => readFile(resolve(installedDist, entry), "utf8")),
  );
  assert.doesNotMatch(
    installedSources.join("\n"),
    /react|@flowstack-ui\/(?:atom|brick|theme)|document\.|window\.|localStorage/u,
  );
  console.log(`Verified ${basename(archive)} and its clean consumer.`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
