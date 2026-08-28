if (!process.argv.includes("--check")) process.argv.push("--check");
await import("./build-agent-knowledge.mjs");
