import { useMemo, useRef, useState } from 'react'
import { ForceChart } from './components/ForceChart'
import {
  computeEnergy,
  createPoint,
  formatNumber,
  parseCsv,
  pointsToCsv,
  sampleCurve,
  sortedPoints,
} from './lib/energy'
import type { AxisRange, CurveProbe, ForcePoint } from './lib/types'
import {
  cmToDisplay,
  displayToCm,
  displayToLb,
  forceLabel,
  lbToDisplay,
  lengthLabel,
  perForceEnergyLabel,
  roundDisplay,
  type UnitSystem,
} from './lib/units'
import './App.css'

const DEFAULT_RANGE: AxisRange = { xMin: 0, xMax: 100, yMin: 0, yMax: 100 }

function fitRangeToPoints(points: ForcePoint[]): AxisRange {
  if (points.length === 0) return DEFAULT_RANGE
  const xs = points.map((p) => p.xCm)
  const ys = points.map((p) => p.yLb)
  let xMin = Math.min(...xs)
  let xMax = Math.max(...xs)
  let yMin = Math.min(...ys)
  let yMax = Math.max(...ys)
  if (xMax - xMin < 2) {
    const mid = (xMin + xMax) / 2
    xMin = mid - 1
    xMax = mid + 1
  }
  if (yMax - yMin < 2) {
    const mid = (yMin + yMax) / 2
    yMin = Math.max(0, mid - 1)
    yMax = mid + 1
  }
  const xPad = (xMax - xMin) * 0.08
  const yPad = (yMax - yMin) * 0.1
  return {
    xMin: roundDisplay(xMin - xPad, 2),
    xMax: roundDisplay(xMax + xPad, 2),
    yMin: roundDisplay(Math.max(0, yMin - yPad), 2),
    yMax: roundDisplay(yMax + yPad, 2),
  }
}

function zoomRange(range: AxisRange, factor: number): AxisRange {
  const xMid = (range.xMin + range.xMax) / 2
  const yMid = (range.yMin + range.yMax) / 2
  let xSpan = Math.max((range.xMax - range.xMin) * factor, 2)
  let ySpan = Math.max((range.yMax - range.yMin) * factor, 2)
  xSpan = Math.min(xSpan, 5000)
  ySpan = Math.min(ySpan, 5000)
  return {
    xMin: roundDisplay(xMid - xSpan / 2, 4),
    xMax: roundDisplay(xMid + xSpan / 2, 4),
    yMin: roundDisplay(yMid - ySpan / 2, 4),
    yMax: roundDisplay(yMid + ySpan / 2, 4),
  }
}

export default function App() {
  const [points, setPoints] = useState<ForcePoint[]>(() => sampleCurve())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [range, setRange] = useState<AxisRange>(DEFAULT_RANGE)
  const [draftX, setDraftX] = useState('')
  const [draftY, setDraftY] = useState('')
  const [probe, setProbe] = useState<CurveProbe | null>(null)
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric')
  const fileRef = useRef<HTMLInputElement>(null)

  const energy = useMemo(() => computeEnergy(points), [points])
  const sorted = useMemo(() => sortedPoints(points), [points])
  const selected = points.find((p) => p.id === selectedId) ?? null
  const lenUnit = lengthLabel(unitSystem)
  const fUnit = forceLabel(unitSystem)

  function addPoint() {
    const xDisplay = Number(draftX)
    const yDisplay = Number(draftY)
    if (!Number.isFinite(xDisplay) || !Number.isFinite(yDisplay)) return
    const p = createPoint(
      displayToCm(xDisplay, unitSystem),
      displayToLb(yDisplay, unitSystem),
    )
    setPoints((prev) => [...prev, p])
    setSelectedId(p.id)
    setDraftX('')
    setDraftY('')
  }

  function updatePointLength(id: string, value: string) {
    const n = Number(value)
    if (!Number.isFinite(n)) return
    const xCm = displayToCm(n, unitSystem)
    setPoints((prev) => prev.map((p) => (p.id === id ? { ...p, xCm } : p)))
  }

  function updatePointForce(id: string, value: string) {
    const n = Number(value)
    if (!Number.isFinite(n)) return
    const yLb = displayToLb(n, unitSystem)
    setPoints((prev) => prev.map((p) => (p.id === id ? { ...p, yLb } : p)))
  }

  function removePoint(id: string) {
    setPoints((prev) => prev.filter((p) => p.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  function exportCsv() {
    const blob = new Blob([pointsToCsv(points, unitSystem)], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download =
      unitSystem === 'imperial' ? 'draw-force-curve-imperial.csv' : 'draw-force-curve-metric.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function onImportFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const next = parseCsv(text)
      if (next.length) {
        setPoints(next)
        setSelectedId(null)
      }
    }
    reader.readAsText(file)
  }

  function setRangeDisplay(
    key: keyof AxisRange,
    displayValue: number,
  ) {
    if (!Number.isFinite(displayValue)) return
    setRange((r) => {
      if (key === 'xMin' || key === 'xMax') {
        return { ...r, [key]: displayToCm(displayValue, unitSystem) }
      }
      return { ...r, [key]: displayToLb(displayValue, unitSystem) }
    })
  }

  function switchUnitSystem(next: UnitSystem) {
    if (next === unitSystem) return
    setDraftX((v) => {
      const n = Number(v)
      if (!Number.isFinite(n) || v === '') return v
      const cm = displayToCm(n, unitSystem)
      return String(roundDisplay(cmToDisplay(cm, next), 4))
    })
    setDraftY((v) => {
      const n = Number(v)
      if (!Number.isFinite(n) || v === '') return v
      const lb = displayToLb(n, unitSystem)
      return String(roundDisplay(lbToDisplay(lb, next), 4))
    })
    setUnitSystem(next)
  }

  const rangeDisplay = {
    xMin: roundDisplay(cmToDisplay(range.xMin, unitSystem), 4),
    xMax: roundDisplay(cmToDisplay(range.xMax, unitSystem), 4),
    yMin: roundDisplay(lbToDisplay(range.yMin, unitSystem), 4),
    yMax: roundDisplay(lbToDisplay(range.yMax, unitSystem), 4),
  }

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-top">
          <div>
            <p className="brand">DFC</p>
            <h1>拉力曲线</h1>
          </div>
          <div className="unit-switch" role="group" aria-label="单位制">
            <button
              type="button"
              className={unitSystem === 'metric' ? 'is-active' : ''}
              onClick={() => switchUnitSystem('metric')}
            >
              公制
            </button>
            <button
              type="button"
              className={unitSystem === 'imperial' ? 'is-active' : ''}
              onClick={() => switchUnitSystem('imperial')}
            >
              英制
            </button>
          </div>
        </div>
        <p className="lede">
          在图上点击添加测点，拖拽调整位置。曲线下方阴影面积即为蓄能。当前为
          {unitSystem === 'metric' ? '公制（cm / kg）' : '英制（in / Lb）'}。
        </p>
      </header>

      <main className="layout">
        <section className="chart-panel" aria-label="拉力曲线图">
          <div className="chart-toolbar">
            <button type="button" className="ghost" onClick={() => setRange((r) => zoomRange(r, 1 / 1.25))}>
              放大
            </button>
            <button type="button" className="ghost" onClick={() => setRange((r) => zoomRange(r, 1.25))}>
              缩小
            </button>
            <button type="button" className="ghost" onClick={() => setRange(fitRangeToPoints(points))}>
              适应数据
            </button>
            <button type="button" className="ghost" onClick={() => setRange(DEFAULT_RANGE)}>
              复位
            </button>
          </div>
          <div className="chart-frame">
            <ForceChart
              points={points}
              range={range}
              selectedId={selectedId}
              unitSystem={unitSystem}
              onChange={setPoints}
              onSelect={setSelectedId}
              onRangeChange={setRange}
              onProbe={setProbe}
            />
          </div>
          <p className="hint">
            滚轮缩放 · Alt+拖拽或中键平移 · 单击添加 · 拖拽测点 · 双击删除 · 悬停看蓄能系数
          </p>
          {probe && (
            <div className="probe-live" aria-live="polite">
              <span>
                当前位置 {formatNumber(cmToDisplay(probe.xCm, unitSystem), 1)} {lenUnit} /{' '}
                {formatNumber(lbToDisplay(probe.yLb, unitSystem), 1)} {fUnit}
              </span>
              <span>当前蓄能 {formatNumber(probe.joules)} J</span>
              <span>
                蓄能系数{' '}
                {probe.energyCoefficient == null
                  ? '—'
                  : formatNumber(probe.energyCoefficient, 3)}
              </span>
            </div>
          )}
        </section>

        <aside className="side">
          <section className="stats" aria-label="蓄能结果">
            <h2>蓄能</h2>
            {energy ? (
              <div className="stat-grid">
                <div className="stat primary">
                  <span className="stat-label">储存能量</span>
                  <span className="stat-value">{formatNumber(energy.joules)}</span>
                  <span className="stat-unit">J</span>
                </div>
                <div className="stat primary">
                  <span className="stat-label">
                    {unitSystem === 'imperial' ? '每磅蓄能' : '每千克蓄能'}
                  </span>
                  <span className="stat-value">
                    {formatNumber(
                      unitSystem === 'imperial' ? energy.joulesPerLb : energy.joulesPerKg,
                    )}
                  </span>
                  <span className="stat-unit">{perForceEnergyLabel(unitSystem)}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">峰值拉力</span>
                  <span className="stat-value">
                    {formatNumber(
                      unitSystem === 'imperial' ? energy.peakForceLb : energy.peakForceKg,
                      1,
                    )}
                  </span>
                  <span className="stat-unit">{fUnit}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">蓄能系数（满弓）</span>
                  <span className="stat-value">
                    {energy.energyCoefficient == null
                      ? '—'
                      : formatNumber(energy.energyCoefficient, 3)}
                  </span>
                  <span className="stat-unit">比值</span>
                </div>
                <div className="stat">
                  <span className="stat-label">做功距离</span>
                  <span className="stat-value">
                    {formatNumber(
                      unitSystem === 'imperial' ? energy.drawLengthIn : energy.drawLengthCm,
                      1,
                    )}
                  </span>
                  <span className="stat-unit">{lenUnit}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">测点</span>
                  <span className="stat-value">{energy.pointCount}</span>
                  <span className="stat-unit">个</span>
                </div>
              </div>
            ) : (
              <p className="empty-energy">至少需要 2 个测点才能计算蓄能。</p>
            )}
            <p className="formula">
              蓄能系数 = 曲线下面积 ÷（½ × 拉距 × 当前拉力）；能量始终按物理量计算（J）
            </p>
          </section>

          <section className="controls" aria-label="操作">
            <h2>操作</h2>
            <div className="btn-row">
              <button type="button" onClick={() => setPoints(sampleCurve())}>
                示例曲线
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setPoints([])
                  setSelectedId(null)
                }}
              >
                清空
              </button>
              <button type="button" className="ghost" onClick={exportCsv} disabled={!points.length}>
                导出 CSV
              </button>
              <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>
                导入 CSV
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onImportFile(f)
                  e.target.value = ''
                }}
              />
            </div>

            <div className="range-grid">
              {(
                [
                  ['xMin', `X 最小 (${lenUnit})`],
                  ['xMax', `X 最大 (${lenUnit})`],
                  ['yMin', `Y 最小 (${fUnit})`],
                  ['yMax', `Y 最大 (${fUnit})`],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  <span>{label}</span>
                  <input
                    type="number"
                    value={rangeDisplay[key]}
                    onChange={(e) => setRangeDisplay(key, Number(e.target.value))}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="table-section" aria-label="测点数据">
            <h2>测点</h2>
            <div className="add-row">
              <input
                type="number"
                placeholder={`拉距 ${lenUnit}`}
                value={draftX}
                onChange={(e) => setDraftX(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPoint()}
              />
              <input
                type="number"
                placeholder={`拉力 ${fUnit}`}
                value={draftY}
                onChange={(e) => setDraftY(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPoint()}
              />
              <button type="button" onClick={addPoint}>
                添加
              </button>
            </div>

            {selected && (
              <p className="selected-note">
                已选：{formatNumber(cmToDisplay(selected.xCm, unitSystem), 2)} {lenUnit} /{' '}
                {formatNumber(lbToDisplay(selected.yLb, unitSystem), 2)} {fUnit}
              </p>
            )}

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>拉距 ({lenUnit})</th>
                    <th>拉力 ({fUnit})</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p, i) => (
                    <tr
                      key={p.id}
                      className={p.id === selectedId ? 'is-selected' : undefined}
                      onClick={() => setSelectedId(p.id)}
                    >
                      <td>{i + 1}</td>
                      <td>
                        <input
                          type="number"
                          step="0.1"
                          value={roundDisplay(cmToDisplay(p.xCm, unitSystem), 4)}
                          onChange={(e) => updatePointLength(p.id, e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.1"
                          value={roundDisplay(lbToDisplay(p.yLb, unitSystem), 4)}
                          onChange={(e) => updatePointForce(p.id, e.target.value)}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label="删除测点"
                          onClick={(e) => {
                            e.stopPropagation()
                            removePoint(p.id)
                          }}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </aside>
      </main>
    </div>
  )
}
