/**
 * High-contrast hues for successive curves.
 * Avoid clustering blues/teals/greens that look alike on screen.
 */
export const SERIES_COLORS = [
  '#c45c26', // 橙
  '#2563eb', // 蓝
  '#be185d', // 玫红
  '#171717', // 近黑
  '#ca8a04', // 金黄
  '#7c3aed', // 紫
  '#15803d', // 绿（仅一条）
  '#9a3412', // 赭棕
]

export function nextSeriesColor(usedCount: number): string {
  return SERIES_COLORS[usedCount % SERIES_COLORS.length]
}

/** Strip path / extension for a readable series name. */
export function seriesNameFromFile(filename: string): string {
  const base = filename.replace(/^.*[\\/]/, '').replace(/\.csv$/i, '')
  return base.trim() || '未命名曲线'
}
