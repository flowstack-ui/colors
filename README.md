# @flowstack-ui/colors

Deterministic, framework-independent color and palette candidate tooling for
Flowstack UI.

> The package is in its private `0.0.0` foundation stage. It is not published
> and does not yet expose a qualified palette generator.

## Boundary

Colors will parse and convert colors, map output gamut, calculate contrast and
perceptual difference, and generate explainable palette candidates. It does
not know React components or assign semantic meanings such as `accent` or
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

Only the experimental serializable boundary types are present during the
dependency qualification. No generated candidate should yet be represented as
Theme- or Brick-qualified.

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
