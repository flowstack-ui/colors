export const COLOR_RECORD_SCHEMA = "flowstack.color-record.v1" as const;
export const COLOR_PROVENANCE_SCHEMA = "flowstack.color-provenance.v1" as const;
export const COLORS_CANDIDATE_SCHEMA = "flowstack.colors-candidate.v1" as const;

export type SupportedColorSpace =
  | "srgb"
  | "srgb-linear"
  | "display-p3"
  | "a98-rgb"
  | "prophoto-rgb"
  | "rec2020"
  | "xyz-d50"
  | "xyz-d65"
  | "lab"
  | "lch"
  | "oklab"
  | "oklch";

export type OutputGamut = "srgb" | "display-p3" | "rec2020";

export type ColorComponents = readonly [number, number, number];

export interface StructuredColor {
  readonly colorSpace: SupportedColorSpace;
  readonly components: ColorComponents;
  readonly alpha: number;
}

export type DtcgColorComponent = number | "none";

export interface DtcgColorValue {
  readonly colorSpace: SupportedColorSpace;
  readonly components: readonly [
    DtcgColorComponent,
    DtcgColorComponent,
    DtcgColorComponent,
  ];
  readonly alpha?: number;
  readonly hex?: string;
}

export interface DtcgColorToken {
  readonly $type?: "color";
  readonly $value: DtcgColorValue;
}

export type ColorInput = string | DtcgColorValue | DtcgColorToken;

export type ColorDiagnosticCode =
  | "invalid-color"
  | "invalid-color-space"
  | "invalid-component"
  | "invalid-alpha"
  | "missing-component"
  | "alpha-requires-backdrop";

export interface ColorDiagnostic {
  readonly code: ColorDiagnosticCode;
  readonly severity: "error";
  readonly path: string;
  readonly message: string;
}

export interface ColorProvenance {
  readonly $schema: typeof COLOR_PROVENANCE_SCHEMA;
  readonly producer: Readonly<{
    name: "@flowstack-ui/colors";
    version: string;
  }>;
  readonly engine: Readonly<{
    name: "culori";
    version: string;
  }>;
  readonly operation: Readonly<{
    name:
      | "normalize"
      | "convert"
      | "gamut-map"
      | "contrast"
      | "difference";
    version: 1;
  }>;
  readonly parameters: Readonly<Record<string, string | number | boolean>>;
}

export interface ColorSource {
  readonly kind: "css" | "dtcg-value" | "dtcg-token";
  readonly value: string | DtcgColorValue | DtcgColorToken;
}

export interface GamutMappingResult {
  readonly source: StructuredColor;
  readonly targetGamut: OutputGamut;
  readonly sourceInGamut: boolean;
  readonly mapped: boolean;
  readonly method: "none" | "css-color-4-oklch-local-minde";
  readonly justNoticeableDifference: 0.02;
  readonly deltaEOK: number;
  readonly color: StructuredColor;
  readonly provenance: ColorProvenance;
}

export interface ColorConversionResult {
  readonly source: StructuredColor;
  readonly targetSpace: SupportedColorSpace;
  readonly color: StructuredColor;
  readonly provenance: ColorProvenance;
}

export interface ColorRecord {
  readonly $schema: typeof COLOR_RECORD_SCHEMA;
  readonly source: ColorSource;
  readonly color: StructuredColor;
  readonly srgb: Readonly<{
    color: StructuredColor;
    hex: string;
    mapped: boolean;
    deltaEOK: number;
    method: GamutMappingResult["method"];
  }>;
  readonly provenance: ColorProvenance;
}

export type ColorValidationResult =
  | Readonly<{ valid: true; color: StructuredColor; diagnostics: readonly [] }>
  | Readonly<{
      valid: false;
      diagnostics: readonly ColorDiagnostic[];
    }>;

export interface ContrastReport {
  readonly algorithm: "wcag2-relative-luminance";
  readonly colorSpace: "srgb";
  readonly foreground: GamutMappingResult;
  readonly background: GamutMappingResult;
  readonly ratio: number;
  readonly passes: Readonly<{
    normalText: boolean;
    largeText: boolean;
    nonText: boolean;
  }>;
  readonly provenance: ColorProvenance;
}

export type ColorDifferenceMethod = "delta-e-ok" | "delta-e-2000";

export interface ColorDifferenceReport {
  readonly method: ColorDifferenceMethod;
  readonly first: StructuredColor;
  readonly second: StructuredColor;
  readonly value: number;
  readonly justNoticeableDifference: number | null;
  readonly provenance: ColorProvenance;
}

export type PaletteProfile = "interface" | "neutral" | "decorative";

export type SeedPreservationPolicy =
  | Readonly<{ mode: "exact" }>
  | Readonly<{ mode: "bounded"; maxDeltaE: number }>;

export interface BrandSeedInput {
  readonly id: string;
  readonly color: string;
  readonly profile: PaletteProfile;
  readonly preservation: SeedPreservationPolicy;
}

export interface ColorsCandidateEnvelope {
  readonly $schema: typeof COLORS_CANDIDATE_SCHEMA;
  readonly seeds: readonly BrandSeedInput[];
}
