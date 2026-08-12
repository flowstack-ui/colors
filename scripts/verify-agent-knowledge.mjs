import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const packageJson = JSON.parse(await readFile(resolve("package.json"), "utf8"));
const guide = JSON.parse(await readFile(resolve("agents/colors-system.json"), "utf8"));
const markdown = await readFile(resolve("agents/colors-system.md"), "utf8");

assert.equal(guide.schema, "flowstack.agent-guide.v1");
assert.equal(guide.id, "colors-system");
assert.equal(guide.package, packageJson.name);
assert.equal(guide.layer, "colors");
assert.equal(guide.kind, "guide");
assert.equal(guide.status, "0.1-release");
assert.ok(Array.isArray(guide.rules) && guide.rules.length >= 10);
assert.ok(guide.rules.every(({ id, level, statement }) =>
  typeof id === "string"
  && ["must", "should"].includes(level)
  && typeof statement === "string"
));
assert.ok(guide.related.includes("docs/compatibility.md"));
assert.ok(guide.related.includes("docs/installation.md"));
assert.match(markdown, /^# FLOWSTACK Colors system\n/u);
assert.match(markdown, /## Rules/u);
assert.match(markdown, /## Current status/u);

console.log("Verified Colors Agent Knowledge guidance.");
