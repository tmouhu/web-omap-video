/** Export time range (STORY-35): course start→finish, whole track or custom, plus lead-in/out padding. */
import type { Track } from '../track/track';

export interface ExportRangeSettings {
  mode: 'course' | 'track' | 'custom';
  /** Custom range, track seconds. */
  in: number;
  out: number;
  /** Extra track seconds before / after (frames outside the GPX show its first/last state). */
  padBefore: number;
  padAfter: number;
}

export const DEFAULT_EXPORT_RANGE: ExportRangeSettings = { mode: 'course', in: 0, out: 0, padBefore: 0, padAfter: 0 };

export interface ResolvedRange {
  /** Track seconds of the first and last frame. */
  start: number;
  end: number;
  /** Origin of elapsed time/distance components (start passing in course mode, else the unpadded start). */
  origin: number;
  /** Effective mode (course falls back to track when there is no course). */
  mode: ExportRangeSettings['mode'];
}

export function resolveRange(s: ExportRangeSettings, track: Track, passings: number[] | null): ResolvedRange {
  let mode = s.mode;
  if (mode === 'course' && (!passings || passings.length < 2)) mode = 'track';
  let a = 0;
  let b = track.duration;
  if (mode === 'course') {
    a = passings![0];
    b = passings![passings!.length - 1];
  } else if (mode === 'custom') {
    a = Math.max(0, Math.min(s.in, s.out));
    b = Math.min(track.duration, Math.max(s.in, s.out));
  }
  const origin = mode === 'course' ? passings![0] : a;
  return { start: a - Math.max(0, s.padBefore), end: Math.max(a + 0.001, b) + Math.max(0, s.padAfter), origin, mode };
}

/** GPX clock time (epoch ms) of the first frame, if the track has timestamps. */
export function firstFrameClock(track: Track, r: ResolvedRange): number | null {
  return track.startTime === null ? null : track.startTime + r.start * 1000;
}
