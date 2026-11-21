# EN-7: Project setup, build and CI pipeline

**Type:** Enabler (infrastructure) · **Epic:** [EPIC-1](../EPIC-1-gpx-replay.md) · **Priority:** Must · **Labels:** `tech`, `ci`

## Summary
Production-grade repository, build and delivery setup.

## Scope / acceptance criteria
- [ ] *(POC)* Vite + TypeScript (strict). Scripts: `dev`, `build` (tsc + vite), `test`, `test:e2e`.
      **Change:** the POC has no runtime dependencies. Production adds Svelte 5
      ([EN-16](./EN-16-ui-framework-design-system.md)), OpenLayers ([EN-2](./EN-2-canvas-map-renderer.md)), `proj4` ([EN-12](./EN-12-coordinate-reference-systems.md)) and a muxer
      ([EN-10](./EN-10-spike-offline-rendering.md)). The setup includes bundle-size budgets and lazy loading of heavy modules
      (export, editor).
- [ ] Git repository with branch protection and PR reviews (the POC folder is not under version control).
- [ ] ESLint + Prettier, run in CI.
- [ ] CI (e.g. GitHub Actions): install → lint → type-check → unit tests → E2E (Chromium + Firefox) → build.
- [ ] Static hosting with HTTPS (required for `showSaveFilePicker`, Workers and OPFS), e.g. GitHub Pages / Netlify / Cloudflare Pages.
- [ ] Preview deployments for PRs.
- [ ] Dependency update automation (Dependabot/Renovate).
- [ ] Configuration via env variables (tile URLs, API keys, attribution).
- [ ] Web Worker build setup (export, raster pyramid and matching run in Workers).

## POC reference
`package.json`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`

## Open questions / refinement
- Hosting target and domain?
- Installable PWA (offline use in the field)?

## Dependencies
None

## Estimate
TBD
