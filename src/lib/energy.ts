import type { CurveProbe, EnergyResult, ForcePoint } from './types'
import { CM_PER_INCH, KG_PER_LB, type UnitSystem } from './units'

/** lbf · cm → J  (1 lbf = 4.4482216152605 N, 1 cm = 0.01 m) */
const LBF_CM_TO_JOULE = 4.4482216152605 * 0.01

function sortedPoints(points: ForcePoint[]): ForcePoint[] {
  return [...points].sort((a, b) => a.xCm - b.xCm || a.yLb - b.yLb)
}

function forceAtX(sorted: ForcePoint[], xCm: number): number {
  if (sorted.length === 0) return 0
  if (xCm <= sorted[0].xCm) return sorted[0].yLb
  if (xCm >= sorted[sorted.length - 1].xCm) return sorted[sorted.length - 1].yLb

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    if (xCm >= a.xCm && xCm <= b.xCm) {
      const span = b.xCm - a.xCm
      if (span <= 0) return a.yLb
      const t = (xCm - a.xCm) / span
      return a.yLb + t * (b.yLb - a.yLb)
    }
  }
  return sorted[sorted.length - 1].yLb
}

/** Area under curve from x0 to xEnd, in Lb·cm */
function areaLbCmTo(sorted: ForcePoint[], xEnd: number): number {
  const x0 = sorted[0].xCm
  const x = Math.min(Math.max(xEnd, x0), sorted[sorted.length - 1].xCm)
  let area = 0

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
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

/**
 * Probe the curve at a draw length.
 * 蓄能系数 = ∫F dx / (½ · 拉距 · 当前拉力)
 */
export function probeCurveAt(points: ForcePoint[], xTarget: number): CurveProbe | null {
  const sorted = sortedPoints(points)
  if (sorted.length < 2) return null

  const x0 = sorted[0].xCm
  const xMax = sorted[sorted.length - 1].xCm
  const xCm = Math.min(xMax, Math.max(x0, xTarget))
  const yLb = forceAtX(sorted, xCm)
  const areaLbCm = areaLbCmTo(sorted, xCm)
  const joules = areaLbCm * LBF_CM_TO_JOULE
  const span = xCm - x0
  const triangleLbCm = 0.5 * span * yLb
  const energyCoefficient =
    triangleLbCm > 1e-9 ? areaLbCm / triangleLbCm : null

  return { xCm, yLb, joules, energyCoefficient }
}

/** Trapezoidal integration of force×displacement → stored energy */
export function computeEnergy(points: ForcePoint[]): EnergyResult | null {
  const sorted = sortedPoints(points)
  if (sorted.length < 2) return null

  const probe = probeCurveAt(sorted, sorted[sorted.length - 1].xCm)
  if (!probe) return null

  const peakForceLb = Math.max(...sorted.map((p) => p.yLb))
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
      'draw_in,force_lb',
      ...sorted.map((p) => `${roundCoord(p.xCm / CM_PER_INCH, 4)},${p.yLb}`),
    ]
    return rows.join('\n')
  }
  const rows = [
    'draw_cm,force_kg',
    ...sorted.map((p) => `${p.xCm},${roundCoord(p.yLb * KG_PER_LB, 4)}`),
  ]
  return rows.join('\n')
}

export function parseCsv(text: string): ForcePoint[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (!lines.length) return []

  const header = lines[0].toLowerCase()
  const hasHeader =
    header.includes('force') ||
    header.includes('lb') ||
    header.includes('kg') ||
    header.includes('draw') ||
    header.includes('cm') ||
    header.includes('in')
  const start = hasHeader ? 1 : 0

  const lengthIsInch = header.includes('in') && !header.includes('cm')
  const forceIsKg = header.includes('kg') && !header.includes('lb')

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
