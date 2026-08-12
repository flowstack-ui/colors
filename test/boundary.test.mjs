import assert from "node:assert/strict";
import test from "node:test";

import {
  COLOR_GENERATION_REQUEST_SCHEMA,
  COLORS_CANDIDATE_SCHEMA,
  defineColorGenerationRequest,
  generatePaletteCandidate,
} from "../dist/index.js";

test("generates a serializable multi-seed candidate boundary", () => {
  const request = defineColorGenerationRequest({
    $schema: COLOR_GENERATION_REQUEST_SCHEMA,
    seeds: [
      {
        id: "primary",
        color: "#0090ff",
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
  const candidate = generatePaletteCandidate(request);

  assert.equal(candidate.$schema, COLORS_CANDIDATE_SCHEMA);
  assert.equal(candidate.families.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(candidate)), candidate);
});
