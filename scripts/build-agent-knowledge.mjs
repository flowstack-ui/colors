import assert from "node:assert/strict";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const outputRoot = join(packageRoot, "dist", "agents");
const checkOnly = process.argv.includes("--check");
const packageJson = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
const catalog = JSON.parse(await readFile(join(packageRoot, "agents", "catalog.json"), "utf8"));
const guidePath = join(packageRoot, "agents", "colors-system.json");
const guide = JSON.parse(await readFile(guidePath, "utf8"));
const sourceAgentFiles = (await readdir(join(packageRoot, "agents"))).sort();
assert.deepEqual(
  sourceAgentFiles,
  ["catalog.json", "colors-system.json", "colors-system.md"],
  "agents contains a missing or extra canonical source; update discovery deliberately",
);

function list(items) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- None.";
}

function renderGuide(data) {
  const decisionOrder = data.decisionOrder.map((item, index) => `${index + 1}. ${item}`).join("\n");
  const selection = data.selection
    .map(({ intent, use, note }) => `- **${intent}:** use ${use}.${note ? ` ${note}` : ""}`)
    .join("\n");
  const rules = data.rules
    .map(({ level, statement }) => `- **${level.toUpperCase()}:** ${statement}`)
    .join("\n");
  const fallback = `1. ${data.nativeFallback.check}\n2. ${data.nativeFallback.use}\n3. ${data.nativeFallback.report}`;
  return `# ${data.name}\n\n## Purpose\n\n${data.purpose}\n\n## Decision order\n\n${decisionOrder}\n\n## Selection map\n\n${selection}\n\n## Rules\n\n${rules}\n\n## Native and higher-layer handoff\n\n${fallback}\n\n## Validation checklist\n\n${list(data.validation)}\n\n## Related guidance\n\n${list(data.related.map((item) => `\`${item}\``))}\n\n## Current status\n\n${data.status}\n`;
}

function discoverPublicSymbols(source) {
  const file = ts.createSourceFile("src/index.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const symbols = [];
  for (const statement of file.statements) {
    if (!ts.isExportDeclaration(statement) || !statement.exportClause || !ts.isNamedExports(statement.exportClause)) continue;
    for (const element of statement.exportClause.elements) {
      symbols.push({
        name: element.name.text,
        surfaceKind: statement.isTypeOnly || element.isTypeOnly ? "type" : "value",
      });
    }
  }
  return symbols.sort((a, b) => a.name.localeCompare(b.name));
}

function validateCatalog(publicSymbols) {
  assert.equal(catalog.schema, "flowstack.agent-catalog.v1");
  assert.equal(catalog.package, packageJson.name);
  assert.equal(catalog.layer, "colors");
  assert.deepEqual(catalog.coverageProfile, { kind: "operation-package", ownerUnit: "operation" });
  assert.deepEqual(catalog.packageGuideIds, ["colors-system"]);
  assert.equal(catalog.operationOwners.length, 6, "Colors must expose six operation owners");

  const ownerIds = catalog.operationOwners.map(({ id }) => id);
  assert.equal(new Set(ownerIds).size, ownerIds.length, "operation owner IDs must be unique");
  for (const owner of catalog.operationOwners) {
    assert.ok(owner.id && owner.name && owner.guideId === "colors-system" && owner.documentation);
  }

  assert.equal(catalog.classifications.length, 76, "Colors must classify all 76 public API surfaces");
  const classificationBySurface = new Map();
  for (const record of catalog.classifications) {
    assert.ok(!classificationBySurface.has(record.surface), `duplicate classification: ${record.surface}`);
    assert.ok(["operation", "operation-member", "metadata"].includes(record.classification), `invalid classification: ${record.surface}`);
    assert.ok(["value", "type"].includes(record.surfaceKind), `invalid surface kind: ${record.surface}`);
    if (record.classification === "metadata") {
      assert.ok(record.documentation && record.reason, `metadata requires documentation and reason: ${record.surface}`);
      assert.equal(record.ownerId, undefined, `metadata cannot claim an operation owner: ${record.surface}`);
    } else {
      assert.ok(ownerIds.includes(record.ownerId), `unknown operation owner: ${record.surface}`);
    }
    classificationBySurface.set(record.surface, record);
  }

  assert.deepEqual(
    [...classificationBySurface.keys()].sort(),
    publicSymbols.map(({ name }) => `.#${name}`).sort(),
    "catalog classifications must exactly match src/index.ts public symbols",
  );
  for (const symbol of publicSymbols) {
    assert.equal(classificationBySurface.get(`.#${symbol.name}`).surfaceKind, symbol.surfaceKind, `surface kind mismatch: ${symbol.name}`);
  }
  for (const ownerId of ownerIds) {
    assert.equal(
      catalog.classifications.filter((record) => record.classification === "operation" && record.ownerId === ownerId).length,
      1,
      `${ownerId} must have exactly one primary operation surface`,
    );
  }

  const expectedExports = catalog.metadataExports.map(({ surface }) => surface).sort();
  assert.deepEqual(Object.keys(packageJson.exports).sort(), expectedExports, "package exports must match catalog metadata exports");
  for (const record of catalog.metadataExports) assert.ok(record.documentation && record.reason);
  assert.deepEqual(catalog.exclusions, []);
  return { classificationBySurface, ownerIds };
}

function validateGuide(ownerIds) {
  assert.equal(guide.schema, "flowstack.agent-guide.v1");
  assert.equal(guide.id, "colors-system");
  assert.equal(guide.package, packageJson.name);
  assert.equal(guide.layer, "colors");
  assert.equal(guide.kind, "guide");
  for (const key of ["decisionOrder", "selection", "rules", "validation", "related"]) {
    assert.ok(Array.isArray(guide[key]) && guide[key].length > 0, `${key} must be a non-empty array`);
  }
  for (const rule of guide.rules) assert.ok(rule.id && ["must", "should"].includes(rule.level) && rule.statement);
  for (const key of ["check", "use", "report"]) assert.ok(guide.nativeFallback?.[key]);

  const nativeIds = new Set(catalog.nativeApplicationDestinations.map(({ id }) => id));
  const selectedOperations = new Set();
  const destinations = [];
  for (const item of guide.selection) {
    assert.ok(item.intent && item.use && Array.isArray(item.destinations) && item.destinations.length > 0);
    for (const destination of item.destinations) {
      const resolved = destination.kind === "operation"
        ? ownerIds.includes(destination.id)
        : destination.kind === "native-application" && nativeIds.has(destination.id);
      assert.ok(resolved, `unresolved selection destination: ${JSON.stringify(destination)}`);
      if (destination.kind === "operation") selectedOperations.add(destination.id);
      destinations.push({ ...destination, intent: item.intent, status: "covered" });
    }
  }
  assert.deepEqual([...selectedOperations].sort(), [...ownerIds].sort(), "selection map must route all operation owners");
  return destinations;
}

const publicSymbols = discoverPublicSymbols(await readFile(join(packageRoot, "src", "index.ts"), "utf8"));
assert.equal(publicSymbols.length, 76, "src/index.ts public surface count changed; update the catalog deliberately");
const { classificationBySurface, ownerIds } = validateCatalog(publicSymbols);
const selectionDestinations = validateGuide(ownerIds);
const markdown = renderGuide(guide);

for (const path of guide.related) {
  await readFile(join(packageRoot, path), "utf8");
}
for (const owner of catalog.operationOwners) await readFile(join(packageRoot, owner.documentation), "utf8");
for (const record of catalog.classifications.filter(({ documentation }) => documentation)) {
  await readFile(join(packageRoot, record.documentation), "utf8");
}
for (const record of catalog.metadataExports) await readFile(join(packageRoot, record.documentation), "utf8");

const operations = catalog.operationOwners
  .map((owner) => {
    const surfaces = catalog.classifications
      .filter((record) => record.ownerId === owner.id)
      .map(({ surface }) => surface)
      .sort();
    return {
      id: owner.id,
      name: owner.name,
      guideId: owner.guideId,
      documentation: owner.documentation,
      publicSurfaces: surfaces,
      status: "covered",
    };
  })
  .sort((a, b) => a.id.localeCompare(b.id));

const manifest = {
  schema: "flowstack.agent-manifest.v1",
  package: packageJson.name,
  packageVersion: packageJson.version,
  layer: "colors",
  components: [],
  guides: [{ id: guide.id, name: guide.name, json: "./colors-system.json", markdown: "./colors-system.md" }],
  operations: operations.map(({ id, name, guideId }) => ({ id, name, guide: `./${guideId}.json` })),
  coverage: "./coverage.json",
};

const surfaces = publicSymbols.map(({ name, surfaceKind }) => {
  const classification = classificationBySurface.get(`.#${name}`);
  return {
    surface: `.#${name}`,
    symbol: name,
    surfaceKind,
    classification: classification.classification,
    ...(classification.ownerId ? { ownerId: classification.ownerId } : {}),
    ...(classification.documentation ? { documentation: classification.documentation } : {}),
    status: "covered",
  };
});
const owners = operations.map((operation) => ({
  kind: "operation",
  id: operation.id,
  name: operation.name,
  publicSurfaces: operation.publicSurfaces,
  guideIds: [operation.guideId],
  manifestPaths: [],
  status: "covered",
}));
const coverage = {
  schema: "flowstack.agent-coverage.v1",
  package: packageJson.name,
  packageVersion: packageJson.version,
  layer: "colors",
  profile: catalog.coverageProfile,
  generatedFrom: { exports: "package.json", catalog: "agents/catalog.json", manifest: "dist/agents/manifest.json" },
  summary: {
    publicSurfaces: surfaces.length,
    classifiedPublicSurfaces: surfaces.length,
    componentOwners: 0,
    guidedComponentOwners: 0,
    packageGuides: 1,
    ownerUnits: operations.length,
    guidedOwnerUnits: operations.length,
    operationOwners: operations.length,
    guidedOperationOwners: operations.length,
    registryItems: 0,
    guidedRegistryItems: 0,
    registryFamilies: 0,
    unclassified: 0,
    invalidExclusions: 0,
    unresolvedSelections: 0,
    invalidRegistryItems: 0,
    unresolvedDependencies: 0,
  },
  components: [],
  owners,
  operations,
  registryItems: [],
  registryFamilies: [],
  surfaces,
  metadataExports: catalog.metadataExports.map((record) => ({ ...record, status: "covered" })),
  guides: [{ id: guide.id, json: "./colors-system.json", markdown: "./colors-system.md", status: "covered" }],
  exclusions: [],
  selectionDestinations,
  failures: [],
};

const expected = new Map([
  ["colors-system.json", `${JSON.stringify(guide, null, 2)}\n`],
  ["colors-system.md", markdown],
  ["manifest.json", `${JSON.stringify(manifest, null, 2)}\n`],
  ["coverage.json", `${JSON.stringify(coverage, null, 2)}\n`],
]);

async function assertExact(path, content, message) {
  assert.equal(await readFile(path, "utf8").catch(() => ""), content, message);
}

if (checkOnly) {
  await assertExact(join(packageRoot, "agents", "colors-system.md"), markdown, "agents/colors-system.md is stale; run npm run agents:build");
  const existing = await readdir(outputRoot).catch(() => []);
  assert.deepEqual(existing.sort(), [...expected.keys()].sort(), "dist/agents contains missing or extra generated artifacts");
  for (const [name, content] of expected) {
    await assertExact(join(outputRoot, name), content, `dist/agents/${name} is stale; run npm run agents:build`);
  }
} else {
  await writeFile(join(packageRoot, "agents", "colors-system.md"), markdown);
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  for (const [name, content] of expected) await writeFile(join(outputRoot, name), content);
}

console.log(`${checkOnly ? "Verified" : "Built"} 6 Colors operation owners and 76/76 public API surfaces with zero failures.`);
