import assert from "node:assert/strict";
import test from "node:test";

import {
  converter,
  formatHex,
  parse,
  toGamut,
  wcagContrast,
} from "culori";

const toOklch = converter("oklch");
const toRgb = converter("rgb");
const mapToSrgb = toGamut("rgb", "oklch");

test("parses the qualified CSS Color 4 input boundary", () => {
  for (const input of [
    "#3157d5",
    "rgb(49 87 213 / 80%)",
    "hsl(224 64% 51%)",
    "oklch(52% 0.18 265)",
    "color(display-p3 1 0.5 0)",
    "transparent",
  ]) {
    assert.notEqual(parse(input), undefined, input);
  }
});

test("round-trips the sRGB qualification grid through OKLCH", () => {
  let maximumError = 0;

  for (let red = 0; red <= 10; red += 1) {
    for (let green = 0; green <= 10; green += 1) {
      for (let blue = 0; blue <= 10; blue += 1) {
        const source = { mode: "rgb", r: red / 10, g: green / 10, b: blue / 10 };
        const result = toRgb(toOklch(source));
        maximumError = Math.max(
          maximumError,
          Math.abs(result.r - source.r),
          Math.abs(result.g - source.g),
          Math.abs(result.b - source.b),
        );
      }
    }
  }

  assert.ok(maximumError < 1e-12, `maximum channel error ${maximumError}`);
});

test("maps difficult colors into sRGB deterministically", () => {
  const cases = new Map([
    ["color(display-p3 1 1 0)", "#feff00"],
    ["oklch(90% 0.4 100)", "#ffdf00"],
    ["oklch(90% 0.35 190)", "#00fff8"],
    ["oklch(70% 0.4 20)", "#ff5464"],
    ["oklch(65% 0.4 150)", "#00b03f"],
    ["oklch(60% 0.4 250)", "#0081f4"],
    ["oklch(55% 0.4 310)", "#a600ef"],
    ["color(display-p3 0 1 0)", "#00fb29"],
    ["color(display-p3 1 0 0.7)", "#ff19b3"],
  ]);

  for (const [input, expectedHex] of cases) {
    const first = mapToSrgb(input);
    const second = mapToSrgb(input);
    for (const channel of [first.r, first.g, first.b]) {
      assert.ok(channel >= -1e-12 && channel <= 1 + 1e-12, `${input}: ${channel}`);
    }
    assert.deepEqual(second, first, input);
    assert.equal(formatHex(first), expectedHex, input);
  }
});

test("matches Theme's exact WCAG contrast vectors", () => {
  for (const [foreground, background, expected] of [
    ["#000000", "#ffffff", 21],
    ["#777777", "#ffffff", 4.478089453577214],
    ["#ff0000", "#ffffff", 3.9984767707539985],
    ["#e97824", "#ffffff", 2.9260988918512716],
  ]) {
    assert.equal(wcagContrast(foreground, background), expected);
  }
});
