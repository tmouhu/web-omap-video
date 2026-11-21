/**
 * Route choices per leg (STORY-30). A route belongs to the leg between two course points (by id, so
 * inserting other controls elsewhere does not move it). Lengths are geodesic.
 */
import { polylineLength, type LatLon } from '../geo/geo';
import type { Course } from './course';

export interface RouteChoice {
  id: string;
  fromId: string;
  toId: string;
  label: string;
  color: string;
  points: LatLon[];
}

/** Okabe–Ito based, colour-blind safe, distinct from the course purple and the orange runner/tail. */
export const ROUTE_COLORS = ['#0072B2', '#009E73', '#56B4E9', '#E6C700', '#1b1f24', '#8C564B'];

let seq = 0;
export const newRouteId = () => `r${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Index of the leg a route belongs to, or -1 if the course no longer has that leg. */
export function legIndexOf(course: Course, r: Pick<RouteChoice, 'fromId' | 'toId'>): number {
  for (let i = 0; i + 1 < course.points.length; i++) {
    if (course.points[i].id === r.fromId && course.points[i + 1].id === r.toId) return i;
  }
  return -1;
}

export function routesForLeg(routes: RouteChoice[], course: Course, legIndex: number): RouteChoice[] {
  const a = course.points[legIndex];
  const b = course.points[legIndex + 1];
  if (!a || !b) return [];
  return routes.filter((r) => r.fromId === a.id && r.toId === b.id);
}

export function routeLength(r: Pick<RouteChoice, 'points'>): number {
  return polylineLength(r.points);
}

/** `640 m` (rounded to 5 m) below 1 km, `1.24 km` from 1 km (STORY-30). */
export function formatRouteLength(m: number): string {
  const r5 = Math.round(m / 5) * 5;
  if (r5 < 1000) return `${r5} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

/** Next free label (A, B, C …) and colour for a new route of a leg. */
export function nextLabelAndColor(existing: RouteChoice[]): { label: string; color: string } {
  const used = new Set(existing.map((r) => r.label));
  let k = 0;
  while (used.has(String.fromCharCode(65 + k))) k++;
  return { label: String.fromCharCode(65 + k), color: ROUTE_COLORS[existing.length % ROUTE_COLORS.length] };
}

/** Routes whose leg no longer exists after a course edit. */
export function orphanRoutes(routes: RouteChoice[], course: Course | null): RouteChoice[] {
  return course ? routes.filter((r) => legIndexOf(course, r) < 0) : routes;
}
