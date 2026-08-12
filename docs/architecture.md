# Colors Architecture

Status: **Batch 7.2 color foundations**

Colors owns framework-independent color science and deterministic palette
candidate generation. Theme owns semantic mapping, exact editable theme
definitions, Brick contract validation, and final static artifacts.

## Dependency direction

```text
Creative or human intent
  -> @flowstack-ui/colors candidate
  -> @flowstack-ui/theme definition
  -> @flowstack-ui/brick semantic contract
```

The arrows describe artifact flow, not runtime dependencies. Colors does not
import Theme or Brick. A deployed application does not require Colors merely
because its CSS originated from a candidate.

## Candidate rules

- Inputs and outputs are serializable and deterministic.
- Multiple named seeds are first-class.
- A seed has an explicit interface, neutral, or decorative profile.
- Exact preservation is the default; adaptation requires an explicit bounded
  policy and complete diagnostics.
- Light and dark are generated and validated independently.
- Every accessibility claim names and measures the exact pair.
- Existing named palettes and requested 12-step scales remain available as
  raw/reference output without automatic Theme qualification.

The `flowstack.colors-candidate.v1` boundary remains experimental until real
generation evidence and Theme interchange finalize it in Batch 7.4.

## Color record

`flowstack.color-record.v1` is the stable Batch 7.2 evidence envelope. It
preserves the exact source, a structured supported-space color, an sRGB
fallback with explicit gamut diagnostics, and deterministic provenance.

Conversions do not silently map gamut. Gamut mapping is a separate named
operation. Contrast maps to exact sRGB and rejects alpha without a backdrop.
See [`color-foundations.md`](color-foundations.md) for the API contract.
