# EN-4: Track model, interpolation, heading and derived metrics

**Type:** Enabler (architecture / algorithm) · **Epic:** [EPIC-1](../EPIC-1-gpx-replay.md) · **Priority:** Must · **Labels:** `tech`, `gpx`, `algorithm`

## Summary

A domain model for the track: time and distance lookups, normalized heading, pace, heart rate, elevation and
smoothing. Many features read it: the arrow ([STORY-28](../stories/STORY-28-navigation-arrow.md)),
the tail ([STORY-29](../stories/STORY-29-gpx-tail.md)), course matching ([STORY-22](../stories/STORY-22-auto-match-gpx-to-course.md))
and the data components ([STORY-32](../stories/STORY-32-data-component-videos.md)–[34](../stories/STORY-34-numeric-components.md)).
The model must be **rebuildable from the original GPX plus a list of edits** ([STORY-21](../stories/STORY-21-gpx-editor.md)).

## Scope / acceptance criteria

- [ ] _(POC)_ `Track` built from parsed GPX points. Each point gets relative time `t` (s) and cumulative distance `d` (m).
- [ ] _(POC)_ Timestamps are kept monotonic; without timestamps, timing is synthesised at `FALLBACK_SPEED = 3 m/s`.
- [ ] _(POC)_ Binary-search interpolation: `positionAt(t)`, `positionAtDistance(d)`, `indexAt(t)`. Values outside the track are clamped.
- [ ] _(POC)_ `headingAt(t, window = 30 m)`: bearing of the chord from `d − 15 m` to `d + 15 m`; `null` if the chord is < 1 m.
- [ ] _(POC)_ `speedAt(t, ±5 s)`; `bounds()` for fitting the track.
- [ ] **Per-point extension data**: heart rate, cadence (Garmin `gpxtpx:TrackPointExtension`, other common namespaces) and
      elevation. `hrAt(t)`, `elevationAt(t)`, `paceAt(t)` with configurable smoothing windows.
- [ ] Elevation smoothing (GPS elevation is noisy) and ascent calculation with hysteresis.
- [ ] **Smoothing runs in track time, not wall-clock time.** The POC's `AngleSmoother` runs in wall-clock time, which makes
      videos look different at different speeds and is not deterministic. Replace it with a filter over the track
      (e.g. a precomputed smoothed heading series), so `headingAt(t)` is a pure function. Required by
      [EN-14](./EN-14-animation-timeline-camera.md) and offline export.
- [ ] Immutable model: edits produce a new `Track`. Derived series are recomputed lazily and cached per version.
- [ ] _(POC)_ Unit tests (`tests/track.test.ts`): straight legs, corners (~45°), jitter, standing still, missing time;
      extended with HR/elevation parsing and smoothing.
- [ ] Algorithm checked against at least 5 real orienteering GPX files (forest, urban sprint, poor GPS, watch with HR).
- [ ] Handling of segment gaps and pauses specified (see [STORY-2](../stories/STORY-2-load-gpx.md)).

## POC reference

`src/track.ts`

## Open questions / refinement

- Heading filter: chord method (POC), low-pass filtered velocity vector, or a Kalman filter?
- Should the chord window adapt to speed or map scale?
- Resampling at load time (e.g. fixed 1 Hz) to simplify the model?
- Pace display unit: min/km only, or also km/h?

## Dependencies

[EN-1](./EN-1-geo-math.md)

## Estimate

TBD
