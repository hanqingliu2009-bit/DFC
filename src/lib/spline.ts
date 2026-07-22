/** Natural cubic spline for F(x), x strictly increasing. */

export type Spline = {
  xs: number[]
  ys: number[]
  /** Second derivatives at knots (Natural BC: y2[0]=y2[n-1]=0) */
  y2: number[]
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

export function buildNaturalCubicSpline(xsIn: number[], ysIn: number[]): Spline | null {
  const { xs, ys } = uniqueByX(xsIn, ysIn)
  const n = xs.length
  if (n < 2) return null

  const y2 = new Array<number>(n).fill(0)
  if (n === 2) return { xs, ys, y2 }

  const u = new Array<number>(n).fill(0)
  for (let i = 1; i < n - 1; i++) {
    const sig = (xs[i] - xs[i - 1]) / (xs[i + 1] - xs[i - 1])
    const p = sig * y2[i - 1] + 2
    y2[i] = (sig - 1) / p
    u[i] =
      (6 *
        ((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]) -
          (ys[i] - ys[i - 1]) / (xs[i] - xs[i - 1])) /
        (xs[i + 1] - xs[i - 1]) -
        sig * u[i - 1]) /
      p
  }
  for (let k = n - 2; k >= 0; k--) {
    y2[k] = y2[k] * y2[k + 1] + u[k]
  }
  return { xs, ys, y2 }
}

export function evalSpline(spline: Spline, x: number): number {
  const { xs, ys, y2 } = spline
  const n = xs.length
  if (x <= xs[0]) return ys[0]
  if (x >= xs[n - 1]) return ys[n - 1]

  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (hi + lo) >> 1
    if (xs[mid] > x) hi = mid
    else lo = mid
  }

  const h = xs[hi] - xs[lo]
  if (h <= 1e-12) return ys[lo]
  const a = (xs[hi] - x) / h
  const b = (x - xs[lo]) / h
  return (
    a * ys[lo] +
    b * ys[hi] +
    ((a * a * a - a) * y2[lo] + (b * b * b - b) * y2[hi]) * (h * h) / 6
  )
}

/** First derivative dy/dx on the spline (at endpoints uses adjacent segment). */
export function evalSplineDerivative(spline: Spline, x: number): number {
  const { xs, ys, y2 } = spline
  const n = xs.length
  if (n < 2) return 0

  let lo = 0
  let hi = n - 1
  if (x <= xs[0]) {
    lo = 0
    hi = 1
  } else if (x >= xs[n - 1]) {
    lo = n - 2
    hi = n - 1
  } else {
    while (hi - lo > 1) {
      const mid = (hi + lo) >> 1
      if (xs[mid] > x) hi = mid
      else lo = mid
    }
  }

  const h = xs[hi] - xs[lo]
  if (h <= 1e-12) return 0
  const a = (xs[hi] - x) / h
  const b = (x - xs[lo]) / h
  return (
    (ys[hi] - ys[lo]) / h +
    ((1 - 3 * a * a) * y2[lo] + (3 * b * b - 1) * y2[hi]) * h / 6
  )
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
  const { xs, ys } = spline
  const segs: BezierSegment[] = []
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i]
    const x3 = xs[i + 1]
    const h = x3 - x0
    if (h <= 1e-12) continue
    const y0 = ys[i]
    const y3 = ys[i + 1]
    const d0 = evalSplineDerivative(spline, x0)
    const d3 = evalSplineDerivative(spline, x3)
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
