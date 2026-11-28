# STORY-18: Set an orienteering course

**Type:** Story · **Epic:** [EPIC-3](../EPIC-3-course-and-gpx.md) · **Priority:** Must · **Labels:** `course`, `orienteering`, `ui`

## User story

As an **orienteer**, I want to **place the start, the controls and the finish of my course on the map**,
so that **the animation can follow the course leg by leg**.

## Acceptance criteria

- [ ] A course consists of **one start, at least one control and one finish**, in order. The app does not allow animating
      a course that does not meet this, and shows what is missing.
- [ ] Course tool: click to place the start, then controls in order, then "finish" (button or double-click / Enter).
      Control numbers are assigned in order.
- [ ] Edit: drag to move, insert a control between two others (click on a leg line), delete, reorder in the course list.
- [ ] Each control has an optional **control code** (e.g. 31) and an optional description. The number shown is the
      sequence number by default.
- [ ] The same control location can appear twice in the sequence (butterfly/loop courses).
- [ ] Course list panel: legs with straight-line lengths (m / km) and the total course length.
- [ ] Placement accuracy: zoom up to 1:1 000; snapping to the raster map is not needed.
- [ ] Course geometry is stored in WGS84 ([EN-15](../enablers/EN-15-project-model-and-persistence.md)) and survives CRS changes.
- [ ] All edits are undoable.

## Open questions / refinement

- Score-O / free-order courses: out of scope (the leg-based camera needs a fixed order).
- Mandatory crossing points / marked routes between controls (ISOM 708 / 709)? Proposed: later story.

## Dependencies

[EN-2](../enablers/EN-2-canvas-map-renderer.md), [EN-15](../enablers/EN-15-project-model-and-persistence.md), [EN-16](../enablers/EN-16-ui-framework-design-system.md)

## Estimate

TBD
