# STORY-10: Choose video format, codec quality and bitrate

**Type:** Story · **Epic:** [EPIC-1](../EPIC-1-gpx-replay.md) · **Priority:** Should · **Labels:** `video`

## User story
As a **user**, I want **high-quality video in a format my video editor can open, with the option to set the bitrate myself**,
so that **map details stay sharp and the file works in my editing workflow**.

## Acceptance criteria
- [ ] **Format chosen by target**, not only by codec name: "MP4 (H.264) – works everywhere" (default where the browser can encode
      it), "WebM (VP9)". All outputs are opaque (no transparency).
      *(POC)* Codec fallback order VP9 → VP8 → WebM → H.264 → MP4 becomes the MediaRecorder fallback only.
- [ ] *(POC)* Bitrate field (Mbit/s) with an **Auto** option (default on).
- [ ] *(POC)* Auto bitrate is interpolated by pixel count through these anchors:

  | Resolution | Recommended range | Auto |
  | --- | --- | --- |
  | 1920×1080 | 20–40 Mbit/s | 30 |
  | 2560×1440 | 30–60 Mbit/s | 45 |
  | 3840×2160 | 60–120 Mbit/s | 90 |

  Below 1080p it scales linearly with pixels, minimum 5 Mbit/s (unit-tested). Scaled by fps / 30.
- [ ] *(POC)* Auto value updates when resolution changes. Manual range 1–200 Mbit/s, clamped.
- [ ] *(POC)* The format, codec and bitrate actually used are shown in the export status.
- [ ] An estimated file size is shown (bitrate × duration).

## POC reference
- `src/recorder.ts` – `MIME_CANDIDATES`, `autoBitrateMbps`, `pickMimeType`
- `src/main.ts` – `bitrateMbps()`

## Technical notes
- `videoBitsPerSecond` is only a target. Encoders often use less for simple map frames.
- WebCodecs offers `bitrateMode: 'variable' | 'constant'` and quantizer modes. Map graphics with fine lines benefit from
  a high-quality VBR.

## Open questions / refinement
- Should Auto use the top of the ranges (40/60/120) instead of the middle?

## Dependencies
[STORY-9](./STORY-9-record-video.md)

## Estimate
TBD
