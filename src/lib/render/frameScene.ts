/**
 * Builds the SceneInput for one frame from the project data and the timeline's FrameState.
 * Used by BOTH the preview and the exporter, so they cannot drift apart.
 */
import type { FrameState } from '../anim/timeline';
import type { Course } from '../course/course';
import { formatRouteLength, routeLength, routesForLeg, type RouteChoice } from '../course/routes';
import type { Track } from '../track/track';
import { decimalSep, type VideoLocale } from '../i18n/core';
import type { CourseStyle } from './overprint';
import type { SceneInput, SceneStyle } from './scene';

export interface ProjectScene {
  crsCode: string;
  track: Track;
  style: SceneStyle;
  course: Course | null;
  courseStyle: CourseStyle;
  printScale: number | null;
  routes: RouteChoice[];
  /** Language of video texts (route length decimal separator). */
  videoLocale?: VideoLocale;
}

export function sceneForFrame(fs: FrameState, p: ProjectScene): SceneInput {
  const leg = fs.legIndex;
  const routes =
    p.course && leg !== null
      ? routesForLeg(p.routes, p.course, leg).map((r) => ({
          points: r.points,
          color: r.color,
          label: r.label,
          lengthText: formatRouteLength(routeLength(r), decimalSep(p.videoLocale ?? 'en')),
        }))
      : [];
  return {
    crsCode: p.crsCode,
    track: p.track,
    time: fs.t,
    heading: fs.gridHeading,
    style: p.style,
    legStartT: fs.legStartT,
    course:
      p.course && p.courseStyle.visible
        ? { course: p.course, style: p.courseStyle, printScale: p.printScale, highlightLeg: leg }
        : null,
    routes: routes.length ? { items: routes, alpha: fs.routeAlpha } : null,
  };
}
