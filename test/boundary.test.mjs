import assert from "node:assert/strict";
import test from "node:test";

import {
  COLORS_CANDIDATE_SCHEMA,
  defineColorsCandidate,
} from "../dist/index.js";

test("defines a serializable multi-seed candidate boundary", () => {
  const candidate = defineColorsCandidate({
    $schema: COLORS_CANDIDATE_SCHEMA,
    seeds: [
      {
        id: "primary",
        color: "#3157d5",
        profile: "interface",
        preservation: { mode: "exact" },
      },
      {
        id: "campaign",
        color: "oklch(72% 0.18 45)",
        profile: "decorative",
        preservation: { mode: "bounded", maxDeltaE: 0.02 },
      },
    ],
  });

  assert.equal(candidate.$schema, "flowstack.colors-candidate.v1");
  assert.equal(candidate.seeds.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(candidate)), candidate);
});

