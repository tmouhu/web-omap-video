/** IOF XML 3.0 CourseData import/export (STORY-20): OCAD, Purple Pen, Condes, OOM course exports. */
import { newPointId, type Course, type CoursePoint, type CoursePointKind } from './course';

export interface IofCourseFile {
  courses: Course[];
  /** Map print scale from <Map><Scale>, if present. */
  mapScale: number | null;
  /** Controls that had no geographic <Position> (only MapPosition) and were skipped. */
  skippedControls: string[];
}

const kids = (el: Element, name: string) => Array.from(el.children).filter((c) => c.localName === name);
const kid = (el: Element, name: string) => kids(el, name)[0];
const text = (el: Element | undefined) => el?.textContent?.trim() ?? '';

export function parseIofCourseData(xml: string): IofCourseFile {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('The file is not valid XML.');
  const root = doc.documentElement;
  if (root.localName !== 'CourseData') throw new Error('Not an IOF XML 3.0 CourseData file.');
  const rcd = kid(root, 'RaceCourseData');
  if (!rcd) throw new Error('The file has no RaceCourseData.');
  const scale = parseFloat(text(kid(kid(rcd, 'Map') ?? root, 'Scale')));

  const positions = new Map<string, { lat: number; lon: number; type: string }>();
  const skipped: string[] = [];
  for (const c of kids(rcd, 'Control')) {
    const id = text(kid(c, 'Id'));
    const pos = kid(c, 'Position');
    const lat = parseFloat(pos?.getAttribute('lat') ?? '');
    const lon = parseFloat(pos?.getAttribute('lng') ?? '');
    if (Number.isFinite(lat) && Number.isFinite(lon))
      positions.set(id, { lat, lon, type: c.getAttribute('type') ?? 'Control' });
    else skipped.push(id);
  }

  const courses: Course[] = [];
  for (const c of kids(rcd, 'Course')) {
    const points: CoursePoint[] = [];
    for (const cc of kids(c, 'CourseControl')) {
      const id = text(kid(cc, 'Control'));
      const pos = positions.get(id);
      if (!pos) continue;
      const t = (cc.getAttribute('type') ?? pos.type).toLowerCase();
      const kind: CoursePointKind = t === 'start' ? 'start' : t === 'finish' ? 'finish' : 'control';
      points.push({ id: newPointId(), kind, lat: pos.lat, lon: pos.lon, ...(kind === 'control' ? { code: id } : {}) });
    }
    if (points.length) courses.push({ name: text(kid(c, 'Name')) || `Course ${courses.length + 1}`, points });
  }
  if (!courses.length) {
    throw new Error(
      skipped.length
        ? 'The controls have no geographic positions (only map positions). Export the course with coordinates.'
        : 'The file contains no courses.',
    );
  }
  return { courses, mapScale: Number.isFinite(scale) ? scale : null, skippedControls: skipped };
}

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);

export function writeIofCourseData(course: Course, mapScale: number | null): string {
  const ids = course.points.map((p, i) =>
    p.kind === 'start' ? 'S1' : p.kind === 'finish' ? 'F1' : p.code || String(30 + i),
  );
  const unique = [...new Map(course.points.map((p, i) => [ids[i], p])).entries()];
  const type = (k: CoursePointKind) => (k === 'start' ? 'Start' : k === 'finish' ? 'Finish' : 'Control');
  const controls = unique
    .map(
      ([id, p]) =>
        `    <Control type="${type(p.kind)}"><Id>${esc(id)}</Id><Position lng="${p.lon.toFixed(7)}" lat="${p.lat.toFixed(7)}"/></Control>`,
    )
    .join('\n');
  const seq = course.points
    .map((p, i) => `      <CourseControl type="${type(p.kind)}"><Control>${esc(ids[i])}</Control></CourseControl>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<CourseData xmlns="http://www.orienteering.org/datastandard/3.0" iofVersion="3.0" createTime="${new Date().toISOString()}" creator="OMap Video">
  <Event><Name>${esc(course.name)}</Name></Event>
  <RaceCourseData>
${mapScale ? `    <Map><Scale>${mapScale}</Scale></Map>\n` : ''}${controls}
    <Course>
      <Name>${esc(course.name)}</Name>
${seq}
    </Course>
  </RaceCourseData>
</CourseData>
`;
}
