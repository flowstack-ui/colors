import {
  converter,
  formatHex,
  toGamut,
  wcagContrast,
  type Oklch,
} from "culori";

import {
  calculateContrast,
  convertColor,
  normalizeColor,
  validateColor,
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

void record;
void structured;
void contrast;
void unknownInput;
void valid;
