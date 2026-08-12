# FLOWSTACK Colors system

## Purpose

Generate and inspect deterministic color candidates without assigning
component semantics or hiding changes to brand colors.

## Rules

- Treat Colors output as a candidate until a person approves it and Theme maps
  and validates its exact values.
- Preserve source colors by default. Adapt only under an explicit bounded
  policy and report the perceptual change.
- Claim accessibility only for exact measured foreground/background pairs.
- Keep conversion separate from gamut mapping and report every gamut change.
- Require an explicit backdrop before comparing translucent colors.
- Do not infer semantic meaning merely from hue.
- Keep Colors outside React and the deployed browser runtime.
- Pin the qualified color engine exactly and treat its recorded version as part
  of deterministic provenance.
- Treat `accepted` as passing only the candidate's declared Colors pairs. Theme
  mapping and rendered Brick qualification remain separate per-candidate gates.
- Record an explicit review decision before giving a serialized candidate to
  Theme, and preserve the exact evidence when accepting or rejecting it.
- Supply every intended interface reference surface when a family must work
  across canvas, raised, overlay, or similar backgrounds.
- Keep named FLOWSTACK palettes labeled `raw-reference`; do not infer interface
  semantics or accessibility from their 12 step positions.

## Current status

Version 0.1 contains the qualified color foundations, candidate generator, and
serialized Theme interchange. New candidates remain unreviewed and unqualified
until they pass the same workflow. Package, schema, and algorithm compatibility
are separate; never regenerate an accepted Theme merely because a dependency
version changed.
