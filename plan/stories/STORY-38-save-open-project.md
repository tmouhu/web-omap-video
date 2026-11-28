# STORY-38: Save and open projects

**Type:** Story · **Epic:** [EPIC-6](../EPIC-6-ux-and-project.md) · **Priority:** Must · **Labels:** `project`, `persistence`

## User story

As a **user**, I want **my work saved automatically and to be able to open it later or move it to another computer**,
so that **I never lose georeferencing, course and route choice work, and can re-export with different settings**.

## Acceptance criteria

- [ ] Autosave to browser storage after each change ([EN-15](../enablers/EN-15-project-model-and-persistence.md)),
      with a visible save state ("Saved", "Saving…", "Storage full").
- [ ] Recent projects list on the start screen: name, date, thumbnail, size; rename, duplicate, delete (with confirmation).
- [ ] **Save project file** / **Open project file** (`.omvproj`) including the raster map and the GPX, for backup and moving
      between computers.
- [ ] Opening a project from an older app version migrates it automatically.
- [ ] Reusable parts: "new project from this one" keeps map, georeference, layers and style but clears GPX and sync
      (e.g. for several runners on the same course).
- [ ] Undo history is kept for the session (not stored in the file).

## Dependencies

[EN-15](../enablers/EN-15-project-model-and-persistence.md), [STORY-37](./STORY-37-app-shell-and-workflow.md)

## Estimate

TBD
