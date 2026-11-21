# EN-16: UI framework (Svelte), design system and application shell

**Type:** Enabler (architecture) · **Epic:** [EPIC-6](../EPIC-6-ux-and-project.md) · **Priority:** Must · **Labels:** `tech`, `ui`

## Summary
The production app has several editors (georeferencing, course, GPX, route choices), a timeline, layer and style panels,
and an export dialog. The requirement is a **visually attractive, modern and well usable UI**, built **desktop-first**.

## Decision (refinement, Nov 2026): Svelte 5
- **Svelte 5** (runes) + **SvelteKit in static/SPA mode** (`adapter-static`), or plain Vite + Svelte if routing is not needed.
- Accessible headless primitives: **Bits UI** (with shadcn-svelte style components) or Melt UI. Icons: Lucide.
- Styling: design tokens as CSS custom properties, Tailwind CSS optional (team choice).
- OpenLayers ([EN-2](./EN-2-canvas-map-renderer.md)) is wrapped in a few thin Svelte components. The map instance lives outside
  Svelte's reactivity, and the render loop reads project state directly, so the UI does not re-render on every frame.

## Scope / acceptance criteria
- [ ] Project skeleton with Svelte 5, TypeScript strict, Vitest + `@testing-library/svelte`, Playwright ([EN-7](./EN-7-project-setup-ci.md)).
- [ ] Design tokens: colour (light and **dark theme**, dark by default for a video tool), typography, spacing, radii, motion.
      The course overprint purple is reserved for the map and is not used as a UI accent.
- [ ] App shell: top bar (project name, save state, undo/redo, export), left workflow rail, central map stage, right
      inspector panel, bottom timeline. See [STORY-37](../stories/STORY-37-app-shell-and-workflow.md).
- [ ] State: project store(s) on top of [EN-15](./EN-15-project-model-and-persistence.md) (commands + undo). Svelte runes for
      UI state.
- [ ] Map tool framework: one active tool at a time (pan, draw course, edit GPX, draw route, georeference point), with
      cursor, hints, keyboard shortcuts and Esc to cancel. Implemented with OL interactions.
- [ ] **Desktop first:** designed for ≥ 1280 px with mouse and keyboard. Tablet is usable, phones are view-only.
- [ ] Accessibility: WCAG 2.2 AA for UI controls, full keyboard operation, visible focus.
- [ ] Component catalogue (Storybook for Svelte or Histoire) with visual regression of key components.

## Dependencies
[EN-7](./EN-7-project-setup-ci.md), [EN-19](./EN-19-ux-research-and-design.md) (visual design input)

## Estimate
TBD
