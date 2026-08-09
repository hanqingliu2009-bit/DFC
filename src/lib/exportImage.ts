import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { toPng } from 'html-to-image'
import { ExportSheet, type SeriesEnergyRow } from '../components/ExportSheet'
import type { CurveMode } from './energy'
import type { AxisRange, CurveSeries } from './types'
import type { UnitSystem } from './units'

export type ExportImageInput = {
  series: CurveSeries[]
  rows: SeriesEnergyRow[]
  range: AxisRange
  unitSystem: UnitSystem
  curveMode: CurveMode
  /** Live chart-frame size so export slopes match the browse view */
  chartSize: { w: number; h: number }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function waitForPaint() {
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
}

/** Render a dedicated export layout off-screen, capture PNG, then tear down. */
export async function downloadExportPng(
  input: ExportImageInput,
  filename = 'dfc-拉力曲线.png',
): Promise<void> {
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText =
    'position:fixed;left:-16000px;top:0;width:auto;height:auto;pointer-events:none;z-index:-1;'
  document.body.appendChild(host)

  let root: Root | null = createRoot(host)
  try {
    root.render(
      createElement(ExportSheet, {
        series: input.series,
        rows: input.rows,
        range: input.range,
        unitSystem: input.unitSystem,
        curveMode: input.curveMode,
        chartSize: input.chartSize,
      }),
    )

    await document.fonts.ready.catch(() => undefined)
    await waitForPaint()
    // ForceChart sizes via ResizeObserver — give it a beat
    await sleep(120)
    await waitForPaint()

    const sheet = host.querySelector('.export-sheet') as HTMLElement | null
    if (!sheet) throw new Error('export sheet missing')

    const bg =
      getComputedStyle(document.documentElement).getPropertyValue('--panel').trim() ||
      '#f4f6f8'

    const dataUrl = await toPng(sheet, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: bg,
      width: sheet.scrollWidth,
      height: sheet.scrollHeight,
      style: {
        // ensure full tall layout is captured (no viewport clip)
        transform: 'none',
        margin: '0',
      },
    })

    const a = document.createElement('a')
    a.href = dataUrl
    a.download = filename
    a.click()
  } finally {
    root?.unmount()
    root = null
    host.remove()
  }
}

/** @deprecated prefer downloadExportPng */
export async function downloadElementPng(
  el: HTMLElement,
  filename = 'dfc-拉力曲线.png',
): Promise<void> {
  const dataUrl = await toPng(el, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: getComputedStyle(document.documentElement)
      .getPropertyValue('--panel')
      .trim() || '#f4f6f8',
  })
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}
