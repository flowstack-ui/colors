import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  COLOR_ENGINE_VERSION,
  COLOR_PROVENANCE_SCHEMA,
  COLOR_RECORD_SCHEMA,
  COLORS_PACKAGE_VERSION,
  FlowstackColorError,
  calculateColorDifference,
  calculateContrast,
  colorDifference,
  contrastRatio,
  convertColor,
  createColorProvenance,
  mapColorToGamut,
  normalizeColor,
  parseColor,
  validateColor,
} from "../dist/index.js";

test("parses CSS colors into supported structured spaces", () => {
  assert.deepEqual(parseColor("#3157d5"), {
    colorSpace: "srgb",
    components: [49 / 255, 87 / 255, 213 / 255],
    alpha: 1,
  });
  assert.deepEqual(parseColor("oklch(70% 0.2 45 / 50%)"), {
    colorSpace: "oklch",
    components: [0.7, 0.2, 45],
    alpha: 0.5,
  });
  assert.equal(parseColor("hsl(224 64% 51%)").colorSpace, "srgb");
  assert.equal(parseColor("color(display-p3 1 0.5 0)").colorSpace, "display-p3");
});

test("parses direct and wrapped Design Tokens color values", () => {
  const value = {
    colorSpace: "oklch",
    components: [0.72, 0.18, 45],
    alpha: 0.8,
    hex: "#ee8b5ccc",
  };
  assert.deepEqual(parseColor(value), {
    colorSpace: "oklch",
    components: [0.72, 0.18, 45],
    alpha: 0.8,
  });
  assert.deepEqual(parseColor({ $type: "color", $value: value }), parseColor(value));
});

test("converts without silently gamut mapping", () => {
  const result = convertColor("color(display-p3 1 0.5 0)", "srgb");
  assert.equal(result.source.colorSpace, "display-p3");
  assert.equal(result.targetSpace, "srgb");
  assert.ok(result.color.components[0] > 1);
  assert.equal(result.provenance.operation.name, "convert");

  const roundTrip = convertColor(result.color, "display-p3").color;
  assert.ok(Math.abs(roundTrip.components[0] - 1) < 1e-12);
  assert.ok(Math.abs(roundTrip.components[1] - 0.5) < 1e-12);
  assert.ok(Math.abs(roundTrip.components[2]) < 1e-12);
});

test("canonicalizes the meaningless hue of achromatic polar colors", () => {
  for (const input of ["#000000", "#777777", "#ffffff"]) {
    const converted = convertColor(input, "oklch").color;
    assert.equal(converted.colorSpace, "oklch");
    assert.ok(Math.abs(converted.components[1]) < 1e-12);
    assert.equal(converted.components[2], 0);
  }
});

test("maps out-of-gamut colors with complete diagnostics", () => {
  const result = mapColorToGamut("oklch(90% 0.4 100)");
  assert.equal(result.targetGamut, "srgb");
  assert.equal(result.sourceInGamut, false);
  assert.equal(result.mapped, true);
  assert.equal(result.method, "css-color-4-oklch-local-minde");
  assert.equal(result.justNoticeableDifference, 0.02);
  assert.ok(result.deltaEOK > 0.2);
  assert.equal(normalizeColor("oklch(90% 0.4 100)").srgb.hex, "#ffdf00");
  for (const component of result.color.components) {
    assert.ok(component >= 0 && component <= 1);
  }
});

test("does not claim a gamut adjustment for in-gamut colors", () => {
  const result = mapColorToGamut("#3157d5");
  assert.equal(result.sourceInGamut, true);
  assert.equal(result.mapped, false);
  assert.equal(result.method, "none");
  assert.equal(result.deltaEOK, 0);
});

test("normalizes to a deterministic serializable record without mutating source", () => {
  const input = {
    $type: "color",
    $value: {
      colorSpace: "display-p3",
      components: [1, 0.5, 0],
      hex: "#ff7600",
    },
  };
  const first = normalizeColor(input);
  const serialized = JSON.stringify(first);
  input.$value.components[1] = 0;

  assert.equal(first.$schema, COLOR_RECORD_SCHEMA);
  assert.equal(first.source.kind, "dtcg-token");
  assert.equal(first.source.value.$value.components[1], 0.5);
  assert.equal(first.source.value.$value.hex, "#ff7600");
  assert.equal(first.srgb.hex, "#ff7d00");
  assert.equal(JSON.stringify(normalizeColor({
    $type: "color",
    $value: {
      colorSpace: "display-p3",
      components: [1, 0.5, 0],
      hex: "#ff7600",
    },
  })), serialized);
  assert.deepEqual(JSON.parse(serialized), first);
});

test("matches the normalized wide-gamut golden record byte for byte", async () => {
  const expected = await readFile(
    resolve("test/fixtures/normalized-display-p3.json"),
    "utf8",
  );
  const actual = `${JSON.stringify(normalizeColor({
    $type: "color",
    $value: {
      colorSpace: "display-p3",
      components: [1, 0.5, 0],
      alpha: 1,
      hex: "#ff7600",
    },
  }), null, 2)}\n`;
  assert.equal(actual, expected);
});

test("preserves alpha and emits an eight-digit sRGB fallback", () => {
  const result = normalizeColor("rgb(49 87 213 / 80%)");
  assert.equal(result.color.alpha, 0.8);
  assert.equal(result.srgb.color.alpha, 0.8);
  assert.equal(result.srgb.hex, "#3157d5cc");
});

test("calculates exact opaque WCAG contrast and named pass gates", () => {
  const report = calculateContrast("#777777", "#ffffff");
  assert.equal(report.ratio, 4.478089453577214);
  assert.deepEqual(report.passes, {
    normalText: false,
    largeText: true,
    nonText: true,
  });
  assert.equal(contrastRatio("#000", "#fff"), 21);
  assert.equal(report.provenance.operation.name, "contrast");
});

test("maps wide-gamut colors before reporting sRGB contrast", () => {
  const report = calculateContrast("color(display-p3 1 0.5 0)", "#000");
  assert.equal(report.foreground.mapped, true);
  assert.equal(report.colorSpace, "srgb");
  assert.ok(report.ratio > 7);
});

test("rejects alpha contrast and difference without a backdrop", () => {
  for (const operation of [
    () => calculateContrast("rgb(0 0 0 / 50%)", "#fff"),
    () => calculateColorDifference("#000", "rgb(255 255 255 / 50%)"),
  ]) {
    assert.throws(operation, (error) => {
      assert.ok(error instanceof FlowstackColorError);
      assert.equal(error.code, "alpha-requires-backdrop");
      return true;
    });
  }
});

test("calculates deltaEOK and CIEDE2000 without leaking engine objects", () => {
  assert.equal(colorDifference("#f00", "#f00"), 0);
  const ok = calculateColorDifference("#f00", "#f10");
  const cie = calculateColorDifference("#f00", "#f10", "delta-e-2000");
  assert.equal(ok.method, "delta-e-ok");
  assert.equal(ok.justNoticeableDifference, 0.02);
  assert.ok(ok.value > 0);
  assert.equal(cie.method, "delta-e-2000");
  assert.equal(cie.justNoticeableDifference, null);
  assert.ok(cie.value > 0);
  assert.deepEqual(JSON.parse(JSON.stringify(ok)), ok);
});

test("returns stable diagnostics for invalid inputs", () => {
  assert.deepEqual(validateColor("not-a-color"), {
    valid: false,
    diagnostics: [{
      code: "invalid-color",
      severity: "error",
      path: "$",
      message: "Unable to parse CSS color \"not-a-color\".",
    }],
  });
  assert.equal(validateColor({
    colorSpace: "oklch",
    components: [0.7, "none", 45],
  }).diagnostics[0].code, "missing-component");
  assert.equal(validateColor({
    colorSpace: "srgb",
    components: [0, 0, 0],
    alpha: 2,
  }).diagnostics[0].code, "invalid-alpha");
  assert.equal(validateColor({
    colorSpace: "srgb",
    components: [0, 0, 0],
    hex: "#000",
  }).diagnostics[0].path, "hex");
});

test("rejects unsupported runtime spaces and methods", () => {
  assert.throws(
    () => convertColor("#000", "hsl"),
    (error) => error instanceof FlowstackColorError && error.code === "invalid-color-space",
  );
  assert.throws(
    () => mapColorToGamut("#000", "prophoto-rgb"),
    (error) => error instanceof FlowstackColorError && error.code === "invalid-color-space",
  );
  assert.throws(
    () => calculateColorDifference("#000", "#fff", "unknown"),
    (error) => error instanceof FlowstackColorError,
  );
});

test("records complete deterministic provenance", () => {
  const provenance = createColorProvenance("normalize", {
    zeta: true,
    alpha: 1,
  });
  assert.equal(provenance.$schema, COLOR_PROVENANCE_SCHEMA);
  assert.equal(provenance.producer.version, COLORS_PACKAGE_VERSION);
  assert.equal(provenance.engine.version, COLOR_ENGINE_VERSION);
  assert.deepEqual(Object.keys(provenance.parameters), ["alpha", "zeta"]);
  assert.throws(
    () => createColorProvenance("normalize", { invalid: Number.NaN }),
    /must be a finite number/u,
  );
  assert.throws(
    () => createColorProvenance("unknown"),
    /Unsupported color provenance operation/u,
  );
});

test("keeps recorded package and engine versions aligned with manifests", async () => {
  const packageManifest = JSON.parse(await readFile(resolve("package.json"), "utf8"));
  const engineManifest = JSON.parse(await readFile(resolve("node_modules/culori/package.json"), "utf8"));
  assert.equal(COLORS_PACKAGE_VERSION, packageManifest.version);
  assert.equal(COLOR_ENGINE_VERSION, engineManifest.version);
  assert.equal(packageManifest.dependencies.culori, `^${COLOR_ENGINE_VERSION}`);
});
