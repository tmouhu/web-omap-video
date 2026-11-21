# STORY-2: Load a GPX track

**Type:** Story · **Epic:** [EPIC-1](../EPIC-1-gpx-replay.md) · **Priority:** Must · **Labels:** `gpx`, `ui`

## User story
As a **user**, I want to **upload a GPX file from my device**, so that **my route is drawn on the map**.

## Acceptance criteria
- [ ] *(POC)* A GPX file can be chosen with a file picker or dropped onto the map. The drop target is highlighted while dragging.
- [ ] *(POC)* Track points (`trkpt`) are parsed; if there are none, route points (`rtept`) are used.
- [ ] *(POC)* Namespaced (GPX 1.0/1.1) and non-namespaced files both work. `ele` and `time` are optional.
- [ ] **Heart rate and cadence** are read from common extensions (Garmin `gpxtpx:TrackPointExtension` v1/v2, `ns3:` prefixed
      variants, Suunto/Polar/Coros exports). Available data channels are shown in the summary
      (e.g. "Heart rate ✓, Elevation ✓, Cadence ✗"), because the data components depend on them.
- [ ] *(POC)* Files without timestamps still play back, at an assumed 3 m/s, and the UI says so. Heart rate and other
      time-based values cannot be trusted for such tracks, with an explanation.
- [ ] *(POC)* Invalid XML or fewer than 2 points shows a clear error message instead of breaking the app.
- [ ] *(POC)* After loading, the whole track is drawn and the map fits the track bounds.
- [ ] *(POC)* Track summary is shown: name, length (km), duration, point count, start clock time.
- [ ] *(POC)* A "Load sample" action loads a bundled example (in production: a sample **project** with map, course and GPX).
- [ ] If a course already exists, automatic matching ([STORY-22](./STORY-22-auto-match-gpx-to-course.md)) runs right after loading.
- [ ] Loading a new GPX into a project that has edits/splits asks whether to replace them.
- [ ] The file is processed locally only and never uploaded to a server. The UI states this.
- [ ] Large files (e.g. 50 000+ points) load in < 1 s on a mid-range laptop.

## POC reference
- `src/gpx.ts` (`parseGpx`), `src/track.ts` (`Track` constructor), `src/main.ts` (`loadGpxText`, `fitTrack`)
- Sample: `public/sample.gpx`, generator `scripts/make-sample.mjs`
- Tests: `tests/gpx.test.ts`, `e2e/app.spec.ts`

## Technical notes
- Timestamps that go backwards are clamped so time is monotonic.
- Multiple `trkseg`/`trk` elements are currently concatenated into one track.

## Open questions / refinement
- How should gaps between track segments be handled (pause, or skip in time)?
- Support FIT / TCX too? (FIT is the native format of Garmin/Suunto/Coros and always has HR.) Proposed as a follow-up story.
- Trimming start/end is now part of the GPX editor ([STORY-21](./STORY-21-gpx-editor.md)).

## Dependencies
[EN-4](../enablers/EN-4-track-model-and-heading.md)

## Estimate
TBD
