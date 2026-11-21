/** Video size and bitrate helpers (STORY-9, STORY-10). */

export const MAX_VIDEO_LONG_SIDE = 3840;
export const MIN_VIDEO_SHORT_SIDE = 144;
export const SHORT_SIDES = [360, 480, 720, 1080, 1440, 2160] as const;
export const FRAME_RATES = [25, 30, 50, 60] as const;
export const MIN_BITRATE_MBPS = 1;
export const MAX_BITRATE_MBPS = 200;

/** Even-sized video dimensions for an aspect ratio and short side, long side capped at 3840 px. */
export function computeVideoSize(aspect: number, shortSide: number): { width: number; height: number } {
  const even = (v: number) => Math.max(2, Math.round(v / 2) * 2);
  let short = Math.max(MIN_VIDEO_SHORT_SIDE, shortSide);
  let long = short * (aspect >= 1 ? aspect : 1 / aspect);
  if (long > MAX_VIDEO_LONG_SIDE) {
    short *= MAX_VIDEO_LONG_SIDE / long;
    long = MAX_VIDEO_LONG_SIDE;
  }
  return aspect >= 1 ? { width: even(long), height: even(short) } : { width: even(short), height: even(long) };
}

// Pixels → Mbit/s anchors at 30 fps (middle of recommended ranges: 1080p 20–40, 1440p 30–60, 2160p 60–120).
const BITRATE_ANCHORS: [number, number][] = [
  [1920 * 1080, 30],
  [2560 * 1440, 45],
  [3840 * 2160, 90],
];

/** Default bitrate (Mbit/s) by pixel count, scaled by fps/30, min 5, max 200. */
export function autoBitrateMbps(width: number, height: number, fps = 30): number {
  const px = width * height;
  const [first] = BITRATE_ANCHORS;
  let mbps: number;
  if (px <= first[0]) {
    mbps = (first[1] * px) / first[0];
  } else {
    let i = 1;
    while (i < BITRATE_ANCHORS.length - 1 && px > BITRATE_ANCHORS[i][0]) i++;
    const [p0, b0] = BITRATE_ANCHORS[i - 1];
    const [p1, b1] = BITRATE_ANCHORS[i];
    mbps = b0 + ((b1 - b0) * (px - p0)) / (p1 - p0);
  }
  mbps *= fps / 30;
  return Math.round(Math.min(MAX_BITRATE_MBPS, Math.max(5, mbps)));
}

/** Number of frames for a track-time range at a playback speed (frame-exact rule from STORY-9). */
export function frameCount(durationSec: number, fps: number, speed: number): number {
  return Math.max(1, Math.round((durationSec * fps) / speed));
}

export function estimatedBytes(mbps: number, videoSeconds: number): number {
  return (mbps * 1e6 * videoSeconds) / 8;
}
