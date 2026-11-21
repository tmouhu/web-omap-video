# STORY-5: Free mode – heading-up rotation during playback

**Type:** Story · **Epic:** [EPIC-1](../EPIC-1-gpx-replay.md) · **Priority:** Must · **Labels:** `playback`, `map`

## User story
As an **orienteer without a course set**, I want **the map to turn so that my direction of travel is always up during playback**,
just like holding a map oriented while running, so that **it is easy to see turns and route choices**.
When playback is not running I want **north up** so that I can orient myself.

> In course mode the map is oriented **per leg** instead ([STORY-24](./STORY-24-leg-oriented-view.md)).
> The normalized heading defined here is still used for the navigation arrow ([STORY-28](./STORY-28-navigation-arrow.md)).

## Acceptance criteria
- [ ] *(POC)* During playback the map rotates so the **normalized heading** points up.
- [ ] *(POC)* Normalized heading is the bearing of a 30 m chord of the track around the current position.
      GPS zig-zag jitter (±1.5 m) changes the heading by < 5° (unit-tested).
- [ ] *(POC)* Rotation is smoothed and always turns the short way round across north.
      **Change:** smoothing runs in **track time**, not wall-clock time ([EN-4](../enablers/EN-4-track-model-and-heading.md)),
      so the video looks the same in preview and export and is deterministic.
- [ ] *(POC)* While standing still (chord < 1 m), the previous heading is kept and the map does not spin.
- [ ] *(POC)* When playback pauses or stops, the map returns to north-up quickly (UI-only animation, not part of the video).
- [ ] *(POC)* The north arrow overlay rotates with the map.
- [ ] *(POC)* Exports start already rotated to the initial heading (no spin at the start of the video).
- [ ] Option "north-up during playback" (no rotation).
- [ ] Chord length and smoothing are tuned with real orienteering tracks and can be adjusted in advanced settings.

## POC reference
- `src/track.ts` – `Track.headingAt(t, window = 30)`, `AngleSmoother`
- `src/main.ts` – heading update in `frame()`
- Tests: `tests/track.test.ts`

## Technical notes
- The chord is measured by **distance**, not time, so behaviour does not depend on running speed.

## Open questions / refinement
- Should the chord length scale with the map scale (larger chord at small scales)?

## Dependencies
[STORY-4](./STORY-4-follow-position.md), [EN-4](../enablers/EN-4-track-model-and-heading.md)

## Estimate
TBD
