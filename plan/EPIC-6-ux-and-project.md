# EPIC-6: Modern, usable UI and project workflow

**Type:** Epic · **Status:** In progress (Nov 2026) · **Labels:** `ux`, `ui`, `project`

## Summary

Turn the POC's developer panel into a **visually attractive, modern and well usable** application: a guided workflow from map to
video, a design system, project save/open, reusable presets, and localisation.

## Business goal / motivation

- The target users are orienteers, not GIS or video specialists. The feature set (georeferencing, CRS, course setting,
  GPX editing, video export) is broad, so good UX decides whether the product succeeds.
- A video takes real work to make; losing it, or not being able to re-export it, is not acceptable.

## Scope (in)

- UX research, interaction and visual design, usability testing ([EN-19](./enablers/EN-19-ux-research-and-design.md)).
- UI framework, design system, app shell ([EN-16](./enablers/EN-16-ui-framework-design-system.md)).
- Project model, undo/redo, persistence ([EN-15](./enablers/EN-15-project-model-and-persistence.md)).
- Guided workflow, settings & presets, save/open, localisation.

## Non-functional requirements (apply to all epics)

- **Visual quality:** consistent design tokens, dark/light theme, smooth 60 fps interaction on the map stage.
- **Usability:** usability target in EN-19; every long operation shows progress and can be cancelled; undo everywhere.
- **Accessibility:** WCAG 2.2 AA for UI controls; full keyboard operation.
- **Privacy:** all user files are processed locally; nothing is uploaded; no tracking without consent.
- **Performance:** initial load < 3 s on broadband; heavy modules lazy-loaded.

## Child issues

- Stories: [STORY-37](./stories/STORY-37-app-shell-and-workflow.md) – [STORY-40](./stories/STORY-40-localisation-and-units.md)
- Enablers: [EN-15](./enablers/EN-15-project-model-and-persistence.md), [EN-16](./enablers/EN-16-ui-framework-design-system.md),
  [EN-19](./enablers/EN-19-ux-research-and-design.md)

## Definition of done (epic level)

- Usability test target met (≥ 4/5 users complete the main flow unaided in < 15 min).
- Projects survive browser restart and can be moved between computers via the project file.

## Estimate

TBD
