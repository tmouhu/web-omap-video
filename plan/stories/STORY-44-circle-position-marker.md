# STORY-44: Circle as an alternative position marker

**Type:** Story · **Epic:** [EPIC-4](../EPIC-4-course-animation.md) · **Priority:** Could · **Labels:** `rendering`, `marker`
· **Status:** approved (Nov 2026), implemented

## User story

As an **orienteer**, I want **to show my position as a circle instead of the navigation arrow**, so that **I can use a calmer
marker (e.g. when the GPS heading is noisy, or when I prefer a classic GPS-replay look)**.

## Acceptance criteria

- [x] Style setting **Position marker**: _Arrow_ (default, [STORY-28](./STORY-28-navigation-arrow.md)) / _Circle_.
      Saved in the project and in style presets; old projects keep _Arrow_.
- [x] The circle uses the same size setting (`arrowSize`, relabelled "Marker size"), fill colour, white outline and drop shadow
      as the arrow, so preview and every video resolution look the same (CSS px × `pixelRatio`).
- [x] The circle's diameter equals the arrow's visual size (not the small standing-still dot of today), and it is centred
      exactly on the position.
- [x] Drawn above the tail and the course, like the arrow. Heading is not needed: the circle looks the same when standing still.
- [x] Optional **centre dot** / ring style (filled disc vs. ring with a transparent centre so the map under the runner stays
      readable). Default: filled disc.
- [x] The setting is shown next to the arrow settings in the style step; arrow-only settings (e.g. arrow responsiveness,
      [STORY-43](./STORY-43-responsive-arrow-heading.md)) are hidden for the circle.
- [ ] All new labels via `t()` (en + fi) ✔. Unit/E2E (setting + save covered; *exported-frame pixel check still missing*): switching the marker changes the exported frame (pixel check at the
      runner position), and the setting survives save/open.

## Technical notes

`drawRunner` (`src/lib/render/scene.ts`) already draws a dot when `heading === null`; add `TrackStyle.markerShape:
'arrow' | 'circle'` (+ `markerRing?: boolean`) and branch on it. `TrackStyle` goes through presets and `ProjectDoc`
(defaults so `migrate()` fills it).

## Open questions / refinement

- Ring vs. filled disc as the default? Proposed: filled disc.

## Dependencies

[STORY-28](./STORY-28-navigation-arrow.md), [STORY-39](./STORY-39-animation-settings-and-presets.md)

## Estimate

TBD
