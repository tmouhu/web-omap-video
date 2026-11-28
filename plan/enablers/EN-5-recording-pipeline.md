# EN-5: Recording pipeline (real-time MediaRecorder path)

**Type:** Enabler (architecture) · **Epic:** [EPIC-1](../EPIC-1-gpx-replay.md) · **Priority:** Should · **Labels:** `tech`, `video`

## Summary

A reusable recorder that turns a canvas into a video file, choosing the codec and bitrate.

> **Refinement note:** the product goal is map videos laid over head cam footage. These are usually recorded at
> **1× speed and must be frame-exact for the full run (60–120 min)**. Real-time `MediaRecorder` recording would take as long
> as the run, needs a visible tab, and has variable frame timing. The expected outcome is that **WebCodecs offline export
> ([EN-10](./EN-10-spike-offline-rendering.md)) becomes the primary path**, and this pipeline stays as a fallback for
> browsers without WebCodecs. Scope is limited to what the fallback needs.

## Scope / acceptance criteria

- [ ] Common `VideoExporter` interface shared with the WebCodecs path: `export(range, fps, size, codec, onProgress, signal) → Blob | stream`.
- [ ] _(POC)_ `CanvasRecorder(canvas, bitrateMbps, fps = 30)`: `start()`, `stop(): Promise<Blob>`, `mimeType`, `bitrateMbps`.
- [ ] _(POC)_ Codec chosen with `MediaRecorder.isTypeSupported` over `MIME_CANDIDATES` (VP9 first).
- [ ] _(POC)_ Data collected in 1 s chunks. Stream tracks are stopped on finish.
- [ ] _(POC)_ Separate offscreen recording canvas at the exact video resolution (independent of screen DPI).
- [ ] _(POC)_ `computeVideoSize(aspect, shortSide)` with even dimensions and a 3840 px long-side cap (shared with EN-10).
- [ ] Error handling: `MediaRecorder` `onerror`, out of memory, tab hidden (pause or warn via `visibilitychange`).
- [ ] Fix WebM duration metadata after recording (e.g. `ts-ebml` / `fix-webm-duration`) so players can seek.
- [ ] Constant frame pacing: `captureStream(0)` + `requestFrame()` per rendered frame.

## POC reference

`src/recorder.ts`

## Known POC limitations

- Real-time only; needs a visible tab (rAF is throttled in hidden tabs).
- The whole video is held in memory as a Blob.

## Dependencies

[EN-2](./EN-2-canvas-map-renderer.md), [EN-9](./EN-9-browser-compatibility.md)

## Estimate

TBD
