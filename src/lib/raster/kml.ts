/** KML/KMZ GroundOverlay georeferencing (OCAD, OOM, Livelox exports) – STORY-13. */
import { unzipSync, strFromU8 } from 'fflate';

export interface GroundOverlay {
  href: string;
  /** Image corners lon/lat: top-left, top-right, bottom-right, bottom-left. */
  corners: [[number, number], [number, number], [number, number], [number, number]];
  name: string;
}

const num = (el: Element | undefined, name: string) => {
  const c = el ? Array.from(el.getElementsByTagName('*')).find((n) => n.localName === name) : undefined;
  const v = c ? parseFloat(c.textContent ?? '') : NaN;
  return Number.isFinite(v) ? v : NaN;
};

/** Parses the first GroundOverlay (LatLonBox + rotation, or gx:LatLonQuad). */
export function parseGroundOverlay(kml: string): GroundOverlay {
  const doc = new DOMParser().parseFromString(kml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Invalid KML file.');
  const go = doc.getElementsByTagNameNS('*', 'GroundOverlay')[0];
  if (!go) throw new Error('The KML file has no GroundOverlay (no georeferenced image).');
  const find = (root: Element, name: string) =>
    Array.from(root.getElementsByTagName('*')).find((n) => n.localName === name);
  const href = find(go, 'href')?.textContent?.trim() ?? '';
  const name = find(go, 'name')?.textContent?.trim() ?? '';
  const quad = find(go, 'LatLonQuad');
  if (quad) {
    // gx:LatLonQuad order: bottom-left, bottom-right, top-right, top-left.
    const pts = (find(quad, 'coordinates')?.textContent ?? '')
      .trim()
      .split(/\s+/)
      .map((t) => t.split(',').map(Number) as [number, number]);
    if (pts.length < 4) throw new Error('Invalid gx:LatLonQuad.');
    return { href, name, corners: [pts[3], pts[2], pts[1], pts[0]] };
  }
  const box = find(go, 'LatLonBox');
  const n = num(box, 'north');
  const s = num(box, 'south');
  const e = num(box, 'east');
  const w = num(box, 'west');
  if ([n, s, e, w].some((v) => !Number.isFinite(v))) throw new Error('GroundOverlay has no valid LatLonBox.');
  const rot = Number.isFinite(num(box, 'rotation')) ? num(box, 'rotation') : 0;
  // KML rotation: counter-clockwise degrees about the box centre, applied in lon/lat space
  // with the longitude axis scaled by cos(latitude) so the rotation is conformal on the ground.
  const cx = (e + w) / 2;
  const cy = (n + s) / 2;
  const k = Math.cos((cy * Math.PI) / 180);
  const t = (rot * Math.PI) / 180;
  const rotate = (lon: number, lat: number): [number, number] => {
    const dx = (lon - cx) * k;
    const dy = lat - cy;
    return [cx + (dx * Math.cos(t) - dy * Math.sin(t)) / k, cy + dx * Math.sin(t) + dy * Math.cos(t)];
  };
  return { href, name, corners: [rotate(w, n), rotate(e, n), rotate(e, s), rotate(w, s)] };
}

/** Extracts the KML text and the referenced image from a KMZ (zip). */
export function readKmz(data: Uint8Array): { overlay: GroundOverlay; image: Blob; imageName: string } {
  const files = unzipSync(data);
  const kmlName = Object.keys(files).find((f) => /\.kml$/i.test(f));
  if (!kmlName) throw new Error('The KMZ file contains no KML document.');
  const overlay = parseGroundOverlay(strFromU8(files[kmlName]));
  const base = kmlName.includes('/') ? kmlName.slice(0, kmlName.lastIndexOf('/') + 1) : '';
  const key =
    [overlay.href, base + overlay.href].find((k) => k && files[k]) ??
    Object.keys(files).find((f) => /\.(jpe?g|png|gif|webp)$/i.test(f));
  if (!key) throw new Error(`The image "${overlay.href}" is missing from the KMZ file.`);
  const ext = key.split('.').pop()!.toLowerCase();
  const type = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return { overlay, image: new Blob([files[key] as BlobPart], { type }), imageName: key };
}
