import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  COLOR_GENERATION_REQUEST_SCHEMA,
  COLORS_CANDIDATE_SCHEMA,
  NAMED_PALETTE_NAMES,
  convertColor,
  generatePaletteCandidate,
  getNamedPalette,
  isNamedPaletteName,
} from "../dist/index.js";

function request(seeds, constraints) {
  return {
    $schema: COLOR_GENERATION_REQUEST_SCHEMA,
    seeds,
    ...(constraints === undefined ? {} : { constraints }),
  };
}

function errors(candidate) {
  return candidate.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
}

test("generates accepted interface, neutral, and decorative families together", () => {
  const candidate = generatePaletteCandidate(request([
    { id: "primary", name: "Primary blue", color: "#3157d5", profile: "interface" },
    { id: "neutral", color: "#64748b", profile: "neutral" },
    { id: "campaign", color: "#ff00ff", profile: "decorative" },
  ]));

  assert.equal(candidate.$schema, COLORS_CANDIDATE_SCHEMA);
  assert.equal(candidate.requestSchema, COLOR_GENERATION_REQUEST_SCHEMA);
  assert.equal(candidate.status, "accepted");
  assert.equal(candidate.review.status, "unreviewed");
  assert.equal(candidate.provenance.operation.name, "generate");
  assert.equal(candidate.families.length, 3);
  assert.deepEqual(errors(candidate), []);

  const [primary, neutral, campaign] = candidate.families;
  assert.equal(primary.profile, "interface");
  assert.equal(primary.preservation.requested.mode, "exact");
  assert.equal(primary.preservation.anchorHex, "#3157d5");
  assert.equal(primary.appearances.light.roles.solid.srgb.hex, "#3157d5");
  assert.equal(primary.appearances.dark.roles.solid.srgb.hex, "#3157d5");
  assert.ok(primary.appearances.light.measurements.every((measurement) => measurement.passed));
  assert.ok(primary.appearances.dark.measurements.every((measurement) => measurement.passed));

  assert.equal(neutral.profile, "neutral");
  assert.ok(neutral.appearances.light.measurements.every((measurement) => measurement.passed));
  assert.ok(neutral.appearances.dark.measurements.every((measurement) => measurement.passed));

  assert.equal(campaign.profile, "decorative");
  assert.equal(campaign.appearances.light.steps.length, 12);
  assert.equal(campaign.appearances.dark.steps.length, 12);
  assert.equal(campaign.appearances.light.anchorStep, 9);
  assert.equal(campaign.appearances.light.steps[8].srgb.hex, "#ff00ff");
  assert.equal(campaign.appearances.dark.steps[8].srgb.hex, "#ff00ff");
});

test("generates light and dark relationships independently", () => {
  const family = generatePaletteCandidate(request([
    { id: "brand", color: "#7c3aed", profile: "interface" },
  ])).families[0];
  const light = family.appearances.light.roles;
  const dark = family.appearances.dark.roles;

  assert.notEqual(light.soft.srgb.hex, dark.soft.srgb.hex);
  assert.equal(light.solid.srgb.hex, dark.solid.srgb.hex);
  const anchorLightness = convertColor(light.solid.srgb.hex, "oklch").color.components[0];
  assert.ok(light.solidHover.desired.components[0] < anchorLightness);
  assert.ok(dark.solidHover.desired.components[0] > anchorLightness);
  assert.ok(light.softHover.desired.components[0] < light.soft.desired.components[0]);
  assert.ok(dark.softHover.desired.components[0] > dark.soft.desired.components[0]);
});

test("rejects an impossible exact seed and accepts an explicitly bounded adaptation", () => {
  const exact = generatePaletteCandidate(request([
    { id: "orange", color: "#f97316", profile: "interface" },
  ]));
  assert.equal(exact.status, "rejected");
  assert.equal(exact.families[0].preservation.anchorHex, "#f97316");
  assert.ok(errors(exact).some((diagnostic) =>
    diagnostic.code === "contrast-failed" && diagnostic.path.includes("solid-referenceBackground")
  ));

  const bounded = generatePaletteCandidate(request([
    {
      id: "orange",
      color: "#f97316",
      profile: "interface",
      preservation: { mode: "bounded", maxDeltaE: 0.03 },
    },
  ]));
  const family = bounded.families[0];
  assert.equal(bounded.status, "accepted");
  assert.equal(family.preservation.adapted, true);
  assert.notEqual(family.preservation.anchorHex, family.preservation.seedHex);
  assert.ok(family.preservation.deltaEOK <= 0.03);
  assert.deepEqual(errors(bounded), []);
});

test("explains opacity, gamut, state, and preservation failures", () => {
  const alpha = generatePaletteCandidate(request([
    { id: "alpha", color: "rgb(49 87 213 / 50%)", profile: "interface" },
  ]));
  assert.equal(alpha.status, "rejected");
  assert.ok(errors(alpha).some((diagnostic) => diagnostic.code === "seed-alpha-unsupported"));

  const gamut = generatePaletteCandidate(request([
    { id: "p3", color: "color(display-p3 1 0.5 0)", profile: "interface" },
  ]));
  assert.ok(errors(gamut).some((diagnostic) => diagnostic.code === "exact-seed-outside-srgb"));

  const black = generatePaletteCandidate(request([
    { id: "black", color: "#000000", profile: "interface" },
  ]));
  const codes = new Set(errors(black).map((diagnostic) => diagnostic.code));
  assert.ok(codes.has("state-order-failed"));
  assert.ok(codes.has("state-distinction-failed"));
  assert.ok(codes.has("contrast-failed"));
});

test("supports configurable decorative scales without making accessibility claims", () => {
  const family = generatePaletteCandidate(request([
    {
      id: "poster",
      color: "#7c3aed",
      profile: "decorative",
      options: { steps: 5, anchorStep: 3 },
    },
  ])).families[0];

  assert.equal(family.status, "accepted");
  assert.equal(family.appearances.light.steps.length, 5);
  assert.equal(family.appearances.light.anchorStep, 3);
  assert.equal(family.appearances.light.steps[2].srgb.hex, "#7c3aed");
  assert.ok(family.appearances.light.measurements.every((measurement) =>
    measurement.kind === "difference"
  ));
});

test("diagnoses multi-seed collisions without discarding intentional families", () => {
  const candidate = generatePaletteCandidate(request([
    { id: "primary", color: "#3157d5", profile: "interface" },
    { id: "secondary", color: "#3258d6", profile: "decorative" },
  ]));
  const collision = candidate.diagnostics.find((diagnostic) =>
    diagnostic.code === "family-collision"
  );
  assert.equal(candidate.status, "accepted");
  assert.equal(collision.severity, "warning");
  assert.ok(collision.measured < collision.required);
});

test("generates all standalone FLOWSTACK named scales as raw references", () => {
  assert.equal(NAMED_PALETTE_NAMES.length, 31);
  assert.equal(new Set(NAMED_PALETTE_NAMES).size, 31);
  for (const name of NAMED_PALETTE_NAMES) {
    assert.equal(isNamedPaletteName(name), true);
    const palette = getNamedPalette(name);
    assert.equal(palette.light.length, 12);
    assert.equal(palette.dark.length, 12);
    assert.equal(palette.qualification, "raw-reference");
    assert.deepEqual(palette.source, {
      name: "@flowstack-ui/colors",
      algorithm: "flowstack-palette-v1",
    });
  }
  assert.equal(isNamedPaletteName("chartreuse"), false);
  assert.equal(getNamedPalette("blue").seed, "#2563eb");
  assert.equal(getNamedPalette("blue").light[8], "#2563eb");
  assert.equal(getNamedPalette("blue").dark[8], "#2563eb");
  assert.throws(() => getNamedPalette("chartreuse"), /Unknown named palette/u);
});

test("rejects malformed requests instead of inventing defaults", () => {
  assert.throws(
    () => generatePaletteCandidate({ $schema: "wrong", seeds: [] }),
    /Invalid Colors generation request at \$schema/u,
  );
  assert.throws(
    () => generatePaletteCandidate(request([
      { id: "same", color: "#3157d5", profile: "interface" },
      { id: "same", color: "#ff00ff", profile: "decorative" },
    ])),
    /duplicate seed id/u,
  );
  assert.throws(
    () => generatePaletteCandidate(request([
      { id: "bad", color: "#ff00ff", profile: "decorative", options: { steps: 2 } },
    ])),
    /integer from 3 through 24/u,
  );
  assert.throws(
    () => generatePaletteCandidate(request([
      { id: "bad", color: "#3157d5", profile: "interface" },
    ], { textMinimumContrast: 3 })),
    /cannot be lower than 4\.5/u,
  );
  assert.throws(
    () => generatePaletteCandidate(request([
      { id: "bad", color: "#3157d5", profile: "interface", preservation: { mode: "bounded" } },
    ])),
    /is required for bounded preservation/u,
  );
});

test("keeps every accepted difficult-color candidate inside its measured gates", () => {
  const colors = [
    "#000000",
    "#ffffff",
    "#777777",
    "#ffff00",
    "#00ffff",
    "#ff0000",
    "#0000ff",
    "#ff00ff",
    "#0090ff",
    "oklch(90% 0.4 100)",
    "color(display-p3 1 0.5 0)",
  ];
  for (const profile of ["interface", "neutral", "decorative"]) {
    for (const [index, color] of colors.entries()) {
      const candidate = generatePaletteCandidate(request([
        { id: `${profile}-${index}`, color, profile },
      ]));
      const family = candidate.families[0];
      const measurements = Object.values(family.appearances)
        .flatMap((appearance) => appearance.measurements);
      if (candidate.status === "accepted") {
        assert.ok(measurements.every((measurement) => measurement.passed), `${profile} ${color}`);
        assert.deepEqual(errors(candidate), []);
      } else {
        assert.ok(errors(candidate).length > 0, `${profile} ${color} must explain rejection`);
      }
      assert.equal(JSON.stringify(candidate).includes("NaN"), false);
    }
  }
});

test("reproduces the candidate algorithm golden bytes", () => {
  const candidate = generatePaletteCandidate(request([
    { id: "primary", color: "#3157d5", profile: "interface" },
    { id: "neutral", color: "#64748b", profile: "neutral", options: { appearances: ["dark"] } },
    { id: "poster", color: "#ff00ff", profile: "decorative", options: { steps: 5, anchorStep: 3 } },
  ]));
  const bytes = JSON.stringify(candidate);
  assert.equal(JSON.stringify(generatePaletteCandidate(request([
    { id: "primary", color: "#3157d5", profile: "interface" },
    { id: "neutral", color: "#64748b", profile: "neutral", options: { appearances: ["dark"] } },
    { id: "poster", color: "#ff00ff", profile: "decorative", options: { steps: 5, anchorStep: 3 } },
  ]))), bytes);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    "1da792df91b5bcf988ab537afc5bd19200a609c72c495e73fb582df217eaef5c",
  );
});
