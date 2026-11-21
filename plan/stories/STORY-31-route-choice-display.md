# STORY-31: Show route choices during the leg animation

**Type:** Story · **Epic:** [EPIC-4](../EPIC-4-course-animation.md) · **Priority:** Must · **Labels:** `animation`, `route-choice`

## User story
As a **viewer**, I want to **see the route choices of a leg, with their lengths, at the start of the leg and then have them fade
away**, so that **I can compare the alternatives and then watch which one the runner took**.

## Acceptance criteria
- [ ] Route choices of leg *i* appear when leg *i* starts (when the transition into the leg has ended; setting: "with the
      transition"), with a short fade-in (default 0.3 s).
- [ ] They stay fully visible for a **user-defined display time** (default 6 s video time), then **fade out** over a
      user-defined fade duration (default 1 s). Both are settings in video seconds ([EN-14](../enablers/EN-14-animation-timeline-camera.md)).
      Display time can also be overridden per leg.
- [ ] Option: keep visible for the whole leg.
- [ ] Each route is drawn in its colour (dashed or solid, setting) with a halo, below the tail and arrow.
- [ ] **Length labels**: each route shows its label and length (`A · 640 m`, `B · 1.24 km`) in a callout placed along the
      route, upright whatever the rotation, with collision avoidance between labels and with the control symbols.
- [ ] Optional: the shortest route is marked.
- [ ] Route choices are included in the leg framing while they are visible ([STORY-24](./STORY-24-leg-oriented-view.md)),
      so no route is cut off.
- [ ] If a leg is shorter than display + fade time, the fade ends at the next transition.
- [ ] Preview scrubbing shows exactly the same alpha as the export at any time.

## Dependencies
[STORY-30](./STORY-30-draw-route-choices.md), [STORY-24](./STORY-24-leg-oriented-view.md), [EN-14](../enablers/EN-14-animation-timeline-camera.md)

## Estimate
TBD
