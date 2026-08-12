export {
  COLOR_ENGINE_NAME,
  COLOR_ENGINE_VERSION,
  COLORS_PACKAGE_VERSION,
  GAMUT_MAPPING_JND,
} from "./constants.js";
export {
  calculateColorDifference,
  calculateContrast,
  colorDifference,
  contrastRatio,
  convertColor,
  mapColorToGamut,
  normalizeColor,
  parseColor,
  validateColor,
} from "./color.js";
export { FlowstackColorError } from "./errors.js";
export { createColorProvenance } from "./provenance.js";
export {
  COLOR_PROVENANCE_SCHEMA,
  COLOR_RECORD_SCHEMA,
  COLORS_CANDIDATE_SCHEMA,
} from "./types.js";
export type {
  BrandSeedInput,
  ColorComponents,
  ColorConversionResult,
  ColorDiagnostic,
  ColorDiagnosticCode,
  ColorDifferenceMethod,
  ColorDifferenceReport,
  ColorInput,
  ColorProvenance,
  ColorRecord,
  ColorSource,
  ColorsCandidateEnvelope,
  ColorValidationResult,
  ContrastReport,
  DtcgColorComponent,
  DtcgColorToken,
  DtcgColorValue,
  GamutMappingResult,
  OutputGamut,
  PaletteProfile,
  SeedPreservationPolicy,
  StructuredColor,
  SupportedColorSpace,
} from "./types.js";

import type { ColorsCandidateEnvelope } from "./types.js";

export function defineColorsCandidate<T extends ColorsCandidateEnvelope>(
  candidate: T,
): T {
  return candidate;
}
