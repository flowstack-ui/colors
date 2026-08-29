const verification = {
  schemaVersion: 1,
  id: "colors",
  kind: "public-package",
  commands: {
    repository: "check:repository",
    release: "check:release",
    contract: "verify:repository-contract",
  },
  servers: [],
  browserConfigs: [],
  workflows: {
    ci: ".github/workflows/ci.yml",
    publish: ".github/workflows/publish.yml",
  },
  impact: {
    strategy: "conservative-repository",
    conservativePaths: [
      "package.json",
      "package-lock.json",
      "src",
      "scripts",
      "test",
      "verification.config.mjs",
    ],
  },
  manual: [
    "human review of candidate palette provenance and visual usefulness",
    "public API and color-science compatibility review",
  ],
};

export default verification;
