/**
 * IOF course overprint (STORY-19), drawn on a 2D canvas in the shared scene (preview + export).
 * Symbol dimensions per ISOM 2017-2 course symbols (map millimetres at the map's print scale):
 * start triangle 6.0 mm side, control circle 5.0 mm, finish circles 5.0 / 7.0 mm, lines 0.35 mm,
 * control numbers 4.0 mm high. Colour: IOF overprint purple (PANTONE Purple ≈ #BB29BB). Normal (not multiply)
 * blending so the transparent preview overlay and the composed export frame look the same.
 * TODO (STORY-19): verify the dimensions against the standard; ISSprOM sizes.
 */
import { forward } from '../geo/crs';
import type { Course } from '../course/course';
import { pointLabel } from '../course/course';

export const OVERPRINT_PURPLE = 'rgb(187, 41, 187)';

export const ISOM_MM = { startSide: 6.0, circle: 5.0, finishInner: 5.0, finishOuter: 7.0, line: 0.35, number: 4.0 };

export interface CourseStyle {
  visible: boolean;
  /** 'map': symbols scale with the map (true print size at `printScale`); 'screen': constant readable size. */
  sizeMode: 'map' | 'screen';
  /** Symbol size multiplier (1 = standard). */
  sizeFactor: number;
  showNumbers: boolean;
}

export const DEFAULT_COURSE_STYLE: CourseStyle = {
  visible: true,
  sizeMode: 'screen',
  sizeFactor: 1,
  showNumbers: true,
};

/** CSS px per map millimetre on screen in 'screen' mode (≈ a 1:10 000 print at 96 dpi × 1.6). */
const SCREEN_PX_PER_MM = (96 / 25.4) * 1.6;

export interface OverprintInput {
  crsCode: string;
  course: Course;
  style: CourseStyle;
  /** Map print scale (1:N) when known; used in 'map' size mode (default 10 000). */
  printScale: number | null;
  /** Ground metres per CSS px of the current view. */
  groundResolution: number;
  /** Leg to highlight (others dimmed); null = all equal. */
  highlightLeg: number | null;
  /** Selected point id (editor only). */
  selectedId?: string | null;
}

/** CSS px per map mm for the current view and style. */
export function pxPerMapMm(i: Pick<OverprintInput, 'style' | 'printScale' | 'groundResolution'>): number {
  if (i.style.sizeMode === 'screen') return SCREEN_PX_PER_MM * i.style.sizeFactor;
  const groundPerMm = ((i.printScale ?? 10000) / 1000) * i.style.sizeFactor;
  // Keep symbols readable when zoomed far out/in.
  return Math.min(14, Math.max(2.2, groundPerMm / i.groundResolution));
}

export function drawOverprint(
  ctx: CanvasRenderingContext2D,
  T: (x: number, y: number) => [number, number],
  pr: number,
  input: OverprintInput,
): void {
  const { course, style } = input;
  if (!style.visible || course.points.length === 0) return;
  const mm = pxPerMapMm(input) * pr;
  const pts = course.points.map((p) => T(...forward(input.crsCode, p)));
  const n = pts.length;
  const radius = (i: number) => {
    const k = course.points[i].kind;
    if (k === 'start') return (ISOM_MM.startSide / Math.sqrt(3)) * mm; // circumradius
    if (k === 'finish') return (ISOM_MM.finishOuter / 2) * mm;
    return (ISOM_MM.circle / 2) * mm;
  };
  const alphaFor = (legIdx: number) => (input.highlightLeg === null || legIdx === input.highlightLeg ? 1 : 0.35);
  const pointAlpha = (i: number) =>
    input.highlightLeg === null || i === input.highlightLeg || i === input.highlightLeg + 1 ? 1 : 0.35;

  ctx.save();
  ctx.strokeStyle = OVERPRINT_PURPLE;
  ctx.fillStyle = OVERPRINT_PURPLE;
  ctx.lineWidth = Math.max(1, ISOM_MM.line * mm);
  ctx.lineCap = 'butt';

  // Leg lines, with gaps at the symbols.
  for (let i = 0; i + 1 < n; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    const ra = radius(i);
    const rb = radius(i + 1);
    if (len <= ra + rb + 1) continue;
    const ux = (bx - ax) / len;
    const uy = (by - ay) / len;
    ctx.globalAlpha = alphaFor(i);
    ctx.beginPath();
    ctx.moveTo(ax + ux * ra, ay + uy * ra);
    ctx.lineTo(bx - ux * rb, by - uy * rb);
    ctx.stroke();
  }

  // Symbols.
  course.points.forEach((p, i) => {
    const [x, y] = pts[i];
    ctx.globalAlpha = pointAlpha(i);
    ctx.beginPath();
    if (p.kind === 'start') {
      // Triangle pointing to the next point.
      const nx = i + 1 < n ? pts[i + 1] : [x, y - 1];
      const a = Math.atan2(nx[1] - y, nx[0] - x);
      const R = radius(i);
      for (let k = 0; k < 3; k++) {
        const t = a + (k * 2 * Math.PI) / 3;
        const px = x + R * Math.cos(t);
        const py = y + R * Math.sin(t);
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    } else if (p.kind === 'finish') {
      ctx.arc(x, y, (ISOM_MM.finishInner / 2) * mm, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, (ISOM_MM.finishOuter / 2) * mm, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.arc(x, y, (ISOM_MM.circle / 2) * mm, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  // Control numbers: upright, placed away from the legs.
  if (style.showNumbers) {
    const h = ISOM_MM.number * mm;
    ctx.font = `700 ${h}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    course.points.forEach((p, i) => {
      if (p.kind !== 'control') return;
      const [x, y] = pts[i];
      const dirs: number[] = [];
      if (i > 0) dirs.push(Math.atan2(pts[i - 1][1] - y, pts[i - 1][0] - x));
      if (i + 1 < n) dirs.push(Math.atan2(pts[i + 1][1] - y, pts[i + 1][0] - x));
      const ang = bestLabelAngle(dirs);
      const r = radius(i) + h * 0.75;
      const tx = x + Math.cos(ang) * r;
      const ty = y + Math.sin(ang) * r;
      const label = pointLabel(course, i);
      ctx.globalAlpha = pointAlpha(i);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(2, h * 0.22);
      ctx.strokeText(label, tx, ty);
      ctx.fillStyle = OVERPRINT_PURPLE;
      ctx.fillText(label, tx, ty);
    });
  }

  // Selection ring (editor only, never in exports because selectedId is unset there).
  if (input.selectedId) {
    const i = course.points.findIndex((p) => p.id === input.selectedId);
    if (i >= 0) {
      ctx.globalAlpha = 1;
      ctx.setLineDash([4 * pr, 3 * pr]);
      ctx.strokeStyle = '#2f80ff';
      ctx.lineWidth = 2 * pr;
      ctx.beginPath();
      ctx.arc(pts[i][0], pts[i][1], radius(i) + 5 * pr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  ctx.restore();
}

/** Angle (radians, canvas) for a control number: the middle of the widest free sector between legs. */
export function bestLabelAngle(legDirs: number[]): number {
  if (legDirs.length === 0) return -Math.PI / 4;
  if (legDirs.length === 1) return legDirs[0] + Math.PI;
  const a = [...legDirs].map((d) => (d + 2 * Math.PI) % (2 * Math.PI)).sort((x, y) => x - y);
  let best = 0;
  let bestGap = -1;
  for (let k = 0; k < a.length; k++) {
    const from = a[k];
    const to = k + 1 < a.length ? a[k + 1] : a[0] + 2 * Math.PI;
    if (to - from > bestGap) {
      bestGap = to - from;
      best = from + (to - from) / 2;
    }
  }
  return best;
}
