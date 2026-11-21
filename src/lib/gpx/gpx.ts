/** GPX parsing (STORY-2). Reads trkpt (or rtept), time, ele, and HR/cadence extensions. */

export interface GpxPoint {
  lat: number;
  lon: number;
  /** Epoch ms, or null when the point has no timestamp. */
  time: number | null;
  ele: number | null;
  hr: number | null;
  cad: number | null;
}

export interface GpxData {
  name: string;
  points: GpxPoint[];
  /** Number of trkseg elements (segments are concatenated). */
  segments: number;
}

export class GpxError extends Error {}

function childText(el: Element, name: string): string | null {
  for (const c of Array.from(el.children)) if (c.localName === name) return c.textContent?.trim() ?? null;
  return null;
}

/** First descendant (any namespace) whose local name matches one of `names`. */
function descendantNumber(el: Element, names: string[]): number | null {
  const ext = Array.from(el.children).find((c) => c.localName === 'extensions');
  if (!ext) return null;
  const all = ext.getElementsByTagName('*');
  for (const n of Array.from(all)) {
    if (names.includes(n.localName.toLowerCase())) {
      const v = parseFloat(n.textContent ?? '');
      if (Number.isFinite(v)) return v;
    }
  }
  return null;
}

const num = (s: string | null) => {
  const v = s === null ? NaN : parseFloat(s);
  return Number.isFinite(v) ? v : null;
};

export function parseGpx(xml: string): GpxData {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) throw new GpxError('The file is not valid XML.');
  let nodes = Array.from(doc.getElementsByTagNameNS('*', 'trkpt'));
  if (nodes.length === 0) nodes = Array.from(doc.getElementsByTagNameNS('*', 'rtept'));

  const points: GpxPoint[] = [];
  for (const n of nodes) {
    const lat = parseFloat(n.getAttribute('lat') ?? '');
    const lon = parseFloat(n.getAttribute('lon') ?? '');
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const timeText = childText(n, 'time');
    const t = timeText ? Date.parse(timeText) : NaN;
    points.push({
      lat,
      lon,
      time: Number.isFinite(t) ? t : null,
      ele: num(childText(n, 'ele')),
      hr: descendantNumber(n, ['hr', 'heartrate']),
      cad: descendantNumber(n, ['cad', 'cadence', 'runcadence']),
    });
  }
  if (points.length < 2) throw new GpxError('The GPX file must contain at least two track points.');

  const trk = doc.getElementsByTagNameNS('*', 'trk')[0];
  const nameEl = trk ? Array.from(trk.children).find((c) => c.localName === 'name') : undefined;
  const meta = doc.getElementsByTagNameNS('*', 'name')[0];
  return {
    name: nameEl?.textContent?.trim() || meta?.textContent?.trim() || 'GPX track',
    points,
    segments: Math.max(1, doc.getElementsByTagNameNS('*', 'trkseg').length),
  };
}
