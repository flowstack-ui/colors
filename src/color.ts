import { differenceCiede2000, wcagContrast } from "culori";

import {
  convertStructuredColor,
  deltaEOK,
  formatSrgbHex,
  mapStructuredColorToGamut,
  parseCssColor,
  parseDtcgValue,
  structuredToCulori,
} from "./culori-adapter.js";
import { colorError, FlowstackColorError } from "./errors.js";
import { createColorProvenance } from "./provenance.js";
import {
  COLOR_RECORD_SCHEMA,
  type ColorConversionResult,
  type ColorDifferenceMethod,
  type ColorDifferenceReport,
  type ColorInput,
  type ColorRecord,
  type ColorSource,
  type ColorValidationResult,
  type ContrastReport,
  type DtcgColorToken,
  type DtcgColorValue,
  type GamutMappingResult,
  type OutputGamut,
  type StructuredColor,
  type SupportedColorSpace,
} from "./types.js";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDtcgToken(value: unknown): value is DtcgColorToken {
  return isObject(value) && "$value" in value;
}

function cloneDtcgValue(value: DtcgColorValue): DtcgColorValue {
  return {
    colorSpace: value.colorSpace,
    components: [...value.components] as DtcgColorValue["components"],
    ...(value.alpha === undefined ? {} : { alpha: value.alpha }),
    ...(value.hex === undefined ? {} : { hex: value.hex }),
  };
}

function getSource(input: ColorInput): ColorSource {
  if (typeof input === "string") return { kind: "css", value: input };
  if (isDtcgToken(input)) {
    return {
      kind: "dtcg-token",
      value: {
        ...(input.$type === undefined ? {} : { $type: input.$type }),
        $value: cloneDtcgValue(input.$value),
      },
    };
  }
  return { kind: "dtcg-value", value: cloneDtcgValue(input) };
}

export function parseColor(input: ColorInput): StructuredColor {
  if (typeof input === "string") return parseCssColor(input);
  if (!isObject(input)) {
    throw colorError(
      "invalid-color",
      "$",
      "Expected a CSS color string or Design Tokens color object.",
    );
  }
  if (isDtcgToken(input)) {
    if (input.$type !== undefined && input.$type !== "color") {
      throw colorError(
        "invalid-color",
        "$type",
        "A Design Tokens color token must use $type 'color'.",
      );
    }
    if (!isObject(input.$value)) {
      throw colorError(
        "invalid-color",
        "$value",
        "Expected a structured Design Tokens color value.",
      );
    }
    return parseDtcgValue(input.$value);
  }
  return parseDtcgValue(input as DtcgColorValue);
}

export function validateColor(input: unknown): ColorValidationResult {
  try {
    return {
      valid: true,
      color: parseColor(input as ColorInput),
      diagnostics: [],
    };
  } catch (error) {
    if (error instanceof FlowstackColorError) {
      return { valid: false, diagnostics: [error.toDiagnostic()] };
    }
    throw error;
  }
}

export function convertColor(
  input: ColorInput,
  targetSpace: SupportedColorSpace,
): ColorConversionResult {
  const source = parseColor(input);
  return {
    source,
    targetSpace,
    color: convertStructuredColor(source, targetSpace),
    provenance: createColorProvenance("convert", { targetSpace }),
  };
}

export function mapColorToGamut(
  input: ColorInput,
  targetGamut: OutputGamut = "srgb",
): GamutMappingResult {
  return mapStructuredColorToGamut(parseColor(input), targetGamut);
}

export function normalizeColor(input: ColorInput): ColorRecord {
  const color = parseColor(input);
  const srgb = mapStructuredColorToGamut(color, "srgb");
  return {
    $schema: COLOR_RECORD_SCHEMA,
    source: getSource(input),
    color,
    srgb: {
      color: srgb.color,
      hex: formatSrgbHex(srgb.color),
      mapped: srgb.mapped,
      deltaEOK: srgb.deltaEOK,
      method: srgb.method,
    },
    provenance: createColorProvenance("normalize", {
      targetGamut: "srgb",
      gamutMapping: "css-color-4-oklch-local-minde",
    }),
  };
}

function requireOpaque(color: StructuredColor, path: string): void {
  if (color.alpha !== 1) {
    throw colorError(
      "alpha-requires-backdrop",
      path,
      `Cannot calculate an exact ${path} claim for alpha ${color.alpha} without an explicit backdrop.`,
    );
  }
}

export function calculateContrast(
  foregroundInput: ColorInput,
  backgroundInput: ColorInput,
): ContrastReport {
  const foreground = mapColorToGamut(foregroundInput, "srgb");
  const background = mapColorToGamut(backgroundInput, "srgb");
  requireOpaque(foreground.color, "foreground");
  requireOpaque(background.color, "background");
  const ratio = wcagContrast(
    structuredToCulori(foreground.color),
    structuredToCulori(background.color),
  );
  return {
    algorithm: "wcag2-relative-luminance",
    colorSpace: "srgb",
    foreground,
    background,
    ratio,
    passes: {
      normalText: ratio >= 4.5,
      largeText: ratio >= 3,
      nonText: ratio >= 3,
    },
    provenance: createColorProvenance("contrast", {
      algorithm: "wcag2-relative-luminance",
      colorSpace: "srgb",
      normalTextMinimum: 4.5,
      largeTextMinimum: 3,
      nonTextMinimum: 3,
    }),
  };
}

export function contrastRatio(
  foreground: ColorInput,
  background: ColorInput,
): number {
  return calculateContrast(foreground, background).ratio;
}

export function calculateColorDifference(
  firstInput: ColorInput,
  secondInput: ColorInput,
  method: ColorDifferenceMethod = "delta-e-ok",
): ColorDifferenceReport {
  if (method !== "delta-e-ok" && method !== "delta-e-2000") {
    throw colorError(
      "invalid-color",
      "method",
      `Unsupported color-difference method ${JSON.stringify(method)}.`,
    );
  }
  const first = parseColor(firstInput);
  const second = parseColor(secondInput);
  requireOpaque(first, "first color");
  requireOpaque(second, "second color");
  const value = method === "delta-e-ok"
    ? deltaEOK(first, second)
    : differenceCiede2000()(structuredToCulori(first), structuredToCulori(second));
  return {
    method,
    first,
    second,
    value,
    justNoticeableDifference: method === "delta-e-ok" ? 0.02 : null,
    provenance: createColorProvenance("difference", {
      method,
      alpha: "opaque-only",
    }),
  };
}

export function colorDifference(
  first: ColorInput,
  second: ColorInput,
  method: ColorDifferenceMethod = "delta-e-ok",
): number {
  return calculateColorDifference(first, second, method).value;
}
