/** Experimental candidate boundary reserved during Colors Batch 7.1. */
export const COLORS_CANDIDATE_SCHEMA = "flowstack.colors-candidate.v1" as const;

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

export function defineColorsCandidate<T extends ColorsCandidateEnvelope>(
  candidate: T,
): T {
  return candidate;
}

