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

## FLOWSTACK Agent Workflows

Choose the primary workflow before doing task work. Review-only or diagnostic
requests use `$flowstack-ui-review`. Package source, operation API, Agent
Knowledge, dependency, qualification, or release work uses
`$flowstack-ui-maintainer`. A supplied application-plan use of Colors routes to
`$flowstack-ui-compose` in the consuming repository. Other consumer-interface
implementation routes to `$flowstack-ui-builder` outside this package. The
more specific route wins; all Colors package changes use Maintainer.

If the matching skill is not discoverable, read its canonical `SKILL.md` from
an installed or checked-out `flowstack-ui/agent-tools` repository and follow
that workflow manually. If neither is available, preserve the mapping, resolve
exact-version package Agent Knowledge directly, and report the missing skill
instead of substituting remembered guidance.

## Verification

Run the complete repository gate before handoff:

```bash
npm run check:repository
```
