# @flowstack-ui/colors

Deterministic, framework-independent color and palette candidate tooling for
Flowstack UI.

> The package is in its private `0.0.0` foundation stage. It is not published
> and does not yet expose a palette generator.

## Boundary

Colors parses and converts colors, maps output gamut, calculates contrast and
perceptual difference, and records deterministic provenance. Later batches use
those foundations to generate explainable palette candidates. Colors does not
know React components or assign semantic meanings such as `accent` or
`warning`.

An approved workflow is:

```text
brand seeds and intent
  -> Colors candidate document
  -> human review
  -> Theme semantic mapping and exact validation
  -> static CSS consumed by Brick and applications
```

Existing named palettes and explicit 12-step light/dark output remain part of
the planned capability. Interface, neutral, and decorative profiles may expose
different shapes appropriate to their purpose.

## Current API

```ts
import {
  calculateColorDifference,
  calculateContrast,
  convertColor,
  mapColorToGamut,
  normalizeColor,
  validateColor,
} from "@flowstack-ui/colors";

const record = normalizeColor("color(display-p3 1 0.5 0)");
// record.color preserves Display P3
// record.srgb.hex === "#ff7d00"
// record.srgb records that gamut mapping occurred

const converted = convertColor("#3157d5", "oklch");
const mapped = mapColorToGamut("oklch(90% 0.4 100)", "srgb");
const contrast = calculateContrast("#111111", "#ffffff");
const difference = calculateColorDifference("#ff0000", "#ff1100");
const validation = validateColor({
  colorSpace: "oklch",
  components: [0.7, 0.2, 45],
});
```

CSS color strings and structured Design Tokens color values are accepted.
Every public result contains plain serializable data; Culori objects and types
do not cross the package boundary.

Contrast and color-difference claims currently require opaque colors. An alpha
color is valid for parsing, normalization, conversion, and gamut mapping, but
comparison fails with `alpha-requires-backdrop` until a future API accepts an
explicit backdrop.

No current color record or future generated candidate should be represented as
Theme- or Brick-qualified until Theme maps and validates its exact values.

## Development

Requires Node.js 22 or newer.

```bash
npm install
npm run check:repository
```

See [`docs/architecture.md`](docs/architecture.md) and
[`docs/testing.md`](docs/testing.md). The Batch 7.1 dependency decision and
measured evidence are in
[`docs/dependency-qualification.md`](docs/dependency-qualification.md).
The complete current API and diagnostic contract is in
[`docs/color-foundations.md`](docs/color-foundations.md).
