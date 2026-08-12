import { probeCurveAt, type CurveMode } from './energy'
import type { ForcePoint } from './types'
import { CM_PER_INCH, KG_PER_LB } from './units'

/** 1 grain = 64.79891 mg */
export const KG_PER_GRAIN = 0.00006479891
/** 1 ft/s = 0.3048 m/s */
export const MPS_PER_FPS = 0.3048

export type SpeedUnit = 'mps' | 'fps'
export type MassUnit = 'grain' | 'gram'

export function speedToMps(value: number, unit: SpeedUnit): number {
  return unit === 'fps' ? value * MPS_PER_FPS : value
}

export function massToKg(value: number, unit: MassUnit): number {
  return unit === 'grain' ? value * KG_PER_GRAIN : value / 1000
}

/** KE = ½ m v² ，结果为焦耳 */
export function kineticEnergyJoules(
  mass: number,
  massUnit: MassUnit,
  speed: number,
  speedUnit: SpeedUnit,
): number | null {
  if (!Number.isFinite(mass) || !Number.isFinite(speed) || mass <= 0 || speed <= 0) {
    return null
  }
  const m = massToKg(mass, massUnit)
  const v = speedToMps(speed, speedUnit)
  return 0.5 * m * v * v
}

export type BowLinkResult = {
  /** 测速拉距下拉力 (Lb) */
  forceLb: number
  /** 测速拉距下弓蓄能 (J) */
  storedJ: number
  /** 箭动能 ÷ 拉力(Lb) */
  joulesPerLb: number | null
  /** 箭动能 / 弓蓄能 × 100 */
  efficiencyPct: number | null
}

/**
 * 用拉力曲线在指定拉距处取拉力与蓄能，再算每磅动能与效率。
 * @param drawCm 测速拉距（内部单位 cm）
 */
export function linkArrowKeToBow(
  keJ: number,
  points: ForcePoint[],
  drawCm: number,
  curveMode: CurveMode = 'spline',
): BowLinkResult | null {
  if (!Number.isFinite(keJ) || keJ < 0 || !Number.isFinite(drawCm)) return null
  if (points.length < 2) return null

  const sorted = [...points].sort((a, b) => a.xCm - b.xCm || a.yLb - b.yLb)
  const x0 = sorted[0].xCm
  const x1 = sorted[sorted.length - 1].xCm
  const x = Math.min(x1, Math.max(x0, drawCm))
  const probe = probeCurveAt(sorted, x, curveMode)
  if (!probe) return null

  const forceLb = probe.yLb
  const storedJ = probe.joules
  const joulesPerLb = forceLb > 1e-9 ? keJ / forceLb : null
  const efficiencyPct = storedJ > 1e-9 ? (keJ / storedJ) * 100 : null

  return { forceLb, storedJ, joulesPerLb, efficiencyPct }
}

/** 按单位制显示每磅/每千克动能 */
export function joulesPerForceDisplay(
  joulesPerLb: number | null,
  unitSystem: 'metric' | 'imperial',
): number | null {
  if (joulesPerLb == null) return null
  return unitSystem === 'imperial' ? joulesPerLb : joulesPerLb / KG_PER_LB
}

export function drawLabelHint(unitSystem: 'metric' | 'imperial'): string {
  return unitSystem === 'imperial' ? '测速拉距 (in)' : '测速拉距 (cm)'
}

export function perForceKeLabel(unitSystem: 'metric' | 'imperial'): string {
  return unitSystem === 'imperial' ? '每磅动能' : '每千克动能'
}

export function perForceKeUnit(unitSystem: 'metric' | 'imperial'): string {
  return unitSystem === 'imperial' ? 'J/Lb' : 'J/kg'
}

export function displayDrawToCm(
  value: number,
  unitSystem: 'metric' | 'imperial',
): number {
  return unitSystem === 'imperial' ? value * CM_PER_INCH : value
}
