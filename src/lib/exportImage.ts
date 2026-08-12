import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { toPng } from 'html-to-image'
import {
  ArrowExportSheet,
  type ArrowExportRow,
} from '../components/ArrowExportSheet'
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

export type ArrowExportImageInput = {
  rows: ArrowExportRow[]
  series: CurveSeries[]
  unitSystem: UnitSystem
  curveMode: CurveMode
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function waitForPaint() {
  await new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r())),
  )
}

async function captureNodePng(
  selector: string,
  render: (root: Root) => void,
  filename: string,
  waitMs = 80,
): Promise<void> {
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText =
    'position:fixed;left:-16000px;top:0;width:auto;height:auto;pointer-events:none;z-index:-1;'
  document.body.appendChild(host)

  let root: Root | null = createRoot(host)
  try {
    render(root)
    await document.fonts.ready.catch(() => undefined)
    await waitForPaint()
    await sleep(waitMs)
    await waitForPaint()

    const sheet = host.querySelector(selector) as HTMLElement | null
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

/** Render a dedicated export layout off-screen, capture PNG, then tear down. */
export async function downloadExportPng(
  input: ExportImageInput,
  filename = 'dfc-拉力曲线.png',
): Promise<void> {
  await captureNodePng(
    '.export-sheet',
    (root) => {
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
    },
    filename,
    120,
  )
}

/** Portrait PNG for arrow kinetic energy results. */
export async function downloadArrowExportPng(
  input: ArrowExportImageInput,
  filename = 'dfc-箭动能.png',
): Promise<void> {
  await captureNodePng(
    '.arrow-export-sheet',
    (root) => {
      root.render(
        createElement(ArrowExportSheet, {
          rows: input.rows,
          series: input.series,
          unitSystem: input.unitSystem,
          curveMode: input.curveMode,
        }),
      )
    },
    filename,
    60,
  )
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
