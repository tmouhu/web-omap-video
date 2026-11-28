/**
 * Global time base (STORY-47): every user-facing display/animation duration in the project settings is either
 * VIDEO seconds or REAL (race, track) seconds. Consumers get a `timeScale` = track seconds per settings second.
 * Measurement windows (pace smoothing) are always real seconds and are not listed here.
 */
import type { ProjectSettings } from './project';

export type TimeBase = 'video' | 'real';

/** Track seconds per settings second. */
export const timeScaleFor = (base: TimeBase, speed: number): number => (base === 'real' ? 1 : speed);

/** Converts a duration between time bases at a playback speed (track s per video s). */
export function convertSeconds(v: number, from: TimeBase, to: TimeBase, speed: number): number {
  if (from === to || !(speed > 0)) return v;
  return from === 'video' ? v * speed : v / speed;
}

type Timed = Pick<ProjectSettings, 'free' | 'courseCamera' | 'routeDisplay' | 'style' | 'components'>;

/** The timed fields of the settings, as [object, key] pairs (only the parts present in `s`). */
function timedFields(s: Partial<Timed>): [Record<string, unknown>, string][] {
  const out: [Record<string, unknown>, string][] = [];
  const add = (o: object | undefined, keys: string[]) => {
    if (!o) return;
    for (const k of keys) if (typeof (o as Record<string, unknown>)[k] === 'number') out.push([o as never, k]);
  };
  add(s.free, ['rotationSmoothing']);
  add(s.courseCamera, ['transitionDelay', 'transitionDuration', 'approachSeconds', 'approachDuration']);
  add(s.routeDisplay, ['fadeIn', 'hold', 'fadeOut']);
  add(s.style?.track, ['tailSeconds']);
  for (const c of Array.isArray(s.components) ? s.components : [])
    add(c?.options, ['splitShow', 'splitShowFinish', 'splitFadeIn', 'splitFadeOut']);
  return out;
}

/** Converts every timed field of `s` in place from one time base to another. */
export function convertTimedSettings<T extends Partial<Timed>>(s: T, from: TimeBase, to: TimeBase, speed: number): T {
  if (from === to) return s;
  for (const [o, k] of timedFields(s)) o[k] = convertSeconds(o[k] as number, from, to, speed);
  return s;
}

/**
 * Settings saved before STORY-47 (projects and presets without `timeBase`) had mixed units: the approach start and
 * the tail length were real seconds, route display times real or video (their own toggle), everything else video
 * seconds. Converts them in place to `to`, so they render exactly as before.
 */
export function upgradeLegacyTimes<T extends Partial<Timed>>(
  s: T,
  routeBase: TimeBase,
  to: TimeBase,
  speed: number,
): T {
  const conv = (o: object | undefined, keys: string[], from: TimeBase) => {
    if (!o) return;
    const r = o as Record<string, unknown>;
    for (const k of keys) if (typeof r[k] === 'number') r[k] = convertSeconds(r[k] as number, from, to, speed);
  };
  conv(s.courseCamera, ['approachSeconds'], 'real');
  conv(s.style?.track, ['tailSeconds'], 'real');
  conv(s.routeDisplay, ['fadeIn', 'hold', 'fadeOut'], routeBase);
  conv(s.free, ['rotationSmoothing'], 'video');
  conv(s.courseCamera, ['transitionDelay', 'transitionDuration', 'approachDuration'], 'video');
  for (const c of Array.isArray(s.components) ? s.components : [])
    conv(c?.options, ['splitShow', 'splitShowFinish', 'splitFadeIn', 'splitFadeOut'], 'video');
  return s;
}
