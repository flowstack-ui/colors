import {
  converter,
  formatHex,
  toGamut,
  wcagContrast,
  type Oklch,
} from "culori";

const source: Oklch = { mode: "oklch", l: 0.7, c: 0.2, h: 45 };
const mapped = toGamut("rgb", "oklch")(source);
const converted = converter("oklch")(mapped);
const output: string = formatHex(mapped);
const ratio: number = wcagContrast(output, "#ffffff");

void converted;
void ratio;
