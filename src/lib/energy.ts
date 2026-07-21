import type { EnergyResult, ForcePoint } from './types'

/** lbf · cm → J  (1 lbf = 4.4482216152605 N, 1 cm = 0.01 m) */
const LBF_CM_TO_JOULE = 4.4482216152605 * 0.01
/** J → ft·lbf */
const JOULE_TO_FT_LB = 0.737562149277

function sortedPoints(points: ForcePoint[]): ForcePoint[] {
  return [...points].sort((a, b) => a.xCm - b.xCm || a.yLb - b.yLb)
}

/** Trapezoidal integration of force×displacement → stored energy */
export function computeEnergy(points: ForcePoint[]): EnergyResult | null {
  const sorted = sortedPoints(points)
  if (sorted.length < 2) return null

  let joules = 0
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    const dx = b.xCm - a.xCm
    if (dx <= 0) continue
    const avgF = (a.yLb + b.yLb) / 2
    joules += avgF * dx * LBF_CM_TO_JOULE
  }

  const peakForceLb = Math.max(...sorted.map((p) => p.yLb))
  const drawLengthCm = sorted[sorted.length - 1].xCm - sorted[0].xCm
  const averageForceLb =
    drawLengthCm > 0 ? joules / (drawLengthCm * LBF_CM_TO_JOULE) : 0
  const footPounds = joules * JOULE_TO_FT_LB
  const joulesPerLb = peakForceLb > 0 ? joules / peakForceLb : 0
  const footPoundsPerLb = peakForceLb > 0 ? footPounds / peakForceLb : 0

  return {
    joules,
    footPounds,
    joulesPerLb,
    footPoundsPerLb,
    peakForceLb,
    drawLengthCm,
    averageForceLb,
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

export function pointsToCsv(points: ForcePoint[]): string {
  const rows = ['draw_cm,force_lb', ...sortedPoints(points).map((p) => `${p.xCm},${p.yLb}`)]
  return rows.join('\n')
}

export function parseCsv(text: string): ForcePoint[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const start = lines[0]?.toLowerCase().includes('force') || lines[0]?.toLowerCase().includes('lb') ? 1 : 0
  const points: ForcePoint[] = []
  for (let i = start; i < lines.length; i++) {
    const parts = lines[i].split(/[,;\t]+/).map((s) => s.trim())
    const xCm = Number(parts[0])
    const yLb = Number(parts[1])
    if (Number.isFinite(xCm) && Number.isFinite(yLb)) {
      points.push(createPoint(xCm, yLb))
    }
  }
  return points
}

export { sortedPoints }
