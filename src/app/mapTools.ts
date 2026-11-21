/**
 * Map editing tools (EPIC-3): course editor (STORY-18), GPX editor (STORY-21), picking a passing time on
 * the track (STORY-23). Installs OpenLayers interactions on the preview map and draws preview-only
 * editor marks. Nothing here is drawn into exported videos.
 */
import type OlMap from 'ol/Map';
import type MapBrowserEvent from 'ol/MapBrowserEvent';
import DoubleClickZoom from 'ol/interaction/DoubleClickZoom';
import PointerInteraction from 'ol/interaction/Pointer';
import { forward, inverse } from '../lib/geo/crs';
import type { LatLon } from '../lib/geo/geo';
import { closestInWindow } from '../lib/course/match';
import { projectedTrack } from '../lib/render/scene';
import { app } from './state.svelte';

const HIT_PX = 12;

type Px = [number, number];

function lonLat(map: OlMap, e: MapBrowserEvent): LatLon {
  void map;
  return inverse(app.crs.code, e.coordinate as [number, number]);
}

function toPx(map: OlMap, p: LatLon): Px {
  return map.getPixelFromCoordinate(forward(app.crs.code, p)) as Px;
}

/** Index of the course point under the pixel, or -1. */
function hitCoursePoint(map: OlMap, px: Px): number {
  const c = app.course;
  if (!c) return -1;
  let best = -1;
  let bestD = HIT_PX + 6;
  c.points.forEach((p, i) => {
    const q = toPx(map, p);
    const d = Math.hypot(q[0] - px[0], q[1] - px[1]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/** Leg (index of its first point) whose line passes within HIT_PX of the pixel, or -1. */
function hitLeg(map: OlMap, px: Px): number {
  const c = app.course;
  if (!c) return -1;
  for (let i = 0; i + 1 < c.points.length; i++) {
    const a = toPx(map, c.points[i]);
    const b = toPx(map, c.points[i + 1]);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L2 = dx * dx + dy * dy;
    if (L2 === 0) continue;
    const f = ((px[0] - a[0]) * dx + (px[1] - a[1]) * dy) / L2;
    if (f < 0.15 || f > 0.85) continue;
    if (Math.hypot(a[0] + f * dx - px[0], a[1] + f * dy - px[1]) < HIT_PX * 0.7) return i;
  }
  return -1;
}

/** Track point index under the pixel (edited track), or -1. */
function hitTrackPoint(map: OlMap, px: Px): number {
  const tr = app.track;
  if (!tr) return -1;
  const xy = projectedTrack(tr, app.crs.code);
  let best = -1;
  let bestD = HIT_PX;
  for (let i = 0; i < tr.points.length; i++) {
    const q = map.getPixelFromCoordinate([xy[2 * i], xy[2 * i + 1]]);
    const d = Math.hypot(q[0] - px[0], q[1] - px[1]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function installTools(map: OlMap): () => void {
  let dragCourseId: string | null = null;
  let dragTrackIndex: number | null = null;

  const drag = new PointerInteraction({
    handleDownEvent: (e) => {
      const px = e.pixel as Px;
      if (app.tool === 'course') {
        const i = hitCoursePoint(map, px);
        if (i < 0) return false;
        dragCourseId = app.course!.points[i].id;
        app.selectedPointId = dragCourseId;
        app.pushHistory();
        return true;
      }
      if (app.tool === 'gpx') {
        const i = hitTrackPoint(map, px);
        if (i < 0) return false;
        dragTrackIndex = i;
        app.selectedTrackIndex = i;
        return true;
      }
      return false;
    },
    handleDragEvent: (e) => {
      const at = lonLat(map, e);
      if (dragCourseId) app.courseMoveLive(dragCourseId, at);
      else if (dragTrackIndex !== null) {
        app.dragEdit = { type: 'move', index: dragTrackIndex, lat: at.lat, lon: at.lon, radius: app.brushRadius };
      }
    },
    handleUpEvent: () => {
      if (dragTrackIndex !== null && app.dragEdit) {
        const e = app.dragEdit;
        app.dragEdit = null;
        app.addGpxEdit(e);
        app.selectedTrackIndex = dragTrackIndex;
      }
      dragCourseId = null;
      dragTrackIndex = null;
      return false;
    },
  });
  map.addInteraction(drag);

  const onClick = (e: MapBrowserEvent) => {
    if (app.georef.active || app.playing) return;
    const px = e.pixel as Px;
    const at = lonLat(map, e);
    switch (app.tool) {
      case 'course': {
        const i = hitCoursePoint(map, px);
        if (i >= 0) {
          app.selectedPointId = app.course!.points[i].id;
          return;
        }
        const leg = hitLeg(map, px);
        if (leg >= 0) app.courseInsert(leg + 1, at);
        else app.courseClick(at);
        return;
      }
      case 'gpx': {
        const i = hitTrackPoint(map, px);
        app.selectedTrackIndex = i >= 0 ? i : null;
        if (i >= 0) app.seek(app.track!.points[i].t);
        return;
      }
      case 'gpx-redraw':
        app.redrawPath = [...app.redrawPath, at];
        return;
      case 'pick-passing': {
        const id = app.pickPassingId;
        const c = app.course;
        const ps = app.passings;
        const tr = app.track;
        if (!id || !c || !ps || !tr) return;
        const k = c.points.findIndex((p) => p.id === id);
        const t0 = k > 0 ? ps[k - 1].t : 0;
        const t1 = k + 1 < ps.length ? ps[k + 1].t : tr.duration;
        const best = closestInWindow(tr, at, t0, t1);
        if (Number.isFinite(best.d)) {
          app.courseError = app.setPassing(id, best.t) ?? '';
          app.seek(best.t);
        }
        app.setTool('none');
        return;
      }
    }
  };
  const onDblClick = (e: MapBrowserEvent) => {
    if (app.tool === 'course' && !app.course?.points.some((p) => p.kind === 'finish')) {
      // OpenLayers fires no 'singleclick' for a double click: add the finish at this spot.
      app.courseFinish(lonLat(map, e));
      e.preventDefault();
    } else if (app.tool === 'gpx-redraw') {
      app.commitRedraw();
      e.preventDefault();
    }
  };
  map.on('singleclick', onClick);
  map.on('dblclick', onDblClick);

  return () => {
    map.removeInteraction(drag);
    map.un('singleclick', onClick);
    map.un('dblclick', onDblClick);
  };
}

/** Enables interactions for the current mode: none while playing/exporting; no double-click zoom while drawing. */
export function syncInteractions(map: OlMap): void {
  const active = !app.playing && !app.exporting;
  const drawing = app.tool === 'course' || app.tool === 'gpx-redraw';
  map.getInteractions().forEach((i) => i.setActive(active && !(drawing && i instanceof DoubleClickZoom)));
}

/** Preview-only marks: original GPX, editable track points, selection, edit range, redraw path, passings. */
export function drawEditorMarks(ctx: CanvasRenderingContext2D, map: OlMap, pr: number): void {
  const tr = app.track;
  const crs = app.crs.code;
  const P = (x: number, y: number): Px => {
    const q = map.getPixelFromCoordinate([x, y]);
    return [q[0] * pr, q[1] * pr];
  };
  ctx.save();
  if (app.showOriginalGpx && app.gpx && app.gpxEdits.length) {
    ctx.beginPath();
    app.gpx.points.forEach((p, i) => {
      const q = P(...forward(crs, p));
      if (i === 0) ctx.moveTo(...q);
      else ctx.lineTo(...q);
    });
    ctx.strokeStyle = 'rgba(120, 120, 120, 0.8)';
    ctx.setLineDash([4 * pr, 4 * pr]);
    ctx.lineWidth = 1.5 * pr;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (tr && (app.tool === 'gpx' || app.tool === 'gpx-redraw')) {
    const xy = projectedTrack(tr, crs);
    const res = map.getView().getResolution() ?? 10;
    // Edit range highlight.
    const r = app.rangeIndices();
    if (r) {
      ctx.beginPath();
      for (let i = r[0]; i <= r[1]; i++) {
        const q = P(xy[2 * i], xy[2 * i + 1]);
        if (i === r[0]) ctx.moveTo(...q);
        else ctx.lineTo(...q);
      }
      ctx.strokeStyle = 'rgba(47, 128, 255, 0.55)';
      ctx.lineWidth = 9 * pr;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    // Points (only when zoomed in enough to be useful).
    if (res < 4) {
      ctx.fillStyle = '#1969ff';
      for (let i = 0; i < tr.points.length; i++) {
        const q = P(xy[2 * i], xy[2 * i + 1]);
        ctx.beginPath();
        ctx.arc(q[0], q[1], 2.2 * pr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const s = app.selectedTrackIndex;
    if (s !== null && s < tr.points.length) {
      const q = P(xy[2 * s], xy[2 * s + 1]);
      ctx.beginPath();
      ctx.arc(q[0], q[1], 6 * pr, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 2.5 * pr;
      ctx.strokeStyle = '#1969ff';
      ctx.stroke();
      if (app.brushRadius > 0) {
        ctx.beginPath();
        ctx.arc(q[0], q[1], (app.brushRadius / res) * pr, 0, Math.PI * 2);
        ctx.setLineDash([3 * pr, 3 * pr]);
        ctx.lineWidth = 1 * pr;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }
  if (app.tool === 'gpx-redraw' && app.redrawPath.length) {
    ctx.beginPath();
    app.redrawPath.forEach((p, i) => {
      const q = P(...forward(crs, p));
      if (i === 0) ctx.moveTo(...q);
      else ctx.lineTo(...q);
      ctx.fillRect(q[0] - 3 * pr, q[1] - 3 * pr, 6 * pr, 6 * pr);
    });
    ctx.strokeStyle = '#1969ff';
    ctx.lineWidth = 2.5 * pr;
    ctx.stroke();
  }
  // Passing positions on the track (small ticks), when the course panel is in use.
  if (tr && app.passings && app.tool !== 'none') {
    app.passings.forEach((ps) => {
      const q = P(...forward(crs, tr.positionAt(ps.t)));
      ctx.beginPath();
      ctx.arc(q[0], q[1], 4 * pr, 0, Math.PI * 2);
      ctx.fillStyle = ps.status === 'not-found' ? '#ff5d6c' : ps.status === 'manual' ? '#f5b942' : '#3ccf8e';
      ctx.fill();
      ctx.lineWidth = 1.5 * pr;
      ctx.strokeStyle = '#111';
      ctx.stroke();
    });
  }
  ctx.restore();
}
