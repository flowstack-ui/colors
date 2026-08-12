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
- Treat `accepted` as passing only the candidate's declared Colors pairs. Theme
  and rendered Brick qualification are separate later gates.
- Keep named FLOWSTACK palettes labeled `raw-reference`; do not infer interface
  semantics or accessibility from their 12 step positions.

## Current status

The color foundations and experimental palette candidate generator are
implemented. Generated candidates are not yet Theme- or Brick-qualified.
