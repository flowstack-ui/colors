# Changelog

## Unreleased

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
  deterministic evidence. Batch 7.2 promotes it to the sole runtime dependency
  because shipped source now uses its qualified color science.
