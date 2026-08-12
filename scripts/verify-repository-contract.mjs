import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const errors = [];

async function requirePath(path) {
  try {
    await access(resolve(root, path));
  } catch {
    errors.push(`missing ${path}`);
  }
}

for (const path of [
  "AGENTS.md",
  "README.md",
  "CHANGELOG.md",
  "LICENSE",
  ".nvmrc",
  "package-lock.json",
  ".github/workflows/ci.yml",
  ".github/workflows/publish.yml",
  "agents/colors-system.json",
  "agents/colors-system.md",
  "docs/architecture.md",
  "docs/color-foundations.md",
  "docs/compatibility.md",
  "docs/dependency-qualification.md",
  "docs/installation.md",
  "docs/palette-generation.md",
  "docs/releasing.md",
  "docs/testing.md",
  "scripts/verify-agent-knowledge.mjs",
  "scripts/verify-package.mjs",
  "scripts/verify-repository-contract.mjs",
  "scripts/verify-source-contract.mjs",
  "src/index.ts",
  "src/types.ts",
]) await requirePath(path);

for (const workflow of [".github/workflows/ci.yml", ".github/workflows/publish.yml"]) {
  try {
    const source = await readFile(resolve(root, workflow), "utf8");
    if (/uses:\s+[^\n#]+@(v\d+|main|master)\b/u.test(source)) {
      errors.push(`${workflow} contains a mutable action reference`);
    }
    if (!source.includes("timeout-minutes:")) errors.push(`${workflow} has no job timeout`);
  } catch {
    // Missing workflows are reported above.
  }
}

try {
  const publish = await readFile(resolve(root, ".github/workflows/publish.yml"), "utf8");
  if (!publish.includes("id-token: write")) errors.push("publish workflow must request OIDC permission");
  if (!publish.includes("environment: npm")) errors.push("publish workflow must use the protected npm environment");
  if (!publish.includes("npm run check:release")) errors.push("publish workflow must run the release gate");
  if (!publish.includes("npm publish \"$RUNNER_TEMP\"/colors-package/*.tgz")) {
    errors.push("publish workflow must publish the exact qualified archive");
  }
} catch {
  // Missing workflow is reported above.
}

if (packageJson.name !== "@flowstack-ui/colors") errors.push("unexpected package name");
if (packageJson.version !== "0.1.0") errors.push("release version must be 0.1.0");
if (packageJson.private === true) errors.push("release package must not be private");
if (packageJson.engines?.node !== ">=22") errors.push("Node 22 declaration is required");
if (packageJson.dependencies?.culori !== "4.0.2") errors.push("qualified Culori runtime must be pinned to 4.0.2");
if (Object.keys(packageJson.dependencies ?? {}).length !== 1) errors.push("Culori must be the only runtime dependency");
if (packageJson.scripts?.["check:release"] !== "npm run check:repository") {
  errors.push("release gate must equal the repository gate");
}

if (errors.length > 0) {
  console.error(`Repository contract failed:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log("Verified Colors repository and release contract.");
