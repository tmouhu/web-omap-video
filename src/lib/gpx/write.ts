/** GPX 1.1 writer for the edited track (STORY-21 export), keeping time, elevation, HR and cadence. */
import type { GpxPoint } from './gpx';

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);

export function writeGpx(name: string, points: GpxPoint[]): string {
  const pts = points
    .map((p) => {
      const inner: string[] = [];
      if (p.ele !== null) inner.push(`<ele>${p.ele.toFixed(1)}</ele>`);
      if (p.time !== null) inner.push(`<time>${new Date(p.time).toISOString()}</time>`);
      if (p.hr !== null || p.cad !== null) {
        const ext = [
          p.hr !== null ? `<gpxtpx:hr>${Math.round(p.hr)}</gpxtpx:hr>` : '',
          p.cad !== null ? `<gpxtpx:cad>${Math.round(p.cad)}</gpxtpx:cad>` : '',
        ].join('');
        inner.push(`<extensions><gpxtpx:TrackPointExtension>${ext}</gpxtpx:TrackPointExtension></extensions>`);
      }
      return `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}">${inner.join('')}</trkpt>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="OMap Video" xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <trk>
    <name>${esc(name)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}
