export type UnitSystem = 'metric' | 'imperial'

/** 1 inch = 2.54 cm */
export const CM_PER_INCH = 2.54
/** 1 lbf ≈ 0.45359237 kgf */
export const KG_PER_LB = 0.45359237

export function lengthLabel(system: UnitSystem): string {
  return system === 'imperial' ? 'in' : 'cm'
}

export function forceLabel(system: UnitSystem): string {
  return system === 'imperial' ? 'Lb' : 'kg'
}

export function perForceEnergyLabel(system: UnitSystem): string {
  return system === 'imperial' ? 'J/Lb' : 'J/kg'
}

export function cmToDisplay(cm: number, system: UnitSystem): number {
  return system === 'imperial' ? cm / CM_PER_INCH : cm
}

export function displayToCm(value: number, system: UnitSystem): number {
  return system === 'imperial' ? value * CM_PER_INCH : value
}

export function lbToDisplay(lb: number, system: UnitSystem): number {
  return system === 'metric' ? lb * KG_PER_LB : lb
}

export function displayToLb(value: number, system: UnitSystem): number {
  return system === 'metric' ? value / KG_PER_LB : value
}

export function roundDisplay(n: number, digits = 2): number {
  const f = 10 ** digits
  return Math.round(n * f) / f
}
