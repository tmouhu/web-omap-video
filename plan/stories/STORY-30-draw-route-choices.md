# STORY-30: Draw route choices for each leg

**Type:** Story · **Epic:** [EPIC-4](../EPIC-4-course-animation.md) · **Priority:** Must · **Labels:** `course`, `editor`, `route-choice`

## User story

As an **orienteer or coach**, I want to **draw the possible route choices of a leg on the map**, so that **the video can show the
alternatives and their lengths before the runner's actual choice is revealed**.

## Acceptance criteria

- [ ] Route choice tool, active for a selected leg (choose from the course panel or click a leg). The map can be shown in that
      leg's orientation while drawing.
- [ ] Draw a route as a polyline: click to add points, drag to draw freehand (simplified afterwards), double-click / Enter to finish.
      The first and last points **snap to the leg's controls** (can be turned off).
- [ ] Edit: move/insert/delete vertices, delete the route, reorder routes.
- [ ] Any number of routes per leg. Each route has a **label** (default A, B, C…), a **colour** (from a palette of distinct,
      colour-blind-safe colours that differ from the course purple and the tail), and an optional note.
- [ ] **Length** shown live while drawing and in the list, computed as geodesic length ([EN-1](../enablers/EN-1-geo-math.md)):
      under 1 000 m in metres (e.g. `640 m`, rounded to 5 m), 1 km or more in kilometres (e.g. `1.24 km`, 2 decimals).
- [ ] Optional reference: the runner's actual leg distance shown next to the route choices.
- [ ] Copy routes between legs is not needed. Routes are deleted with their leg if the course changes (with a warning).
- [ ] Stored in the project, undoable.

## Dependencies

[STORY-18](./STORY-18-set-course.md), [EN-15](../enablers/EN-15-project-model-and-persistence.md), [EN-16](../enablers/EN-16-ui-framework-design-system.md)

## Estimate

TBD
