import {
  calculateColorDifference,
  calculateContrast,
  normalizeColor,
  parseColor,
} from "./color.js";
import {
  convertStructuredColor,
  deltaEOK,
  formatSrgbHex,
  mapStructuredColorToGamut,
} from "./culori-adapter.js";
import { createColorProvenance } from "./provenance.js";
import {
  COLOR_GENERATION_REQUEST_SCHEMA,
  COLORS_CANDIDATE_SCHEMA,
  type BrandSeedInput,
  type CandidateAppearance,
  type CandidateColorValue,
  type CandidateMeasurement,
  type ColorGenerationRequest,
  type ColorsCandidateEnvelope,
  type DecorativeCandidateAppearance,
  type DecorativeCandidateFamily,
  type DifferenceMeasurement,
  type GenerationDiagnostic,
  type InterfaceCandidateFamily,
  type InterfaceRole,
  type NeutralCandidateFamily,
  type NeutralRole,
  type PaletteAppearance,
  type PaletteCandidateFamily,
  type SeedPreservationPolicy,
  type StructuredColor,
} from "./types.js";

const DEFAULT_APPEARANCES = ["light", "dark"] as const;
const DEFAULT_STATE_MINIMUM_DELTA = 0.02;
const DEFAULT_COLLISION_MINIMUM_DELTA = 0.05;
const DEFAULT_TEXT_MINIMUM_CONTRAST = 4.5;
const DEFAULT_NON_TEXT_MINIMUM_CONTRAST = 3;

interface ResolvedConstraints {
  readonly stateMinimumDeltaEOK: number;
  readonly collisionMinimumDeltaEOK: number;
  readonly textMinimumContrast: number;
  readonly nonTextMinimumContrast: number;
}

interface ProfileResult {
  readonly appearances: InterfaceCandidateFamily["appearances"]
    | NeutralCandidateFamily["appearances"]
    | DecorativeCandidateFamily["appearances"];
  readonly diagnostics: readonly GenerationDiagnostic[];
}

function requestError(path: string, message: string): never {
  throw new TypeError(`Invalid Colors generation request at ${path}: ${message}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireFiniteMinimum(value: unknown, path: string, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    requestError(path, "expected a finite number greater than or equal to zero");
  }
  return value;
}

function resolveConstraints(request: ColorGenerationRequest): ResolvedConstraints {
  if (request.constraints !== undefined && !isObject(request.constraints)) {
    requestError("constraints", "expected an object");
  }
  const resolved = {
    stateMinimumDeltaEOK: requireFiniteMinimum(
      request.constraints?.stateMinimumDeltaEOK,
      "constraints.stateMinimumDeltaEOK",
      DEFAULT_STATE_MINIMUM_DELTA,
    ),
    collisionMinimumDeltaEOK: requireFiniteMinimum(
      request.constraints?.collisionMinimumDeltaEOK,
      "constraints.collisionMinimumDeltaEOK",
      DEFAULT_COLLISION_MINIMUM_DELTA,
    ),
    textMinimumContrast: requireFiniteMinimum(
      request.constraints?.textMinimumContrast,
      "constraints.textMinimumContrast",
      DEFAULT_TEXT_MINIMUM_CONTRAST,
    ),
    nonTextMinimumContrast: requireFiniteMinimum(
      request.constraints?.nonTextMinimumContrast,
      "constraints.nonTextMinimumContrast",
      DEFAULT_NON_TEXT_MINIMUM_CONTRAST,
    ),
  };
  if (resolved.stateMinimumDeltaEOK < DEFAULT_STATE_MINIMUM_DELTA) {
    requestError(
      "constraints.stateMinimumDeltaEOK",
      `cannot be lower than ${DEFAULT_STATE_MINIMUM_DELTA}`,
    );
  }
  if (resolved.textMinimumContrast < DEFAULT_TEXT_MINIMUM_CONTRAST) {
    requestError(
      "constraints.textMinimumContrast",
      `cannot be lower than ${DEFAULT_TEXT_MINIMUM_CONTRAST}`,
    );
  }
  if (resolved.nonTextMinimumContrast < DEFAULT_NON_TEXT_MINIMUM_CONTRAST) {
    requestError(
      "constraints.nonTextMinimumContrast",
      `cannot be lower than ${DEFAULT_NON_TEXT_MINIMUM_CONTRAST}`,
    );
  }
  return resolved;
}

function resolveAppearances(seed: BrandSeedInput, path: string): readonly PaletteAppearance[] {
  const appearances = seed.options?.appearances ?? DEFAULT_APPEARANCES;
  if (!Array.isArray(appearances) || appearances.length === 0) {
    requestError(`${path}.options.appearances`, "expected at least one appearance");
  }
  const seen = new Set<string>();
  for (const appearance of appearances) {
    if (appearance !== "light" && appearance !== "dark") {
      requestError(`${path}.options.appearances`, "only 'light' and 'dark' are supported");
    }
    if (seen.has(appearance)) {
      requestError(`${path}.options.appearances`, `duplicate appearance '${appearance}'`);
    }
    seen.add(appearance);
  }
  return [...appearances];
}

function validateRequest(request: ColorGenerationRequest): ResolvedConstraints {
  if (!isObject(request)) requestError("$", "expected an object");
  if (request.$schema !== COLOR_GENERATION_REQUEST_SCHEMA) {
    requestError("$schema", `expected '${COLOR_GENERATION_REQUEST_SCHEMA}'`);
  }
  if (!Array.isArray(request.seeds) || request.seeds.length === 0) {
    requestError("seeds", "expected at least one seed");
  }
  const ids = new Set<string>();
  (request.seeds as readonly unknown[]).forEach((rawSeed, index) => {
    const path = `seeds.${index}`;
    if (!isObject(rawSeed)) requestError(path, "expected an object");
    if (typeof rawSeed.id !== "string" || rawSeed.id.trim() === "") {
      requestError(`${path}.id`, "expected a non-empty string");
    }
    if (ids.has(rawSeed.id)) requestError(`${path}.id`, `duplicate seed id '${rawSeed.id}'`);
    ids.add(rawSeed.id);
    if (typeof rawSeed.profile !== "string" || !["interface", "neutral", "decorative"].includes(rawSeed.profile)) {
      requestError(`${path}.profile`, "expected 'interface', 'neutral', or 'decorative'");
    }
    const seed = rawSeed as unknown as BrandSeedInput;
    if (seed.name !== undefined && typeof seed.name !== "string") {
      requestError(`${path}.name`, "expected a string");
    }
    if (seed.intent !== undefined && typeof seed.intent !== "string") {
      requestError(`${path}.intent`, "expected a string");
    }
    if (seed.options !== undefined && !isObject(seed.options)) {
      requestError(`${path}.options`, "expected an object");
    }
    if (seed.preservation !== undefined) {
      if (!isObject(seed.preservation)) {
        requestError(`${path}.preservation`, "expected an object");
      }
      if (seed.preservation.mode === "bounded") {
        if (seed.preservation.maxDeltaE === undefined) {
          requestError(`${path}.preservation.maxDeltaE`, "is required for bounded preservation");
        }
        requireFiniteMinimum(
          seed.preservation.maxDeltaE,
          `${path}.preservation.maxDeltaE`,
          0,
        );
      } else if (seed.preservation.mode !== "exact") {
        requestError(`${path}.preservation.mode`, "expected 'exact' or 'bounded'");
      }
    }
    resolveAppearances(seed, path);
    if (seed.profile === "interface") {
      for (const [appearance, background] of Object.entries(
        seed.options?.referenceBackgrounds ?? {},
      )) {
        if (appearance !== "light" && appearance !== "dark") {
          requestError(`${path}.options.referenceBackgrounds.${appearance}`, "unsupported appearance");
        }
        try {
          if (parseColor(background).alpha !== 1) {
            requestError(
              `${path}.options.referenceBackgrounds.${appearance}`,
              "an opaque reference background is required",
            );
          }
        } catch (error) {
          requestError(
            `${path}.options.referenceBackgrounds.${appearance}`,
            error instanceof Error ? error.message : "invalid color",
          );
        }
      }
    }
    if (seed.profile === "decorative") {
      const steps = seed.options?.steps ?? 12;
      if (!Number.isInteger(steps) || steps < 3 || steps > 24) {
        requestError(`${path}.options.steps`, "expected an integer from 3 through 24");
      }
      const defaultAnchor = Math.min(9, steps - 1);
      const anchorStep = seed.options?.anchorStep ?? defaultAnchor;
      if (!Number.isInteger(anchorStep) || anchorStep < 2 || anchorStep >= steps) {
        requestError(
          `${path}.options.anchorStep`,
          `expected an integer from 2 through ${steps - 1}`,
        );
      }
    }
    // Parsing here makes malformed colors request errors instead of rejected
    // design candidates: there is no meaningful family to explain without a color.
    try {
      parseColor(seed.color);
    } catch (error) {
      requestError(`${path}.color`, error instanceof Error ? error.message : "invalid color");
    }
  });
  return resolveConstraints(request);
}

function exactPolicy(seed: BrandSeedInput): SeedPreservationPolicy {
  return seed.preservation ?? { mode: "exact" };
}

function oklch(lightness: number, chroma: number, hue: number): StructuredColor {
  return {
    colorSpace: "oklch",
    components: [
      Math.max(0, Math.min(1, lightness)),
      Math.max(0, chroma),
      Number.isFinite(hue) ? hue : 0,
    ],
    alpha: 1,
  };
}

function candidateColor(
  role: string,
  desired: StructuredColor,
  seedColor: StructuredColor,
): CandidateColorValue {
  const mapped = mapStructuredColorToGamut(desired, "srgb");
  const hex = formatSrgbHex(mapped.color);
  const exact = parseColor(hex);
  return {
    role,
    desired,
    srgb: {
      color: exact,
      hex,
      mapped: mapped.mapped,
      deltaEOK: mapped.deltaEOK,
      method: mapped.method,
    },
    deltaFromSeed: deltaEOK(seedColor, exact),
  };
}

function withRole(value: CandidateColorValue, role: string): CandidateColorValue {
  return { ...value, role };
}

function exactLightness(value: CandidateColorValue): number {
  return convertStructuredColor(value.srgb.color, "oklch").components[0];
}

function bestBinaryForeground(
  role: string,
  backgrounds: readonly CandidateColorValue[],
  seedColor: StructuredColor,
): CandidateColorValue {
  const choices = ["#000000", "#ffffff"].map((hex) => {
    const color = candidateColor(role, parseColor(hex), seedColor);
    const minimum = Math.min(...backgrounds.map((background) =>
      calculateContrast(color.srgb.hex, background.srgb.hex).ratio
    ));
    return { color, minimum };
  });
  return choices[0].minimum >= choices[1].minimum ? choices[0].color : choices[1].color;
}

function textCandidate(
  role: string,
  appearance: PaletteAppearance,
  seedOklch: StructuredColor,
  seedColor: StructuredColor,
  backgrounds: readonly CandidateColorValue[],
  minimum: number,
  targetLightness?: number,
): CandidateColorValue {
  const [, chroma, hue] = seedOklch.components;
  const target = candidateColor(
    role,
    oklch(
      targetLightness ?? (appearance === "light" ? 0.3 : 0.88),
      Math.min(chroma * 0.4, 0.08),
      hue,
    ),
    seedColor,
  );
  if (backgrounds.every((background) =>
    calculateContrast(target.srgb.hex, background.srgb.hex).ratio >= minimum
  )) return target;
  return bestBinaryForeground(role, backgrounds, seedColor);
}

function contrastColorNear(
  role: string,
  appearance: PaletteAppearance,
  targetLightness: number,
  chroma: number,
  hue: number,
  background: CandidateColorValue,
  minimum: number,
  seedColor: StructuredColor,
): CandidateColorValue {
  const candidates: CandidateColorValue[] = [];
  for (let index = 2; index <= 98; index += 1) {
    candidates.push(candidateColor(role, oklch(index / 100, chroma, hue), seedColor));
  }
  const passing = candidates.filter((value) =>
    calculateContrast(value.srgb.hex, background.srgb.hex).ratio >= minimum
  );
  passing.sort((first, second) => {
    const firstDistance = Math.abs(exactLightness(first) - targetLightness);
    const secondDistance = Math.abs(exactLightness(second) - targetLightness);
    if (firstDistance !== secondDistance) return firstDistance - secondDistance;
    return appearance === "light"
      ? exactLightness(second) - exactLightness(first)
      : exactLightness(first) - exactLightness(second);
  });
  return passing[0] ?? bestBinaryForeground(role, [background], seedColor);
}

function gamutDiagnostics(
  values: readonly CandidateColorValue[],
  path: string,
): GenerationDiagnostic[] {
  return values
    .filter((value) => value.srgb.mapped)
    .map((value) => ({
      code: "gamut-mapped" as const,
      severity: "warning" as const,
      path: `${path}.${value.role}`,
      message: `${value.role} was perceptually gamut-mapped to exact sRGB output.`,
      measured: value.srgb.deltaEOK,
      required: 0,
    }));
}

function measureContrast(
  measurements: CandidateMeasurement[],
  diagnostics: GenerationDiagnostic[],
  foreground: CandidateColorValue,
  background: CandidateColorValue,
  minimum: number,
  path: string,
): void {
  const ratio = calculateContrast(foreground.srgb.hex, background.srgb.hex).ratio;
  const passed = ratio >= minimum;
  measurements.push({
    kind: "contrast",
    foreground: foreground.role,
    background: background.role,
    ratio,
    minimum,
    passed,
  });
  if (!passed) diagnostics.push({
    code: "contrast-failed",
    severity: "error",
    path,
    message: `${foreground.role} on ${background.role} has ${ratio.toFixed(3)}:1 contrast; ${minimum}:1 is required.`,
    measured: ratio,
    required: minimum,
  });
}

function measureDifference(
  measurements: CandidateMeasurement[] | DifferenceMeasurement[],
  diagnostics: GenerationDiagnostic[],
  first: CandidateColorValue,
  second: CandidateColorValue,
  minimum: number,
  path: string,
  code: "state-distinction-failed" | "decorative-step-collision" = "state-distinction-failed",
): void {
  const difference = calculateColorDifference(first.srgb.hex, second.srgb.hex).value;
  const passed = difference >= minimum;
  measurements.push({
    kind: "difference",
    first: first.role,
    second: second.role,
    deltaEOK: difference,
    minimum,
    passed,
  });
  if (!passed) diagnostics.push({
    code,
    severity: "error",
    path,
    message: `${first.role} and ${second.role} differ by ${difference.toFixed(4)} deltaEOK; ${minimum} is required.`,
    measured: difference,
    required: minimum,
  });
}

function measureOrder(
  diagnostics: GenerationDiagnostic[],
  values: readonly CandidateColorValue[],
  appearance: PaletteAppearance,
  path: string,
  code: "state-order-failed" | "decorative-order-failed" = "state-order-failed",
): void {
  const lightness = values.map(exactLightness);
  const ordered = lightness.every((value, index) => index === 0 || (
    appearance === "light" ? lightness[index - 1] > value : lightness[index - 1] < value
  ));
  if (!ordered) diagnostics.push({
    code,
    severity: "error",
    path,
    message: `${values.map((value) => value.role).join(" → ")} does not follow the required ${appearance} appearance lightness direction.`,
  });
}

function interfaceAppearance(
  appearance: PaletteAppearance,
  seed: Extract<BrandSeedInput, { profile: "interface" }>,
  anchor: CandidateColorValue,
  constraints: ResolvedConstraints,
): CandidateAppearance<InterfaceRole> {
  const path = `families.${seed.id}.appearances.${appearance}`;
  const seedColor = anchor.srgb.color;
  const seedOklch = convertStructuredColor(seedColor, "oklch");
  const [anchorLightness, anchorChroma, hue] = seedOklch.components;
  const referenceInput = seed.options?.referenceBackgrounds?.[appearance]
    ?? (appearance === "light" ? "#ffffff" : "#111111");
  const reference = candidateColor("referenceBackground", parseColor(referenceInput), seedColor);
  if (reference.srgb.color.alpha !== 1) {
    requestError(`${path}.referenceBackground`, "an opaque reference background is required");
  }
  const direction = appearance === "light" ? -1 : 1;
  const softTargets = appearance === "light" ? [0.97, 0.925, 0.875] : [0.17, 0.225, 0.285];
  const soft = candidateColor("soft", oklch(softTargets[0], anchorChroma * 0.1, hue), seedColor);
  const softHover = candidateColor("softHover", oklch(softTargets[1], anchorChroma * 0.16, hue), seedColor);
  const softPressed = candidateColor("softPressed", oklch(softTargets[2], anchorChroma * 0.23, hue), seedColor);
  const border = candidateColor(
    "border",
    oklch(appearance === "light" ? 0.78 : 0.4, anchorChroma * 0.38, hue),
    seedColor,
  );
  const borderStrong = contrastColorNear(
    "borderStrong",
    appearance,
    appearance === "light" ? 0.67 : 0.53,
    anchorChroma * 0.55,
    hue,
    reference,
    constraints.nonTextMinimumContrast,
    seedColor,
  );
  const focusRing = contrastColorNear(
    "focusRing",
    appearance,
    anchorLightness,
    anchorChroma,
    hue,
    reference,
    constraints.nonTextMinimumContrast,
    seedColor,
  );
  const solid = withRole(anchor, "solid");
  const solidHover = candidateColor(
    "solidHover",
    oklch(anchorLightness + direction * 0.03, anchorChroma, hue),
    seedColor,
  );
  const solidPressed = candidateColor(
    "solidPressed",
    oklch(anchorLightness + direction * 0.045, anchorChroma * 0.84, hue),
    seedColor,
  );
  const softBackgrounds = [soft, softHover, softPressed];
  const text = textCandidate(
    "text",
    appearance,
    seedOklch,
    seedColor,
    [reference, ...softBackgrounds],
    constraints.textMinimumContrast,
  );
  const onSoft = withRole(text, "onSoft");
  const solidBackgrounds = [solid, solidHover, solidPressed];
  const onSolid = bestBinaryForeground("onSolid", solidBackgrounds, seedColor);
  const roles: Record<InterfaceRole, CandidateColorValue> = {
    soft,
    softHover,
    softPressed,
    border,
    borderStrong,
    focusRing,
    solid,
    solidHover,
    solidPressed,
    text,
    onSoft,
    onSolid,
  };
  const diagnostics = gamutDiagnostics(Object.values(roles), `${path}.roles`);
  const measurements: CandidateMeasurement[] = [];
  measureOrder(diagnostics, softBackgrounds, appearance, `${path}.roles.softStates`);
  measureOrder(diagnostics, solidBackgrounds, appearance, `${path}.roles.solidStates`);
  measureDifference(measurements, diagnostics, soft, softHover, constraints.stateMinimumDeltaEOK, `${path}.roles.soft-softHover`);
  measureDifference(measurements, diagnostics, softHover, softPressed, constraints.stateMinimumDeltaEOK, `${path}.roles.softHover-softPressed`);
  measureDifference(measurements, diagnostics, solid, solidHover, constraints.stateMinimumDeltaEOK, `${path}.roles.solid-solidHover`);
  measureDifference(measurements, diagnostics, solidHover, solidPressed, constraints.stateMinimumDeltaEOK, `${path}.roles.solidHover-solidPressed`);
  for (const background of softBackgrounds) {
    measureContrast(measurements, diagnostics, onSoft, background, constraints.textMinimumContrast, `${path}.pairs.onSoft-${background.role}`);
  }
  for (const background of solidBackgrounds) {
    measureContrast(measurements, diagnostics, onSolid, background, constraints.textMinimumContrast, `${path}.pairs.onSolid-${background.role}`);
  }
  measureContrast(measurements, diagnostics, text, reference, constraints.textMinimumContrast, `${path}.pairs.text-referenceBackground`);
  measureContrast(measurements, diagnostics, solid, reference, constraints.nonTextMinimumContrast, `${path}.pairs.solid-referenceBackground`);
  measureContrast(measurements, diagnostics, focusRing, reference, constraints.nonTextMinimumContrast, `${path}.pairs.focusRing-referenceBackground`);
  measureContrast(measurements, diagnostics, borderStrong, reference, constraints.nonTextMinimumContrast, `${path}.pairs.borderStrong-referenceBackground`);
  return { referenceBackground: reference, roles, measurements, diagnostics };
}

function buildInterface(
  seed: Extract<BrandSeedInput, { profile: "interface" }>,
  anchor: CandidateColorValue,
  constraints: ResolvedConstraints,
): ProfileResult {
  const appearances: InterfaceCandidateFamily["appearances"] = {};
  const diagnostics: GenerationDiagnostic[] = [];
  for (const appearance of resolveAppearances(seed, `families.${seed.id}`)) {
    const result = interfaceAppearance(appearance, seed, anchor, constraints);
    appearances[appearance] = result;
    diagnostics.push(...result.diagnostics);
  }
  return { appearances, diagnostics };
}

function neutralAppearance(
  appearance: PaletteAppearance,
  seed: Extract<BrandSeedInput, { profile: "neutral" }>,
  anchor: CandidateColorValue,
  constraints: ResolvedConstraints,
): CandidateAppearance<NeutralRole> {
  const path = `families.${seed.id}.appearances.${appearance}`;
  const seedColor = anchor.srgb.color;
  const seedOklch = convertStructuredColor(seedColor, "oklch");
  const [, seedChroma, hue] = seedOklch.components;
  const chroma = Math.min(seedChroma * 0.12, 0.025);
  const lightness = appearance === "light"
    ? [0.995, 0.975, 0.95, 0.915, 0.875, 0.78]
    : [0.105, 0.14, 0.18, 0.225, 0.28, 0.39];
  const canvas = candidateColor("canvas", oklch(lightness[0], chroma * 0.2, hue), seedColor);
  const surface = candidateColor("surface", oklch(lightness[1], chroma * 0.35, hue), seedColor);
  const surfaceRaised = candidateColor("surfaceRaised", oklch(lightness[2], chroma * 0.5, hue), seedColor);
  const surfaceHover = candidateColor("surfaceHover", oklch(lightness[3], chroma * 0.65, hue), seedColor);
  const surfacePressed = candidateColor("surfacePressed", oklch(lightness[4], chroma * 0.8, hue), seedColor);
  const border = candidateColor("border", oklch(lightness[5], chroma, hue), seedColor);
  const borderStrong = contrastColorNear(
    "borderStrong",
    appearance,
    appearance === "light" ? 0.62 : 0.55,
    chroma,
    hue,
    canvas,
    constraints.nonTextMinimumContrast,
    seedColor,
  );
  const textBackgrounds = [canvas, surface, surfaceRaised, surfaceHover, surfacePressed];
  const textMuted = textCandidate(
    "textMuted",
    appearance,
    seedOklch,
    seedColor,
    textBackgrounds,
    constraints.textMinimumContrast,
    appearance === "light" ? 0.48 : 0.68,
  );
  const text = textCandidate(
    "text",
    appearance,
    seedOklch,
    seedColor,
    textBackgrounds,
    constraints.textMinimumContrast,
    appearance === "light" ? 0.3 : 0.86,
  );
  const textStrong = textCandidate(
    "textStrong",
    appearance,
    seedOklch,
    seedColor,
    textBackgrounds,
    constraints.textMinimumContrast,
    appearance === "light" ? 0.18 : 0.94,
  );
  const roles: Record<NeutralRole, CandidateColorValue> = {
    canvas,
    surface,
    surfaceRaised,
    surfaceHover,
    surfacePressed,
    border,
    borderStrong,
    textMuted,
    text,
    textStrong,
  };
  const diagnostics = gamutDiagnostics(Object.values(roles), `${path}.roles`);
  const measurements: CandidateMeasurement[] = [];
  const surfaceStates = [surfaceRaised, surfaceHover, surfacePressed];
  measureOrder(diagnostics, surfaceStates, appearance, `${path}.roles.surfaceStates`);
  measureDifference(measurements, diagnostics, surfaceRaised, surfaceHover, constraints.stateMinimumDeltaEOK, `${path}.roles.surfaceRaised-surfaceHover`);
  measureDifference(measurements, diagnostics, surfaceHover, surfacePressed, constraints.stateMinimumDeltaEOK, `${path}.roles.surfaceHover-surfacePressed`);
  for (const foreground of [textMuted, text, textStrong]) {
    for (const background of textBackgrounds) {
      measureContrast(measurements, diagnostics, foreground, background, constraints.textMinimumContrast, `${path}.pairs.${foreground.role}-${background.role}`);
    }
  }
  measureContrast(measurements, diagnostics, borderStrong, canvas, constraints.nonTextMinimumContrast, `${path}.pairs.borderStrong-canvas`);
  return {
    referenceBackground: withRole(canvas, "referenceBackground"),
    roles,
    measurements,
    diagnostics,
  };
}

function buildNeutral(
  seed: Extract<BrandSeedInput, { profile: "neutral" }>,
  anchor: CandidateColorValue,
  constraints: ResolvedConstraints,
): ProfileResult {
  const appearances: NeutralCandidateFamily["appearances"] = {};
  const diagnostics: GenerationDiagnostic[] = [];
  for (const appearance of resolveAppearances(seed, `families.${seed.id}`)) {
    const result = neutralAppearance(appearance, seed, anchor, constraints);
    appearances[appearance] = result;
    diagnostics.push(...result.diagnostics);
  }
  return { appearances, diagnostics };
}

function decorativeAppearance(
  appearance: PaletteAppearance,
  seed: Extract<BrandSeedInput, { profile: "decorative" }>,
  anchor: CandidateColorValue,
  constraints: ResolvedConstraints,
): DecorativeCandidateAppearance {
  const path = `families.${seed.id}.appearances.${appearance}`;
  const stepsCount = seed.options?.steps ?? 12;
  const anchorStep = seed.options?.anchorStep ?? Math.min(9, stepsCount - 1);
  const anchorIndex = anchorStep - 1;
  const seedColor = anchor.srgb.color;
  const [anchorLightness, anchorChroma, hue] = convertStructuredColor(seedColor, "oklch").components;
  const startLightness = appearance === "light" ? 0.985 : 0.11;
  const endLightness = appearance === "light" ? 0.18 : 0.94;
  const steps: CandidateColorValue[] = [];
  for (let index = 0; index < stepsCount; index += 1) {
    if (index === anchorIndex) {
      steps.push(withRole(anchor, `step-${index + 1}`));
      continue;
    }
    const beforeAnchor = index < anchorIndex;
    const progress = beforeAnchor
      ? index / anchorIndex
      : (index - anchorIndex) / (stepsCount - 1 - anchorIndex);
    const fromLightness = beforeAnchor ? startLightness : anchorLightness;
    const toLightness = beforeAnchor ? anchorLightness : endLightness;
    const fromChroma = beforeAnchor ? anchorChroma * 0.04 : anchorChroma;
    const toChroma = beforeAnchor ? anchorChroma : anchorChroma * 0.35;
    steps.push(candidateColor(
      `step-${index + 1}`,
      oklch(
        fromLightness + (toLightness - fromLightness) * progress,
        fromChroma + (toChroma - fromChroma) * progress,
        hue,
      ),
      seedColor,
    ));
  }
  const diagnostics = gamutDiagnostics(steps, `${path}.steps`);
  const measurements: DifferenceMeasurement[] = [];
  measureOrder(diagnostics, steps, appearance, `${path}.steps`, "decorative-order-failed");
  for (let index = 1; index < steps.length; index += 1) {
    measureDifference(
      measurements,
      diagnostics,
      steps[index - 1],
      steps[index],
      constraints.stateMinimumDeltaEOK,
      `${path}.steps.${index}-${index + 1}`,
      "decorative-step-collision",
    );
  }
  return { steps, anchorStep, measurements, diagnostics };
}

function buildDecorative(
  seed: Extract<BrandSeedInput, { profile: "decorative" }>,
  anchor: CandidateColorValue,
  constraints: ResolvedConstraints,
): ProfileResult {
  const appearances: DecorativeCandidateFamily["appearances"] = {};
  const diagnostics: GenerationDiagnostic[] = [];
  for (const appearance of resolveAppearances(seed, `families.${seed.id}`)) {
    const result = decorativeAppearance(appearance, seed, anchor, constraints);
    appearances[appearance] = result;
    diagnostics.push(...result.diagnostics);
  }
  return { appearances, diagnostics };
}

function buildProfile(
  seed: BrandSeedInput,
  anchor: CandidateColorValue,
  constraints: ResolvedConstraints,
): ProfileResult {
  if (seed.profile === "interface") return buildInterface(seed, anchor, constraints);
  if (seed.profile === "neutral") return buildNeutral(seed, anchor, constraints);
  return buildDecorative(seed, anchor, constraints);
}

function hasErrors(diagnostics: readonly GenerationDiagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}

function adaptationCandidates(
  seedColor: StructuredColor,
  anchor: CandidateColorValue,
  maxDeltaE: number,
): CandidateColorValue[] {
  const [, chroma, hue] = convertStructuredColor(anchor.srgb.color, "oklch").components;
  const byHex = new Map<string, CandidateColorValue>();
  for (let lightnessIndex = 5; lightnessIndex <= 95; lightnessIndex += 1) {
    for (const chromaFactor of [1, 0.85, 0.7]) {
      const value = candidateColor(
        "anchor",
        oklch(lightnessIndex / 100, chroma * chromaFactor, hue),
        seedColor,
      );
      if (value.deltaFromSeed <= maxDeltaE) byHex.set(value.srgb.hex, value);
    }
  }
  return [...byHex.values()].sort((first, second) =>
    first.deltaFromSeed - second.deltaFromSeed || first.srgb.hex.localeCompare(second.srgb.hex)
  );
}

function generateFamily(
  seed: BrandSeedInput,
  constraints: ResolvedConstraints,
): PaletteCandidateFamily {
  const source = normalizeColor(seed.color);
  const policy = exactPolicy(seed);
  const parsedSeedColor = parseColor(source.srgb.hex);
  const initialSeedColor = parsedSeedColor.alpha === 1
    ? parsedSeedColor
    : { ...parsedSeedColor, alpha: 1 };
  let anchor = candidateColor("anchor", initialSeedColor, source.color);
  let profile = buildProfile(seed, anchor, constraints);
  const preservationDiagnostics: GenerationDiagnostic[] = [];

  if (source.color.alpha !== 1) {
    preservationDiagnostics.push({
      code: "seed-alpha-unsupported",
      severity: "error",
      path: `families.${seed.id}.source.color.alpha`,
      message: "Palette generation requires an opaque seed because no backdrop was supplied.",
      measured: source.color.alpha,
      required: 1,
    });
  } else if (policy.mode === "exact" && source.srgb.mapped) {
    preservationDiagnostics.push({
      code: "exact-seed-outside-srgb",
      severity: "error",
      path: `families.${seed.id}.preservation`,
      message: "The exact seed is outside sRGB; choose bounded preservation or supply an in-gamut seed.",
      measured: source.srgb.deltaEOK,
      required: 0,
    });
  } else if (policy.mode === "bounded") {
    const initialDelta = deltaEOK(source.color, anchor.srgb.color);
    if (initialDelta <= policy.maxDeltaE && hasErrors(profile.diagnostics)) {
      const replacement = adaptationCandidates(source.color, anchor, policy.maxDeltaE)
        .map((candidate) => ({ candidate, profile: buildProfile(seed, candidate, constraints) }))
        .find((result) => !hasErrors(result.profile.diagnostics));
      if (replacement) {
        anchor = replacement.candidate;
        profile = replacement.profile;
      }
    }
    if (anchor.deltaFromSeed > policy.maxDeltaE || hasErrors(profile.diagnostics)) {
      preservationDiagnostics.push({
        code: "preservation-bound-exceeded",
        severity: "error",
        path: `families.${seed.id}.preservation`,
        message: `No candidate satisfying all constraints stays within the allowed ${policy.maxDeltaE} deltaEOK adaptation.`,
        measured: anchor.deltaFromSeed,
        required: policy.maxDeltaE,
      });
    }
  }

  const diagnostics = [...preservationDiagnostics, ...profile.diagnostics];
  const preservationDelta = deltaEOK(source.color, anchor.srgb.color);
  const preservation = {
    requested: policy,
    seedHex: source.srgb.hex,
    anchorHex: anchor.srgb.hex,
    adapted: anchor.srgb.hex !== source.srgb.hex || source.srgb.mapped,
    deltaEOK: preservationDelta,
    satisfied: !hasErrors(preservationDiagnostics),
  } as const;
  const base = {
    id: seed.id,
    ...(seed.name === undefined ? {} : { name: seed.name }),
    ...(seed.intent === undefined ? {} : { intent: seed.intent }),
    status: hasErrors(diagnostics) ? "rejected" as const : "accepted" as const,
    source,
    preservation,
    anchor,
    diagnostics,
  };
  if (seed.profile === "interface") {
    return { ...base, profile: "interface", appearances: profile.appearances as InterfaceCandidateFamily["appearances"] };
  }
  if (seed.profile === "neutral") {
    return { ...base, profile: "neutral", appearances: profile.appearances as NeutralCandidateFamily["appearances"] };
  }
  return { ...base, profile: "decorative", appearances: profile.appearances as DecorativeCandidateFamily["appearances"] };
}

function collisionDiagnostics(
  families: readonly PaletteCandidateFamily[],
  minimum: number,
): GenerationDiagnostic[] {
  const diagnostics: GenerationDiagnostic[] = [];
  for (let firstIndex = 0; firstIndex < families.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < families.length; secondIndex += 1) {
      const first = families[firstIndex];
      const second = families[secondIndex];
      const difference = calculateColorDifference(first.anchor.srgb.hex, second.anchor.srgb.hex).value;
      if (difference < minimum) diagnostics.push({
        code: "family-collision",
        severity: "warning",
        path: `families.${first.id}|${second.id}`,
        message: `Seed families '${first.id}' and '${second.id}' differ by only ${difference.toFixed(4)} deltaEOK.`,
        measured: difference,
        required: minimum,
      });
    }
  }
  return diagnostics;
}

export function generatePaletteCandidate(
  request: ColorGenerationRequest,
): ColorsCandidateEnvelope {
  const constraints = validateRequest(request);
  const families = request.seeds.map((seed) => generateFamily(seed, constraints));
  const collisions = collisionDiagnostics(families, constraints.collisionMinimumDeltaEOK);
  const diagnostics = [...families.flatMap((family) => family.diagnostics), ...collisions];
  return {
    $schema: COLORS_CANDIDATE_SCHEMA,
    requestSchema: COLOR_GENERATION_REQUEST_SCHEMA,
    status: families.some((family) => family.status === "rejected") || hasErrors(collisions)
      ? "rejected"
      : "accepted",
    families,
    diagnostics,
    review: { status: "unreviewed" },
    provenance: createColorProvenance("generate", {
      algorithm: "flowstack-palette-v1",
      collisionMinimumDeltaEOK: constraints.collisionMinimumDeltaEOK,
      familyCount: families.length,
      nonTextMinimumContrast: constraints.nonTextMinimumContrast,
      stateMinimumDeltaEOK: constraints.stateMinimumDeltaEOK,
      textMinimumContrast: constraints.textMinimumContrast,
    }),
  };
}

export function defineColorGenerationRequest<T extends ColorGenerationRequest>(request: T): T {
  return request;
}
