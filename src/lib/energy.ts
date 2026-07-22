import type { CurveProbe, EnergyResult, ForcePoint } from './types'
import {
  buildNaturalCubicSpline,
  evalSpline,
  sampleSpline,
  splineToBezierSegments,
  type BezierSegment,
  type SamplePoint,
  type Spline,
} from './spline'
import { CM_PER_INCH, KG_PER_LB, type UnitSystem } from './units'

/** lbf · cm → J  (1 lbf = 4.4482216152605 N, 1 cm = 0.01 m) */
const LBF_CM_TO_JOULE = 4.4482216152605 * 0.01
/** Dense samples between each pair of measured knots */
const SAMPLES_PER_SEGMENT = 14

function sortedPoints(points: ForcePoint[]): ForcePoint[] {
  return [...points].sort((a, b) => a.xCm - b.xCm || a.yLb - b.yLb)
}

export function buildCurveSpline(points: ForcePoint[]): Spline | null {
  const sorted = sortedPoints(points)
  if (sorted.length < 2) return null
  return buildNaturalCubicSpline(
    sorted.map((p) => p.xCm),
    sorted.map((p) => p.yLb),
  )
}

export type CurveMode = 'linear' | 'spline'

/** Dense polyline used for both rendering and energy integration */
export function sampleForceCurve(
  points: ForcePoint[],
  mode: CurveMode = 'spline',
): SamplePoint[] {
  const sorted = sortedPoints(points)
  if (sorted.length < 2) return []
  if (mode === 'linear') {
    return sorted.map((p) => ({ xCm: p.xCm, yLb: p.yLb }))
  }
  const spline = buildCurveSpline(sorted)
  if (!spline) return sorted.map((p) => ({ xCm: p.xCm, yLb: p.yLb }))
  return sampleSpline(spline, SAMPLES_PER_SEGMENT)
}

export function forceCurveBeziers(points: ForcePoint[]): BezierSegment[] {
  const spline = buildCurveSpline(points)
  if (!spline) return []
  return splineToBezierSegments(spline)
}

function areaLbCmTo(samples: SamplePoint[], x0: number, xEnd: number): number {
  const x = Math.min(Math.max(xEnd, x0), samples[samples.length - 1].xCm)
  let area = 0

  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i]
    const b = samples[i + 1]
    if (b.xCm <= x0 || a.xCm >= x) continue

    const left = Math.max(a.xCm, x0)
    const right = Math.min(b.xCm, x)
    if (right <= left) continue

    const seg = b.xCm - a.xCm
    const fLeft =
      seg <= 0 ? a.yLb : a.yLb + ((left - a.xCm) / seg) * (b.yLb - a.yLb)
    const fRight =
      seg <= 0 ? b.yLb : a.yLb + ((right - a.xCm) / seg) * (b.yLb - a.yLb)
    area += ((fLeft + fRight) / 2) * (right - left)
  }

  return area
}

export function probeCurveAt(
  points: ForcePoint[],
  xTarget: number,
  mode: CurveMode = 'spline',
): CurveProbe | null {
  const sorted = sortedPoints(points)
  if (sorted.length < 2) return null

  const samples = sampleForceCurve(sorted, mode)
  if (samples.length < 2) return null

  const x0 = samples[0].xCm
  const xMax = samples[samples.length - 1].xCm
  const xCm = Math.min(xMax, Math.max(x0, xTarget))

  let yLb: number
  if (mode === 'spline') {
    const spline = buildCurveSpline(sorted)
    yLb = spline ? evalSpline(spline, xCm) : samples[0].yLb
  } else {
    // linear interpolate on knots
    yLb = samples[0].yLb
    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i]
      const b = samples[i + 1]
      if (xCm >= a.xCm && xCm <= b.xCm) {
        const span = b.xCm - a.xCm
        yLb = span <= 0 ? a.yLb : a.yLb + ((xCm - a.xCm) / span) * (b.yLb - a.yLb)
        break
      }
    }
  }

  const areaLbCm = areaLbCmTo(samples, x0, xCm)
  const joules = areaLbCm * LBF_CM_TO_JOULE
  const span = xCm - x0
  const triangleLbCm = 0.5 * span * yLb
  const energyCoefficient =
    triangleLbCm > 1e-9 ? areaLbCm / triangleLbCm : null

  return { xCm, yLb, joules, energyCoefficient }
}

/** Trapezoidal integration on curve samples → stored energy */
export function computeEnergy(
  points: ForcePoint[],
  mode: CurveMode = 'spline',
): EnergyResult | null {
  const sorted = sortedPoints(points)
  if (sorted.length < 2) return null

  const probe = probeCurveAt(sorted, sorted[sorted.length - 1].xCm, mode)
  if (!probe) return null

  const samples = sampleForceCurve(sorted, mode)
  const peakForceLb = Math.max(
    ...sorted.map((p) => p.yLb),
    ...samples.map((s) => s.yLb),
  )
  const peakForceKg = peakForceLb * KG_PER_LB
  const drawLengthCm = sorted[sorted.length - 1].xCm - sorted[0].xCm
  const drawLengthIn = drawLengthCm / CM_PER_INCH
  const joulesPerLb = peakForceLb > 0 ? probe.joules / peakForceLb : 0
  const joulesPerKg = peakForceKg > 0 ? probe.joules / peakForceKg : 0

  return {
    joules: probe.joules,
    joulesPerLb,
    joulesPerKg,
    peakForceLb,
    peakForceKg,
    drawLengthCm,
    drawLengthIn,
    energyCoefficient: probe.energyCoefficient,
    pointCount: sorted.length,
  }
}

export function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function createPoint(xCm: number, yLb: number): ForcePoint {
  return {
    id: crypto.randomUUID(),
    xCm: roundCoord(xCm, 2),
    yLb: roundCoord(yLb, 2),
  }
}

export function roundCoord(n: number, digits = 2): number {
  const f = 10 ** digits
  return Math.round(n * f) / f
}

/** Sample recurve: brace ≈20 cm at 0 Lb, then force rises to full draw */
export function sampleCurve(): ForcePoint[] {
  const raw: [number, number][] = [
    [20, 0],
    [25, 5],
    [30, 10],
    [35, 15],
    [40, 20],
    [45, 24],
    [50, 28],
    [55, 31],
    [60, 34],
    [65, 37],
    [68, 39],
    [70, 40],
  ]
  return raw.map(([xCm, yLb]) => createPoint(xCm, yLb))
}

export function pointsToCsv(points: ForcePoint[], system: UnitSystem = 'metric'): string {
  const sorted = sortedPoints(points)
  if (system === 'imperial') {
    const rows = [
      '拉距_in,拉力_lb',
      ...sorted.map((p) => `${roundCoord(p.xCm / CM_PER_INCH, 4)},${p.yLb}`),
    ]
    return rows.join('\n')
  }
  const rows = [
    '拉距_cm,拉力_kg',
    ...sorted.map((p) => `${p.xCm},${roundCoord(p.yLb * KG_PER_LB, 4)}`),
  ]
  return rows.join('\n')
}

/** 解析 CSV 首行：识别中英文表头与单位关键词 */
function parseCsvHeader(firstLine: string): {
  hasHeader: boolean
  lengthIsInch: boolean
  forceIsKg: boolean
} {
  const text = firstLine.trim()
  const lower = text.toLowerCase()
  const both = `${text} ${lower}`

  const hasLengthWord = /拉距|行程|draw|length/.test(both)
  const hasForceWord = /拉力|力值|force/.test(both)
  const hasCm = /厘米|公分|(^|[^a-z])cm([^a-z]|$)/i.test(both)
  const hasInch = /英寸|吋|inch|(^|[^a-z])in([^a-z]|$)/i.test(both)
  const hasLb = /磅|(^|[^a-z])lbf?([^a-z]|$)/i.test(both)
  const hasKg = /千克|公斤|(^|[^a-z])kgf?([^a-z]|$)/i.test(both)

  const hasHeader =
    hasLengthWord || hasForceWord || hasCm || hasInch || hasLb || hasKg

  const lengthIsInch = hasInch && !hasCm
  const forceIsKg = hasKg && !hasLb

  return { hasHeader, lengthIsInch, forceIsKg }
}

export function parseCsv(text: string): ForcePoint[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (!lines.length) return []

  const { hasHeader, lengthIsInch, forceIsKg } = parseCsvHeader(lines[0])
  const start = hasHeader ? 1 : 0

  const points: ForcePoint[] = []
  for (let i = start; i < lines.length; i++) {
    const parts = lines[i].split(/[,;\t]+/).map((s) => s.trim())
    const rawX = Number(parts[0])
    const rawY = Number(parts[1])
    if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) continue
    const xCm = lengthIsInch ? rawX * CM_PER_INCH : rawX
    const yLb = forceIsKg ? rawY / KG_PER_LB : rawY
    points.push(createPoint(xCm, yLb))
  }
  return points
}

export { sortedPoints }
