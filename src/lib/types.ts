export type ForcePoint = {
  id: string
  /** Draw length in centimeters */
  xCm: number
  /** Draw force in pounds (lbf) */
  yLb: number
}

export type AxisRange = {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

export type CurveProbe = {
  /** Draw length on the curve (cm) */
  xCm: number
  /** Interpolated force at xCm (Lb) */
  yLb: number
  /** Stored energy from curve start to xCm (J) */
  joules: number
  /**
   * 蓄能系数 = 曲线下面积 / 直角三角形面积
   * 三角形底边 = 拉距跨度，高 = 当前拉力
   */
  energyCoefficient: number | null
}

export type EnergyResult = {
  joules: number
  /** Stored energy ÷ peak draw weight (Lb) */
  joulesPerLb: number
  /** Stored energy ÷ peak draw weight (kgf) */
  joulesPerKg: number
  peakForceLb: number
  peakForceKg: number
  drawLengthCm: number
  drawLengthIn: number
  /** Full-draw 蓄能系数（终点处） */
  energyCoefficient: number | null
  pointCount: number
}
