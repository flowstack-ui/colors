export const COLOR_RECORD_SCHEMA = "flowstack.color-record.v1" as const;
export const COLOR_PROVENANCE_SCHEMA = "flowstack.color-provenance.v1" as const;
export const COLOR_GENERATION_REQUEST_SCHEMA = "flowstack.colors-request.v1" as const;
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
      | "difference"
      | "generate";
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

export type PaletteAppearance = "light" | "dark";

export type TwelveStepScale = readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

export type NamedPaletteName =
  | "gray"
  | "mauve"
  | "slate"
  | "sage"
  | "olive"
  | "sand"
  | "tomato"
  | "red"
  | "ruby"
  | "crimson"
  | "pink"
  | "plum"
  | "purple"
  | "violet"
  | "iris"
  | "indigo"
  | "blue"
  | "cyan"
  | "teal"
  | "jade"
  | "green"
  | "grass"
  | "lime"
  | "mint"
  | "sky"
  | "gold"
  | "bronze"
  | "brown"
  | "yellow"
  | "amber"
  | "orange";

export interface NamedPaletteReference {
  readonly name: NamedPaletteName;
  readonly seed: string;
  readonly light: TwelveStepScale;
  readonly dark: TwelveStepScale;
  readonly qualification: "raw-reference";
  readonly source: Readonly<{
    name: "@flowstack-ui/colors";
    algorithm: "flowstack-palette-v1";
  }>;
}

export type SeedPreservationPolicy =
  | Readonly<{ mode: "exact" }>
  | Readonly<{ mode: "bounded"; maxDeltaE: number }>;

export interface PaletteSeedBase {
  readonly id: string;
  readonly name?: string;
  readonly intent?: string;
  readonly color: ColorInput;
  readonly preservation?: SeedPreservationPolicy;
}

export interface InterfaceSeedInput extends PaletteSeedBase {
  readonly profile: "interface";
  readonly options?: Readonly<{
    appearances?: readonly PaletteAppearance[];
    referenceBackgrounds?: Partial<Record<PaletteAppearance, ColorInput>>;
  }>;
}

export interface NeutralSeedInput extends PaletteSeedBase {
  readonly profile: "neutral";
  readonly options?: Readonly<{
    appearances?: readonly PaletteAppearance[];
  }>;
}

export interface DecorativeSeedInput extends PaletteSeedBase {
  readonly profile: "decorative";
  readonly options?: Readonly<{
    appearances?: readonly PaletteAppearance[];
    steps?: number;
    anchorStep?: number;
  }>;
}

export type BrandSeedInput =
  | InterfaceSeedInput
  | NeutralSeedInput
  | DecorativeSeedInput;

export interface ColorGenerationRequest {
  readonly $schema: typeof COLOR_GENERATION_REQUEST_SCHEMA;
  readonly seeds: readonly BrandSeedInput[];
  readonly constraints?: Readonly<{
    stateMinimumDeltaEOK?: number;
    collisionMinimumDeltaEOK?: number;
    textMinimumContrast?: number;
    nonTextMinimumContrast?: number;
  }>;
}

export type CandidateStatus = "accepted" | "rejected";

export type GenerationDiagnosticCode =
  | "seed-alpha-unsupported"
  | "exact-seed-outside-srgb"
  | "preservation-bound-exceeded"
  | "gamut-mapped"
  | "contrast-failed"
  | "state-order-failed"
  | "state-distinction-failed"
  | "decorative-order-failed"
  | "decorative-step-collision"
  | "family-collision";

export interface GenerationDiagnostic {
  readonly code: GenerationDiagnosticCode;
  readonly severity: "error" | "warning";
  readonly path: string;
  readonly message: string;
  readonly measured?: number;
  readonly required?: number;
}

export interface CandidateColorValue {
  readonly role: string;
  readonly desired: StructuredColor;
  readonly srgb: Readonly<{
    color: StructuredColor;
    hex: string;
    mapped: boolean;
    deltaEOK: number;
    method: GamutMappingResult["method"];
  }>;
  readonly deltaFromSeed: number;
}

export interface ContrastMeasurement {
  readonly kind: "contrast";
  readonly foreground: string;
  readonly background: string;
  readonly ratio: number;
  readonly minimum: number;
  readonly passed: boolean;
}

export interface DifferenceMeasurement {
  readonly kind: "difference";
  readonly first: string;
  readonly second: string;
  readonly deltaEOK: number;
  readonly minimum: number;
  readonly passed: boolean;
}

export type CandidateMeasurement = ContrastMeasurement | DifferenceMeasurement;

export interface SeedPreservationResult {
  readonly requested: SeedPreservationPolicy;
  readonly seedHex: string;
  readonly anchorHex: string;
  readonly adapted: boolean;
  readonly deltaEOK: number;
  readonly satisfied: boolean;
}

export type InterfaceRole =
  | "soft"
  | "softHover"
  | "softPressed"
  | "border"
  | "borderStrong"
  | "focusRing"
  | "solid"
  | "solidHover"
  | "solidPressed"
  | "text"
  | "onSoft"
  | "onSolid";

export type NeutralRole =
  | "canvas"
  | "surface"
  | "surfaceRaised"
  | "surfaceHover"
  | "surfacePressed"
  | "border"
  | "borderStrong"
  | "textMuted"
  | "text"
  | "textStrong";

export interface CandidateAppearance<TRole extends string = string> {
  readonly referenceBackground: CandidateColorValue;
  readonly roles: Readonly<Record<TRole, CandidateColorValue>>;
  readonly measurements: readonly CandidateMeasurement[];
  readonly diagnostics: readonly GenerationDiagnostic[];
}

export interface CandidateFamilyBase {
  readonly id: string;
  readonly name?: string;
  readonly intent?: string;
  readonly status: CandidateStatus;
  readonly source: ColorRecord;
  readonly preservation: SeedPreservationResult;
  readonly anchor: CandidateColorValue;
  readonly diagnostics: readonly GenerationDiagnostic[];
}

export interface InterfaceCandidateFamily extends CandidateFamilyBase {
  readonly profile: "interface";
  readonly appearances: Partial<
    Record<PaletteAppearance, CandidateAppearance<InterfaceRole>>
  >;
}

export interface NeutralCandidateFamily extends CandidateFamilyBase {
  readonly profile: "neutral";
  readonly appearances: Partial<
    Record<PaletteAppearance, CandidateAppearance<NeutralRole>>
  >;
}

export interface DecorativeCandidateAppearance {
  readonly steps: readonly CandidateColorValue[];
  readonly anchorStep: number;
  readonly measurements: readonly DifferenceMeasurement[];
  readonly diagnostics: readonly GenerationDiagnostic[];
}

export interface DecorativeCandidateFamily extends CandidateFamilyBase {
  readonly profile: "decorative";
  readonly appearances: Partial<
    Record<PaletteAppearance, DecorativeCandidateAppearance>
  >;
}

export type PaletteCandidateFamily =
  | InterfaceCandidateFamily
  | NeutralCandidateFamily
  | DecorativeCandidateFamily;

export interface ColorsCandidateEnvelope {
  readonly $schema: typeof COLORS_CANDIDATE_SCHEMA;
  readonly requestSchema: typeof COLOR_GENERATION_REQUEST_SCHEMA;
  readonly status: CandidateStatus;
  readonly families: readonly PaletteCandidateFamily[];
  readonly diagnostics: readonly GenerationDiagnostic[];
  readonly review: Readonly<{ status: "unreviewed" }>;
  readonly provenance: ColorProvenance;
}
