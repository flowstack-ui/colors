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
contents, and a clean packed consumer. Candidate tests add multiple profiles,
independent appearances, exact and bounded preservation, state ordering,
foreground pairs, rejection diagnostics, configurable decorative output,
multi-seed collisions, 31 named raw references, difficult-color gates, and a
byte-stable golden digest. See
[`dependency-qualification.md`](dependency-qualification.md) for the selection
evidence and requalification triggers. Theme interchange and rendered Brick
qualification remain later gates.
