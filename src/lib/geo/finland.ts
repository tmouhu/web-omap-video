/**
 * Coarse outline of Finland (land + Åland + territorial sea), lon/lat. Used only to decide
 * "is this project in Finland" for the view CRS (EN-12). Accuracy near the borders is ~10 km.
 */
const FINLAND: [number, number][] = [
  [19.2, 60.0],
  [19.3, 60.6],
  [20.0, 61.5],
  [20.5, 63.0],
  [21.0, 63.6],
  [22.8, 64.6],
  [23.9, 65.5],
  [24.15, 65.85],
  [23.65, 66.4],
  [23.85, 66.8],
  [23.4, 67.8],
  [22.3, 68.3],
  [21.0, 68.75],
  [20.55, 69.06],
  [21.1, 69.3],
  [22.3, 68.75],
  [23.9, 68.8],
  [24.9, 68.6],
  [25.8, 69.0],
  [25.85, 69.4],
  [26.5, 69.95],
  [27.9, 70.1],
  [28.4, 69.85],
  [29.3, 69.3],
  [28.7, 68.9],
  [28.4, 68.5],
  [29.3, 68.1],
  [30.0, 67.7],
  [29.1, 66.9],
  [29.9, 66.0],
  [29.6, 65.6],
  [30.1, 64.8],
  [30.5, 64.2],
  [29.9, 63.8],
  [31.2, 63.2],
  [31.6, 62.9],
  [29.7, 61.6],
  [28.9, 61.1],
  [27.8, 60.55],
  [27.4, 60.05],
  [25.0, 59.75],
  [23.0, 59.7],
  [21.0, 59.55],
  [19.5, 59.6],
];

export function isInFinland(lon: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = FINLAND.length - 1; i < FINLAND.length; j = i++) {
    const [xi, yi] = FINLAND[i];
    const [xj, yj] = FINLAND[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
