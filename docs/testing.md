# Colors Testing

Colors must earn trust through exact evidence rather than visual smoothness
alone.

## Repository gate

```bash
npm run check:repository
```

The repository gate covers TypeScript, serializable boundary tests, CSS and
Design Tokens inputs, conversion without hidden mapping, difficult gamut
cases, exact contrast vectors, alpha rejection, difference methods,
provenance, deterministic fixtures, qualified Culori behavior, package
contents, and a clean packed consumer. See
[`dependency-qualification.md`](dependency-qualification.md) for the selection
evidence and requalification triggers. Later batches add:

- state direction and distinguishability;
- independent light and dark generation;
- multi-seed collision diagnostics;
- complete provenance; and
- Theme and rendered Brick qualification.
