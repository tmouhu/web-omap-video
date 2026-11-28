# STORY-39: Animation and style settings with reusable presets

**Type:** Story · **Epic:** [EPIC-6](../EPIC-6-ux-and-project.md) · **Priority:** Must · **Labels:** `settings`, `ui`, `animation`

## User story

As a **user**, I want **all animation and style settings in one well-organised place, and to save my favourite setup as a
preset**, so that **all my videos look consistent with little effort**.

## Acceptance criteria

- [ ] Settings grouped as:
  - **Camera:** zoom-in / zoom-out limits ([STORY-26](./STORY-26-scale-limits-and-panning.md)), leg margin
    ([STORY-24](./STORY-24-leg-oriented-view.md)), transition delay/duration/easing ([STORY-25](./STORY-25-leg-transitions.md)),
    approach zoom ([STORY-27](./STORY-27-approach-zoom.md)), free-mode options ([STORY-5](./STORY-5-heading-up-rotation.md))
  - **Course:** visibility, symbol size mode, leg highlighting ([STORY-19](./STORY-19-iof-course-overprint.md))
  - **Runner:** arrow style ([STORY-28](./STORY-28-navigation-arrow.md)), tail length/colours ([STORY-29](./STORY-29-gpx-tail.md))
  - **Route choices:** display time, fade, label style ([STORY-31](./STORY-31-route-choice-display.md))
  - **Overlays** ([STORY-8](./STORY-8-map-overlays.md)) and **components** ([STORY-32](./STORY-32-data-component-videos.md)–[34](./STORY-34-numeric-components.md))
- [ ] Every change is reflected in the preview immediately, at the current playhead time.
- [ ] Simple / advanced view: the simple view shows the 6–8 most important settings.
- [ ] Built-in presets (e.g. "Classic forest", "Sprint", "Coach analysis") and **user presets**: save, rename, delete, export/import as JSON.
- [ ] "Reset to default" per group.
- [ ] Settings are validated (e.g. zoom-in limit must be a larger scale than zoom-out limit) with inline messages.

## Dependencies

[EN-15](../enablers/EN-15-project-model-and-persistence.md), [STORY-37](./STORY-37-app-shell-and-workflow.md)

## Estimate

TBD
