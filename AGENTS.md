# AGENTS.md — @flowstack-ui/colors

This repository contains the public `@flowstack-ui/colors` package.

## Boundary

- Keep the package framework-neutral and independent of React, the DOM,
  Brick, Theme, applications, private brand data, and private FLOWSTACK files.
- Colors proposes deterministic candidates; it does not assign Brick semantic
  meaning or claim that unqualified raw palettes are accessible component
  themes.
- Preserve source colors by default. Any bounded adaptation must be explicitly
  requested and reported with its perceptual difference.
- Existing named palettes and explicit 12-step output remain supported, but
  12 steps are not the universal schema for every palette profile.
- Do not add runtime providers, CSS injection, image extraction, random
  generation, hidden AI decisions, or framework adapters.
- Source belongs in `src/`, tests in `test/`, scripts in `scripts/`, public
  guidance in `docs/`, and machine-readable guidance in `agents/`.
- Do not edit or commit `dist/`, package archives, caches, or `node_modules/`.

## Read first

1. [`README.md`](README.md)
2. [`docs/architecture.md`](docs/architecture.md)
3. [`docs/testing.md`](docs/testing.md)
4. [`CHANGELOG.md`](CHANGELOG.md)

## Verification

Run the complete repository gate before handoff:

```bash
npm run check:repository
```

