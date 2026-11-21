/** Shared number/time formatting for UI, overlays and (later) data components. */

/** `m:ss` below one hour, `h:mm:ss` from one hour. Negative values get a leading minus. */
export function formatDuration(sec: number): string {
  const neg = sec < 0;
  let s = Math.round(Math.abs(sec));
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const ss = String(s).padStart(2, '0');
  const out = h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
  return neg ? `-${out}` : out;
}

/** Metres below 1 km (`840 m`), kilometres with 2 decimals from 1 km (`1.24 km`). */
export function formatDistance(m: number, decimalSep = '.'): string {
  if (Math.round(m) < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2).replace('.', decimalSep)} km`;
}

/** Pace from seconds per km: `5:42 /km`; `–:–` when null. */
export function formatPace(secPerKm: number | null): string {
  if (secPerKm === null || !Number.isFinite(secPerKm) || secPerKm > 3600) return '–:– /km';
  return `${formatDuration(secPerKm)} /km`;
}

/** `1:10 000` (rounded to nearest 10 above 1 000, thin-space thousands). */
export function formatScale(scale: number): string {
  const r = scale >= 1000 ? Math.round(scale / 10) * 10 : Math.round(scale);
  return '1:' + r.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function formatClock(epochMs: number): string {
  const d = new Date(epochMs);
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((v) => String(v).padStart(2, '0')).join(':');
}
