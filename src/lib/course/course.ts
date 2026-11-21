import type { MsgKey } from '../i18n/core';
/**
 * Orienteering course model (STORY-18): ordered start → controls → finish, positions in WGS84.
 * The same location may appear twice (butterfly / loop courses).
 */
import { geodesicDistance, type LatLon } from '../geo/geo';

export type CoursePointKind = 'start' | 'control' | 'finish';

export interface CoursePoint extends LatLon {
  id: string;
  kind: CoursePointKind;
  /** Control code as on the control flag (e.g. "31"); optional. */
  code?: string;
  description?: string;
}

export interface Course {
  name: string;
  points: CoursePoint[];
}

export interface Leg {
  index: number;
  from: CoursePoint;
  to: CoursePoint;
  /** Straight-line (geodesic) length in metres. */
  length: number;
}

let seq = 0;
export const newPointId = () => `p${Date.now().toString(36)}${(seq++).toString(36)}`;

export function emptyCourse(name = 'Course'): Course {
  return { name, points: [] };
}

/** Problems that prevent using the course for leg animation, as message keys ([] = valid). */
export function courseProblems(c: Course | null): MsgKey[] {
  if (!c || c.points.length === 0) return ['course.p.empty'];
  const p: MsgKey[] = [];
  if (c.points[0].kind !== 'start') p.push('course.p.start');
  if (c.points[c.points.length - 1].kind !== 'finish') p.push('course.p.finish');
  if (!c.points.some((x) => x.kind === 'control')) p.push('course.p.control');
  if (c.points.filter((x) => x.kind === 'start').length > 1) p.push('course.p.oneStart');
  if (c.points.filter((x) => x.kind === 'finish').length > 1) p.push('course.p.oneFinish');
  return p;
}

export const isValidCourse = (c: Course | null): c is Course => courseProblems(c).length === 0;

export function legs(c: Course): Leg[] {
  const out: Leg[] = [];
  for (let i = 0; i + 1 < c.points.length; i++) {
    out.push({
      index: i,
      from: c.points[i],
      to: c.points[i + 1],
      length: geodesicDistance(c.points[i], c.points[i + 1]),
    });
  }
  return out;
}

export function courseLength(c: Course): number {
  return legs(c).reduce((s, l) => s + l.length, 0);
}

/** Display label: "S", control sequence number ("1", "2", …) or "F". */
export function pointLabel(c: Course, i: number): string {
  const p = c.points[i];
  if (p.kind === 'start') return 'S';
  if (p.kind === 'finish') return 'F';
  return String(c.points.slice(0, i + 1).filter((x) => x.kind === 'control').length);
}

/** Leg label, e.g. "S → 1", "4 → 5", "12 → F". */
export function legLabel(c: Course, legIndex: number): string {
  return `${pointLabel(c, legIndex)} → ${pointLabel(c, legIndex + 1)}`;
}

/**
 * Adds a point while drawing: the first point becomes the start, later points controls.
 * If the course already has a finish, the new control is inserted before it.
 */
export function appendPoint(c: Course, at: LatLon): Course {
  const kind: CoursePointKind = c.points.length === 0 ? 'start' : 'control';
  const p: CoursePoint = { id: newPointId(), kind, lat: at.lat, lon: at.lon };
  const pts = [...c.points];
  const fi = pts.findIndex((x) => x.kind === 'finish');
  if (fi >= 0) pts.splice(fi, 0, p);
  else pts.push(p);
  return { ...c, points: pts };
}

/** Turns the last point into the finish (ends drawing). */
export function finishAtLast(c: Course): Course {
  if (c.points.length < 3 || c.points.some((x) => x.kind === 'finish')) return c;
  const pts = c.points.map((p, i) => (i === c.points.length - 1 ? { ...p, kind: 'finish' as const } : p));
  return { ...c, points: pts };
}

export function insertControl(c: Course, beforeIndex: number, at: LatLon): Course {
  const pts = [...c.points];
  pts.splice(beforeIndex, 0, { id: newPointId(), kind: 'control', lat: at.lat, lon: at.lon });
  return { ...c, points: pts };
}

export function movePoint(c: Course, id: string, at: LatLon): Course {
  return { ...c, points: c.points.map((p) => (p.id === id ? { ...p, lat: at.lat, lon: at.lon } : p)) };
}

export function removePoint(c: Course, id: string): Course {
  return { ...c, points: c.points.filter((p) => p.id !== id) };
}

export function updatePoint(c: Course, id: string, patch: Partial<Pick<CoursePoint, 'code' | 'description'>>): Course {
  return { ...c, points: c.points.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
}

/** Moves a control up/down in the sequence; start and finish stay at the ends. */
export function reorderControl(c: Course, id: string, dir: -1 | 1): Course {
  const i = c.points.findIndex((p) => p.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= c.points.length) return c;
  if (c.points[i].kind !== 'control' || c.points[j].kind !== 'control') return c;
  const pts = [...c.points];
  [pts[i], pts[j]] = [pts[j], pts[i]];
  return { ...c, points: pts };
}
