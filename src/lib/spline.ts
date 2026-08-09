/**
 * Akima cubic Hermite spline for F(x), x strictly increasing.
 * Local: editing/adding a knot only reshapes nearby segments (not the whole curve).
 */

export type Spline = {
  xs: number[]
  ys: number[]
  /** First derivatives dy/dx at knots */
  m: number[]
}

export type SamplePoint = {
  xCm: number
  yLb: number
}

/** Collapse duplicate x (keep last y). Requires >= 1 point. */
export function uniqueByX(xs: number[], ys: number[]): { xs: number[]; ys: number[] } {
  const outX: number[] = []
  const outY: number[] = []
  for (let i = 0; i < xs.length; i++) {
    if (outX.length && Math.abs(xs[i] - outX[outX.length - 1]) < 1e-9) {
      outY[outY.length - 1] = ys[i]
    } else {
      outX.push(xs[i])
      outY.push(ys[i])
    }
  }
  return { xs: outX, ys: outY }
}

/**
 * Akima slope at knots. Each segment depends only on a few neighboring slopes,
 * so inserting a point between A–B mainly changes the neighborhood of A–B.
 */
export function buildAkimaSpline(xsIn: number[], ysIn: number[]): Spline | null {
  const { xs, ys } = uniqueByX(xsIn, ysIn)
  const n = xs.length
  if (n < 2) return null

  if (n === 2) {
    const slope = (ys[1] - ys[0]) / (xs[1] - xs[0])
    return { xs, ys, m: [slope, slope] }
  }

  // Interval slopes s[0..n-2]
  const s: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const h = xs[i + 1] - xs[i]
    s.push(h <= 1e-12 ? 0 : (ys[i + 1] - ys[i]) / h)
  }

  // Extrapolate two slopes on each end (classic Akima)
  const sL1 = 2 * s[0] - s[1]
  const sL2 = 2 * sL1 - s[0]
  const sR1 = 2 * s[n - 2] - s[n - 3]
  const sR2 = 2 * sR1 - s[n - 2]
  const S = [sL2, sL1, ...s, sR1, sR2]

  // S indexed so S[k] corresponds to extrapolated + real; knot i uses S[i]..S[i+3]
  // S = [s_{-2}, s_{-1}, s_0, ..., s_{n-2}, s_{n-1}, s_n]
  // For knot i, weights from |S[i+3]-S[i+2]| and |S[i+1]-S[i]|
  const m = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    const d1 = Math.abs(S[i + 3] - S[i + 2])
    const d2 = Math.abs(S[i + 1] - S[i])
    if (d1 + d2 < 1e-12) {
      m[i] = 0.5 * (S[i + 1] + S[i + 2])
    } else {
      m[i] = (d1 * S[i + 1] + d2 * S[i + 2]) / (d1 + d2)
    }
  }

  return { xs, ys, m }
}

/** @deprecated alias — kept so older imports keep working */
export const buildNaturalCubicSpline = buildAkimaSpline

function findSegment(xs: number[], x: number): { lo: number; hi: number } {
  const n = xs.length
  if (x <= xs[0]) return { lo: 0, hi: 1 }
  if (x >= xs[n - 1]) return { lo: n - 2, hi: n - 1 }
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (hi + lo) >> 1
    if (xs[mid] > x) hi = mid
    else lo = mid
  }
  return { lo, hi }
}

export function evalSpline(spline: Spline, x: number): number {
  const { xs, ys, m } = spline
  const n = xs.length
  if (x <= xs[0]) return ys[0]
  if (x >= xs[n - 1]) return ys[n - 1]

  const { lo, hi } = findSegment(xs, x)
  const h = xs[hi] - xs[lo]
  if (h <= 1e-12) return ys[lo]

  const t = (x - xs[lo]) / h
  const t2 = t * t
  const t3 = t2 * t
  const h00 = 2 * t3 - 3 * t2 + 1
  const h10 = t3 - 2 * t2 + t
  const h01 = -2 * t3 + 3 * t2
  const h11 = t3 - t2
  return h00 * ys[lo] + h10 * h * m[lo] + h01 * ys[hi] + h11 * h * m[hi]
}

/** First derivative dy/dx on the spline. */
export function evalSplineDerivative(spline: Spline, x: number): number {
  const { xs, ys, m } = spline
  const n = xs.length
  if (n < 2) return 0

  const { lo, hi } = findSegment(xs, x)
  const h = xs[hi] - xs[lo]
  if (h <= 1e-12) return 0

  // Clamp t into [0,1] for endpoint derivative queries
  let t = (x - xs[lo]) / h
  if (x <= xs[0]) t = 0
  if (x >= xs[n - 1]) t = 1

  const t2 = t * t
  // d/dt of Hermite basis, then / h for d/dx
  const dh00 = 6 * t2 - 6 * t
  const dh10 = 3 * t2 - 4 * t + 1
  const dh01 = -6 * t2 + 6 * t
  const dh11 = 3 * t2 - 2 * t
  return (dh00 * ys[lo] + dh10 * h * m[lo] + dh01 * ys[hi] + dh11 * h * m[hi]) / h
}

export type BezierSegment = {
  x0: number
  y0: number
  x1: number
  y1: number
  x2: number
  y2: number
  x3: number
  y3: number
}

/** Convert each spline span to a cubic Bezier in (x,y) for SVG drawing. */
export function splineToBezierSegments(spline: Spline): BezierSegment[] {
  const { xs, ys, m } = spline
  const segs: BezierSegment[] = []
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i]
    const x3 = xs[i + 1]
    const h = x3 - x0
    if (h <= 1e-12) continue
    const y0 = ys[i]
    const y3 = ys[i + 1]
    const d0 = m[i]
    const d3 = m[i + 1]
    segs.push({
      x0,
      y0,
      x1: x0 + h / 3,
      y1: y0 + (d0 * h) / 3,
      x2: x3 - h / 3,
      y2: y3 - (d3 * h) / 3,
      x3,
      y3,
    })
  }
  return segs
}

/**
 * Dense samples along the spline (same set used for drawing + integration).
 * @param samplesPerSegment subdivisions between each pair of knots
 */
export function sampleSpline(
  spline: Spline,
  samplesPerSegment = 12,
): SamplePoint[] {
  const { xs } = spline
  const samples: SamplePoint[] = []
  const seg = Math.max(1, Math.floor(samplesPerSegment))

  for (let i = 0; i < xs.length - 1; i++) {
    for (let k = 0; k < seg; k++) {
      const t = k / seg
      const xCm = xs[i] + (xs[i + 1] - xs[i]) * t
      const yLb = evalSpline(spline, xCm)
      samples.push({ xCm, yLb })
    }
  }
  samples.push({
    xCm: xs[xs.length - 1],
    yLb: evalSpline(spline, xs[xs.length - 1]),
  })
  return samples
}
