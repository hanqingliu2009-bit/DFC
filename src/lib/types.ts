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

export type EnergyResult = {
  joules: number
  footPounds: number
  /** Stored energy ÷ peak draw weight */
  joulesPerLb: number
  footPoundsPerLb: number
  peakForceLb: number
  drawLengthCm: number
  averageForceLb: number
  pointCount: number
}
