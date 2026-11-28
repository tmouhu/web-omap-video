# STORY-47: One global time base for all durations (video seconds / real seconds)

**Type:** Story · **Epic:** [EPIC-6](../EPIC-6-ux-and-project.md) · **Priority:** Should · **Labels:** `settings`, `animation`,
`components`, `ux` · **Status:** approved (Nov 2026), implemented

## User story

As an **orienteer**, I want **one project setting that decides whether all durations I type are video seconds or real (race)
seconds**, so that **I think in one unit everywhere and the animation behaves predictably when I change the playback speed**.

## Background – current state (Nov 2026)

Durations are mixed today, and only route choices have a toggle (`RouteDisplaySettings.timeBase`, "Real seconds (1×)"):

| Setting                                            | Where                   | Unit today                     |
| -------------------------------------------------- | ----------------------- | ------------------------------ |
| Transition delay / duration                        | camera (`CourseCamera`) | video s                        |
| Approach zoom start (`approachSeconds`)            | camera                  | **track s**                    |
| Approach zoom length (`approachDuration`)          | camera                  | video s                        |
| Heading-up rotation smoothing                      | free mode (`Timeline`)  | video s                        |
| Route choices: show / fade in / fade out           | routes                  | video **or** real (own toggle) |
| Tail length (`tailSeconds`)                        | style                   | **track s**                    |
| Splits: show / show at finish / fade in / fade out | components              | video s                        |
| Pace smoothing window (`paceWindow`)               | components              | track s                        |

The UI labels just say "s", so the user cannot tell which is which.

## Acceptance criteria

- [x] Project setting **Time base**: _Video seconds_ (default) / _Real seconds_, shown once in the animation settings with a
      short explanation ("at 10×, 20 real seconds last 2 s in the video"). Saved in the project.
- [x] Every user-facing **display/animation duration** follows it: transition delay and duration, approach zoom start and
      length, rotation smoothing, route display times, tail length (seconds mode), splits display and fade times. Internally
      each is converted to track seconds with one helper (`toTrackSeconds(value, timeBase, speed)`).
- [x] Every duration field shows its unit (e.g. "s (video)" / "s (real)"); slider ranges adapt as the route panel does today.
- [x] Switching the time base **converts the stored numbers with the current speed so the video does not change**, and says
      so in a toast. Changing the speed afterwards keeps the numbers: with video seconds the on-screen timing stays the same,
      with real seconds the race timing stays the same.
- [x] The per-route toggle is removed; route display uses the global time base.
- [x] Style/animation presets store their own time base and are converted when applied.
- [x] **Migration** (`migrate()`): old projects get _Video seconds_; values that were in track seconds (approach start, tail)
      and route values with `timeBase: 'real'` are converted to video seconds with the project speed, so existing videos render
      identically. Unit test: an old project renders the same frame states before and after migration.
- [x] Preview and export use the same conversion; still a pure function of (project, _t_).
- [x] New strings in `en.ts` and `fi.ts`; E2E covers switching the base and the converted values.
- [x] CLAUDE.md rule "user-facing animation durations are VIDEO seconds" updated to describe the time base.

## Decisions (product owner, Nov 2026)

- **Measurement windows do not follow the time base.** The pace smoothing window measures the run, not the animation: it
  always stays in real seconds and is labelled "s (race time)". The same goes for internal constants (heading smoothing,
  progressive-zoom smoothing), which are not user settings.

## Open questions / refinement

1. "Affects the animated components (pace, distance, …)": today only the splits card has display times. Are there other
   component animations the time base should drive (e.g. a future value roll-up or highlight)? Proposed: the rule applies to
   any future component display time.
2. Switching: convert the numbers (video unchanged, proposed) or keep the numbers (video changes)?
3. Migration converts old track-second values to odd numbers (e.g. tail 60 s at 10× → 6 video s). Accept that, or migrate
   such projects to _Real seconds_ when most of their values were in track seconds?

## Dependencies

[STORY-25](./STORY-25-leg-transitions.md), [STORY-27](./STORY-27-approach-zoom.md), [STORY-29](./STORY-29-gpx-tail.md),
[STORY-31](./STORY-31-route-choice-display.md), [STORY-34](./STORY-34-numeric-components.md),
[STORY-39](./STORY-39-animation-settings-and-presets.md), [STORY-41](./STORY-41-import-results-split-comparison.md),
[EN-15](../enablers/EN-15-project-model-and-persistence.md)

## Estimate

TBD
