import {
  converter,
  differenceEuclidean,
  formatHex,
  formatHex8,
  inGamut,
  parse,
  toGamut,
  type Color,
  type Mode,
} from "culori";

import { GAMUT_MAPPING_JND } from "./constants.js";
import { colorError } from "./errors.js";
import type {
  ColorComponents,
  DtcgColorValue,
  GamutMappingResult,
  OutputGamut,
  StructuredColor,
  SupportedColorSpace,
} from "./types.js";
import { createColorProvenance } from "./provenance.js";

const publicToCuloriMode = {
  srgb: "rgb",
  "srgb-linear": "lrgb",
  "display-p3": "p3",
  "a98-rgb": "a98",
  "prophoto-rgb": "prophoto",
  rec2020: "rec2020",
  "xyz-d50": "xyz50",
  "xyz-d65": "xyz65",
  lab: "lab",
  lch: "lch",
  oklab: "oklab",
  oklch: "oklch",
} as const satisfies Record<SupportedColorSpace, Mode>;

const culoriToPublicMode = Object.fromEntries(
  Object.entries(publicToCuloriMode).map(([publicMode, culoriMode]) => [
    culoriMode,
    publicMode,
  ]),
) as Record<Mode, SupportedColorSpace | undefined>;

const coordinateKeys: Record<SupportedColorSpace, readonly [string, string, string]> = {
  srgb: ["r", "g", "b"],
  "srgb-linear": ["r", "g", "b"],
  "display-p3": ["r", "g", "b"],
  "a98-rgb": ["r", "g", "b"],
  "prophoto-rgb": ["r", "g", "b"],
  rec2020: ["r", "g", "b"],
  "xyz-d50": ["x", "y", "z"],
  "xyz-d65": ["x", "y", "z"],
  lab: ["l", "a", "b"],
  lch: ["l", "c", "h"],
  oklab: ["l", "a", "b"],
  oklch: ["l", "c", "h"],
};

function normalizeNumber(value: number): number {
  if (Object.is(value, -0) || Math.abs(value) < 1e-15) return 0;
  return value;
}

function clampGamutBoundary(value: number): number {
  if (value < 0 && value >= -1e-12) return 0;
  if (value > 1 && value <= 1 + 1e-12) return 1;
  return normalizeNumber(value);
}

function assertFinite(value: unknown, path: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw colorError(
      "invalid-component",
      path,
      `Expected a finite numeric color component at ${path}.`,
    );
  }
}

function assertAlpha(value: unknown, path: string): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw colorError(
      "invalid-alpha",
      path,
      `Expected alpha between 0 and 1 at ${path}.`,
    );
  }
}

export function structuredToCulori(color: StructuredColor): Color {
  const mode = publicToCuloriMode[color.colorSpace];
  const keys = coordinateKeys[color.colorSpace];
  return {
    mode,
    [keys[0]]: color.components[0],
    [keys[1]]: color.components[1],
    [keys[2]]: color.components[2],
    alpha: color.alpha,
  } as unknown as Color;
}

export function culoriToStructured(
  color: Color,
  requestedSpace?: SupportedColorSpace,
  clampBoundary = false,
): StructuredColor {
  const colorSpace = requestedSpace ?? culoriToPublicMode[color.mode];
  if (!colorSpace) {
    const rgb = converter("rgb")(color);
    return culoriToStructured(rgb, "srgb", clampBoundary);
  }
  const keys = coordinateKeys[colorSpace];
  const values = keys.map((key, index) => {
    const value = (color as unknown as Record<string, number | undefined>)[key];
    // Hue is undefined for an achromatic polar color. Zero is the canonical,
    // serializable representation because every hue describes the same color
    // when chroma is zero.
    if (
      key === "h" &&
      value === undefined &&
      (color as unknown as Record<string, number | undefined>)[keys[index - 1] ?? ""] === 0
    ) {
      return 0;
    }
    return value;
  });
  const finiteValues = values.map((value, index) => {
    assertFinite(value, `components.${index}`);
    return value;
  });
  const alpha = color.alpha ?? 1;
  assertAlpha(alpha, "alpha");
  const normalize = clampBoundary ? clampGamutBoundary : normalizeNumber;
  return {
    colorSpace,
    components: finiteValues.map(normalize) as unknown as ColorComponents,
    alpha: normalizeNumber(alpha),
  };
}

export function parseCssColor(input: string): StructuredColor {
  const parsed = parse(input);
  if (!parsed) {
    throw colorError(
      "invalid-color",
      "$",
      `Unable to parse CSS color ${JSON.stringify(input)}.`,
    );
  }
  return culoriToStructured(parsed);
}

export function parseDtcgValue(value: DtcgColorValue): StructuredColor {
  if (!(value.colorSpace in publicToCuloriMode)) {
    throw colorError(
      "invalid-color-space",
      "colorSpace",
      `Unsupported color space ${JSON.stringify(value.colorSpace)}.`,
    );
  }
  if (!Array.isArray(value.components) || value.components.length !== 3) {
    throw colorError(
      "invalid-component",
      "components",
      "Expected exactly three color components.",
    );
  }
  const components = value.components.map((component, index) => {
    if (component === "none") {
      throw colorError(
        "missing-component",
        `components.${index}`,
        "The 'none' component requires interpolation context and cannot be normalized independently.",
      );
    }
    assertFinite(component, `components.${index}`);
    return normalizeNumber(component);
  }) as unknown as ColorComponents;
  const alpha = value.alpha ?? 1;
  assertAlpha(alpha, "alpha");
  if (
    value.hex !== undefined &&
    (typeof value.hex !== "string" || !/^#[\da-f]{6}(?:[\da-f]{2})?$/iu.test(value.hex))
  ) {
    throw colorError(
      "invalid-color",
      "hex",
      "Expected an optional six- or eight-digit Design Tokens hex fallback.",
    );
  }
  return {
    colorSpace: value.colorSpace,
    components,
    alpha: normalizeNumber(alpha),
  };
}

export function convertStructuredColor(
  color: StructuredColor,
  targetSpace: SupportedColorSpace,
): StructuredColor {
  if (!(targetSpace in publicToCuloriMode)) {
    throw colorError(
      "invalid-color-space",
      "targetSpace",
      `Unsupported target color space ${JSON.stringify(targetSpace)}.`,
    );
  }
  const converted = converter(publicToCuloriMode[targetSpace])(
    structuredToCulori(color),
  );
  return culoriToStructured(converted, targetSpace);
}

export function mapStructuredColorToGamut(
  color: StructuredColor,
  targetGamut: OutputGamut,
): GamutMappingResult {
  if (!["srgb", "display-p3", "rec2020"].includes(targetGamut)) {
    throw colorError(
      "invalid-color-space",
      "targetGamut",
      `Unsupported output gamut ${JSON.stringify(targetGamut)}.`,
    );
  }
  const targetMode = publicToCuloriMode[targetGamut];
  const source = structuredToCulori(color);
  const sourceInGamut = inGamut(targetMode)(source);
  const mappedCulori = sourceInGamut
    ? converter(targetMode)(source)
    : toGamut(targetMode, "oklch")(source);
  const mappedColor = culoriToStructured(mappedCulori, targetGamut, true);
  const deltaEOK = sourceInGamut
    ? 0
    : differenceEuclidean("oklch")(source, structuredToCulori(mappedColor));
  return {
    source: color,
    targetGamut,
    sourceInGamut,
    mapped: !sourceInGamut,
    method: sourceInGamut ? "none" : "css-color-4-oklch-local-minde",
    justNoticeableDifference: GAMUT_MAPPING_JND,
    deltaEOK: normalizeNumber(deltaEOK),
    color: mappedColor,
    provenance: createColorProvenance("gamut-map", {
      targetGamut,
      method: sourceInGamut ? "none" : "css-color-4-oklch-local-minde",
      justNoticeableDifference: GAMUT_MAPPING_JND,
    }),
  };
}

export function formatSrgbHex(color: StructuredColor): string {
  const culoriColor = structuredToCulori(color);
  return (color.alpha < 1 ? formatHex8(culoriColor) : formatHex(culoriColor)).toLowerCase();
}

export function deltaEOK(first: StructuredColor, second: StructuredColor): number {
  return normalizeNumber(
    differenceEuclidean("oklch")(
      structuredToCulori(first),
      structuredToCulori(second),
    ),
  );
}
