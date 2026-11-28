// Generates public/sample.gpx: a ~3 km orienteering-style run with 1 Hz GPS fixes.
import { writeFileSync } from 'node:fs';

let seed = 42;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const origin = { lat: 60.2035, lon: 24.9105 }; // Helsinki Central Park
const mLat = 111320;
const mLon = 111320 * Math.cos((origin.lat * Math.PI) / 180);
// Controls in meters (east, north) from the origin.
const controls = [
  [0, 0],
  [250, 180],
  [520, 90],
  [610, 420],
  [380, 640],
  [120, 520],
  [-150, 700],
  [-320, 380],
  [-180, 120],
  [0, 0],
];

const pts = [];
let t = Date.parse('2026-05-10T10:00:00Z');
let [x, y] = controls[0];
for (let c = 1; c < controls.length; c++) {
  const [tx, ty] = controls[c];
  let wobble = (rand() - 0.5) * 0.8;
  while (Math.hypot(tx - x, ty - y) > 3) {
    const dir = Math.atan2(ty - y, tx - x) + wobble;
    wobble = wobble * 0.97 + (rand() - 0.5) * 0.06;
    const speed = 2.6 + rand() * 1.2;
    x += Math.cos(dir) * speed;
    y += Math.sin(dir) * speed;
    const nx = x + (rand() - 0.5) * 3;
    const ny = y + (rand() - 0.5) * 3;
    pts.push({ lat: origin.lat + ny / mLat, lon: origin.lon + nx / mLon, t: (t += 1000) });
  }
  // Short pause at the control.
  for (let i = 0; i < 4; i++) pts.push({ lat: origin.lat + y / mLat, lon: origin.lon + x / mLon, t: (t += 1000) });
}

const body = pts
  .map(
    (p) =>
      `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}"><time>${new Date(p.t).toISOString()}</time></trkpt>`,
  )
  .join('\n');
writeFileSync(
  new URL('../public/sample.gpx', import.meta.url),
  `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="web-omap-poc" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Keskuspuisto sample</name>
    <trkseg>
${body}
    </trkseg>
  </trk>
</gpx>
`,
);
console.log(`wrote ${pts.length} points`);
