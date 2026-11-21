/**
 * Affine pixel → map transforms for raster maps (STORY-13/14).
 * Pixel coordinates use the CORNER convention: (0,0) is the top-left corner of the image,
 * (width,height) the bottom-right corner; rows grow downwards.
 *   x = a·col + b·row + c
 *   y = d·col + e·row + f
 */
export type Affine = [a: number, b: number, c: number, d: number, e: number, f: number];
export type Pt = [number, number];

export function apply(A: Affine, p: Pt): Pt {
  return [A[0] * p[0] + A[1] * p[1] + A[2], A[3] * p[0] + A[4] * p[1] + A[5]];
}

export function invert(A: Affine): Affine {
  const [a, b, c, d, e, f] = A;
  const det = a * e - b * d;
  if (Math.abs(det) < 1e-18) throw new Error('Transform is not invertible');
  return [e / det, -b / det, (b * f - c * e) / det, -d / det, a / det, (c * d - a * f) / det];
}

/** Ground size of one pixel (geometric mean of the two axes). */
export function pixelSize(A: Affine): number {
  return Math.sqrt(Math.abs(A[0] * A[4] - A[1] * A[3]));
}

/** Rotation of the image's "up" (−row) direction as a grid bearing in degrees. */
export function rotationDeg(A: Affine): number {
  return ((Math.atan2(-A[1], -A[4]) * 180) / Math.PI + 360) % 360;
}

export type FitKind = 'shift' | 'similarity' | 'affine';

export interface FitResult {
  affine: Affine;
  kind: FitKind;
  /** Residual distance (map units) per pair, after the fit. */
  residuals: number[];
  rms: number;
}

/** Solves the normal equations of a small least-squares problem (Gaussian elimination). */
function leastSquares(rows: number[][], rhs: number[]): number[] {
  const n = rows[0].length;
  const M = Array.from({ length: n }, () => new Array<number>(n + 1).fill(0));
  rows.forEach((r, k) => {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) M[i][j] += r[i] * r[j];
      M[i][n] += r[i] * rhs[k];
    }
  });
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-12) throw new Error('Points are degenerate (e.g. all on one line)');
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const k = M[r][col] / M[col][col];
      for (let j = col; j <= n; j++) M[r][j] -= k * M[col][j];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/**
 * Fits pixel → map transform from point pairs (STORY-14):
 * 1 pair → shift of `current`; 2 pairs (or `kind = 'similarity'`) → shift + rotation + uniform scale;
 * ≥3 pairs → full affine (default) by least squares. Image rows run downwards and map y upwards,
 * so the similarity includes that mirror.
 */
export function fitTransform(
  pixels: Pt[],
  world: Pt[],
  current: Affine,
  prefer: 'auto' | 'similarity' = 'auto',
): FitResult {
  const n = pixels.length;
  if (n === 0) return { affine: current, kind: 'shift', residuals: [], rms: 0 };
  let affine: Affine;
  let kind: FitKind;
  if (n === 1) {
    const p = apply(current, pixels[0]);
    affine = [
      current[0],
      current[1],
      current[2] + world[0][0] - p[0],
      current[3],
      current[4],
      current[5] + world[0][1] - p[1],
    ];
    kind = 'shift';
  } else if (n === 2 || prefer === 'similarity') {
    // x = s·c + t·r + tx ; y = t·c − s·r + ty  (rotation + scale, row axis mirrored)
    const rows: number[][] = [];
    const rhs: number[] = [];
    pixels.forEach(([c, r], i) => {
      rows.push([c, r, 1, 0]);
      rhs.push(world[i][0]);
      rows.push([-r, c, 0, 1]);
      rhs.push(world[i][1]);
    });
    const [s, t, tx, ty] = leastSquares(rows, rhs);
    affine = [s, t, tx, t, -s, ty];
    kind = 'similarity';
  } else {
    const rows = pixels.map(([c, r]) => [c, r, 1]);
    const [a, b, c] = leastSquares(
      rows,
      world.map((w) => w[0]),
    );
    const [d, e, f] = leastSquares(
      rows,
      world.map((w) => w[1]),
    );
    affine = [a, b, c, d, e, f];
    kind = 'affine';
  }
  const residuals = pixels.map((p, i) => {
    const q = apply(affine, p);
    return Math.hypot(q[0] - world[i][0], q[1] - world[i][1]);
  });
  const rms = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / n);
  return { affine, kind, residuals, rms };
}

/** Exact affine through three point pairs. */
export function affineFrom3(pixels: [Pt, Pt, Pt], world: [Pt, Pt, Pt]): Affine {
  return fitTransform(pixels, world, [1, 0, 0, 0, -1, 0]).affine;
}
