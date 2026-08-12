# Colors Testing

Colors must earn trust through exact evidence rather than visual smoothness
alone.

## Repository gate

```bash
npm run check:repository
```

The Batch 7.1 gate covers TypeScript, serializable boundary tests, deterministic
fixtures, the qualified Culori behavior, package contents, and a clean packed
consumer. See
[`dependency-qualification.md`](dependency-qualification.md) for the selection
evidence and requalification triggers. Later batches add:

- source-backed color conversion and gamut vectors;
- difficult hue, black, white, gray, and gamut-boundary cases;
- exact WCAG foreground/background measurements;
- state direction and distinguishability;
- independent light and dark generation;
- multi-seed collision diagnostics;
- complete provenance; and
- Theme and rendered Brick qualification.
