# Changelog

## Unreleased

- Add deterministic multi-seed `interface`, `neutral`, and `decorative`
  candidate generation with independent light/dark relationships, exact or
  explicitly bounded seed preservation, measured contrast and state gates,
  collision warnings, gamut diagnostics, complete provenance, and explainable
  rejection.
- Add 31 standalone FLOWSTACK named light/dark palettes as deterministic
  `raw-reference` output without representing them as accessible themes.
- Canonicalize the meaningless hue of achromatic LCH and OKLCH conversions as
  zero so black, white, and gray remain finite and serializable.
- Implement CSS and Design Tokens color parsing, validation, structured
  normalization, conversion, CSS Color 4 gamut mapping, exact WCAG contrast,
  deltaEOK and CIEDE2000 difference, stable diagnostics, and deterministic
  provenance.
- Add `flowstack.color-record.v1` and `flowstack.color-provenance.v1` without
  finalizing the later palette-candidate schema.
- Require an explicit future backdrop contract before making contrast or
  difference claims about alpha colors.
- Scaffold the independent Colors package and its deterministic candidate
  boundary.
- Reserve interface, neutral, and decorative profiles plus explicit 12-step
  output for qualification before implementation.
- Select Culori 4.0.2 for the implementation after comparing it with
  Color.js 0.7.1 across parsing, conversion, gamut, contrast, package, and
  deterministic evidence. Batch 7.2 promotes it to the color-science runtime
  dependency because shipped source uses its qualified operations.
