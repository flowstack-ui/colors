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
byte-stable golden digest. It also covers explicit review decisions, neutral
inverse text, and interface qualification against multiple exact project
surfaces. See
[`dependency-qualification.md`](dependency-qualification.md) for the selection
evidence and requalification triggers. The file interchange has additionally
passed a private real Theme compilation with all 152 Brick contrast results and
the complete 80-route desktop/mobile light/dark catalog. Those cross-repository
gates must be repeated when candidate meaning or mapping behavior changes.

## Release gate

```bash
npm run check:release
```

The release gate equals the complete repository gate. It verifies the public
source boundary, release metadata and pinned workflow actions, exact engine
version, candidate behavior, types, deterministic fixtures, archive contents,
and a clean JavaScript and TypeScript consumer installed from the archive.

Publishing happens only from a matching immutable tag on `main`. The protected
workflow rebuilds and repeats this gate, uploads one archive, then publishes
that exact archive with npm provenance. See
[`releasing.md`](releasing.md).
