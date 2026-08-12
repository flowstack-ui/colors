import {
  converter,
  formatHex,
  toGamut,
  wcagContrast,
  type Oklch,
} from "culori";

import {
  COLOR_GENERATION_REQUEST_SCHEMA,
  calculateContrast,
  convertColor,
  defineColorGenerationRequest,
  generatePaletteCandidate,
  getNamedPalette,
  normalizeColor,
  validateColor,
  type ColorGenerationRequest,
  type ColorsCandidateEnvelope,
  type ColorRecord,
  type DtcgColorValue,
  type StructuredColor,
} from "../../dist/index.js";

const source: Oklch = { mode: "oklch", l: 0.7, c: 0.2, h: 45 };
const mapped = toGamut("rgb", "oklch")(source);
const converted = converter("oklch")(mapped);
const output: string = formatHex(mapped);
const ratio: number = wcagContrast(output, "#ffffff");

void converted;
void ratio;

const token: DtcgColorValue = {
  colorSpace: "oklch",
  components: [0.7, 0.2, 45],
};
const record: ColorRecord = normalizeColor(token);
const structured: StructuredColor = convertColor(token, "display-p3").color;
const contrast: number = calculateContrast("#000", "#fff").ratio;
const unknownInput: unknown = token;
const valid: boolean = validateColor(unknownInput).valid;
const generationRequest: ColorGenerationRequest = defineColorGenerationRequest({
  $schema: COLOR_GENERATION_REQUEST_SCHEMA,
  seeds: [
    { id: "brand", color: "#3157d5", profile: "interface" },
    {
      id: "campaign",
      color: token,
      profile: "decorative",
      options: { steps: 5, anchorStep: 3 },
    },
  ],
});
const candidate: ColorsCandidateEnvelope = generatePaletteCandidate(generationRequest);
const namedBlue: string = getNamedPalette("blue").light[8];

void record;
void structured;
void contrast;
void unknownInput;
void valid;
void candidate;
void namedBlue;
