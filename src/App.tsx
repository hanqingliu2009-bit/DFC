import { useMemo, useRef, useState } from 'react'
import { ForceChart } from './components/ForceChart'
import { nextSeriesColor, seriesNameFromFile } from './lib/compare'
import {
  computeEnergy,
  createPoint,
  formatNumber,
  parseCsv,
  pointsToCsv,
  sampleCurve,
  sortedPoints,
  type CurveMode,
} from './lib/energy'
import { downloadExportPng } from './lib/exportImage'
import type { AxisRange, CurveProbe, CurveSeries, EnergyResult, ForcePoint } from './lib/types'
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

function makeSeries(name: string, points: ForcePoint[], colorIndex: number): CurveSeries {
  return {
    id: crypto.randomUUID(),
    name,
    color: nextSeriesColor(colorIndex),
    points,
  }
}

function initialSeries(): CurveSeries[] {
  return [makeSeries('示例曲线', sampleCurve(), 0)]
}

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
  const xPad = (xMax - xMin) * 0.005
  const yPad = Math.max((yMax - yMin) * 0.1, 1.5)
  return {
    xMin: roundDisplay(xMin - xPad, 2),
    xMax: roundDisplay(xMax + xPad, 2),
    yMin: roundDisplay(Math.max(0, yMin - yPad * 0.25), 2),
    yMax: roundDisplay(yMax + yPad * 0.75, 2),
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

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsText(file)
  })
}

function allPointsOf(list: CurveSeries[]): ForcePoint[] {
  return list.flatMap((s) => s.points)
}

function EnergyStats({
  energy,
  unitSystem,
  title,
  accentColor,
  compact,
  active,
  onSelect,
}: {
  energy: EnergyResult | null
  unitSystem: UnitSystem
  title?: string
  accentColor?: string
  compact?: boolean
  active?: boolean
  onSelect?: () => void
}) {
  const lenUnit = lengthLabel(unitSystem)
  const fUnit = forceLabel(unitSystem)
  return (
    <section
      className={`stats${compact ? ' is-compact' : ''}${active ? ' is-active-series' : ''}${onSelect ? ' is-clickable' : ''}`}
      aria-label={title ?? '蓄能结果'}
      style={accentColor ? { ['--series-accent' as string]: accentColor } : undefined}
      onClick={onSelect}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect()
              }
            }
          : undefined
      }
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      <h2>
        {accentColor && <span className="series-swatch" style={{ background: accentColor }} />}
        {title ?? '蓄能'}
        {active && <span className="active-tag">当前</span>}
      </h2>
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
      {!compact && (
        <p className="formula">
          蓄能系数 = 曲线下面积 ÷（½ × 拉距 × 当前拉力）；曲线为局部平滑样条加密采样后积分
        </p>
      )}
    </section>
  )
}

export default function App() {
  const boot = useMemo(() => initialSeries(), [])
  const [series, setSeries] = useState<CurveSeries[]>(boot)
  const [activeId, setActiveId] = useState<string | null>(boot[0]?.id ?? null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [range, setRange] = useState<AxisRange>(() =>
    fitRangeToPoints(allPointsOf(boot)),
  )
  const [draftX, setDraftX] = useState('')
  const [draftY, setDraftY] = useState('')
  const [probe, setProbe] = useState<CurveProbe | null>(null)
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric')
  const [curveMode, setCurveMode] = useState<CurveMode>('spline')
  const [editMode, setEditMode] = useState(false)
  const [exporting, setExporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const chartFrameRef = useRef<HTMLDivElement>(null)

  const active = series.find((s) => s.id === activeId) ?? null
  const points = active?.points ?? []
  const energy = useMemo(() => computeEnergy(points, curveMode), [points, curveMode])
  const seriesEnergies = useMemo(
    () =>
      series.map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        energy: computeEnergy(s.points, curveMode),
        active: s.id === activeId,
      })),
    [series, activeId, curveMode],
  )
  const sorted = useMemo(() => sortedPoints(points), [points])
  const selected = points.find((p) => p.id === selectedId) ?? null
  const lenUnit = lengthLabel(unitSystem)
  const fUnit = forceLabel(unitSystem)

  function fitAll(list: CurveSeries[]) {
    const all = allPointsOf(list)
    setRange(fitRangeToPoints(all))
  }

  function setActivePoints(nextPoints: ForcePoint[]) {
    if (!activeId) return
    setSeries((prev) =>
      prev.map((s) => (s.id === activeId ? { ...s, points: nextPoints } : s)),
    )
  }

  function selectSeries(id: string) {
    if (id === activeId) return
    setActiveId(id)
    setSelectedId(null)
    setProbe(null)
  }

  function addPoint() {
    if (!activeId) return
    const xDisplay = Number(draftX)
    const yDisplay = Number(draftY)
    if (!Number.isFinite(xDisplay) || !Number.isFinite(yDisplay)) return
    const p = createPoint(
      displayToCm(xDisplay, unitSystem),
      displayToLb(yDisplay, unitSystem),
    )
    setActivePoints([...points, p])
    setSelectedId(p.id)
    setDraftX('')
    setDraftY('')
  }

  function updatePointLength(id: string, value: string) {
    const n = Number(value)
    if (!Number.isFinite(n)) return
    const xCm = displayToCm(n, unitSystem)
    setActivePoints(points.map((p) => (p.id === id ? { ...p, xCm } : p)))
  }

  function updatePointForce(id: string, value: string) {
    const n = Number(value)
    if (!Number.isFinite(n)) return
    const yLb = displayToLb(n, unitSystem)
    setActivePoints(points.map((p) => (p.id === id ? { ...p, yLb } : p)))
  }

  function removePoint(id: string) {
    setActivePoints(points.filter((p) => p.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  function exportCsv() {
    if (!active) return
    const blob = new Blob([pointsToCsv(points, unitSystem)], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const safe = active.name.replace(/[\\/:*?"<>|]+/g, '_')
    a.download =
      unitSystem === 'imperial' ? `${safe}-imperial.csv` : `${safe}-metric.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function exportImage() {
    if (exporting || !series.length) return
    setExporting(true)
    setProbe(null)
    try {
      const frame = chartFrameRef.current
      const rect = frame?.getBoundingClientRect()
      const chartSize = {
        w: Math.round(rect?.width || frame?.clientWidth || 720),
        h: Math.round(rect?.height || frame?.clientHeight || 480),
      }
      await downloadExportPng(
        {
          series,
          rows: seriesEnergies.map(({ id, name, color, energy }) => ({
            id,
            name,
            color,
            energy,
          })),
          range,
          unitSystem,
          curveMode,
          chartSize,
        },
        `dfc-拉力曲线-${new Date().toISOString().slice(0, 10)}.png`,
      )
    } catch (err) {
      console.error(err)
      window.alert('导出图片失败，请重试。')
    } finally {
      setExporting(false)
    }
  }

  /** 导入始终叠加；曲线名 = 文件名；最后导入的成为当前曲线 */
  async function onImportFiles(files: FileList | File[]) {
    const list = Array.from(files)
    if (!list.length) return
    const added: CurveSeries[] = []
    let colorIndex = series.length
    for (const file of list) {
      const text = await readFileAsText(file)
      const pts = parseCsv(text)
      if (!pts.length) continue
      added.push(makeSeries(seriesNameFromFile(file.name), pts, colorIndex++))
    }
    if (!added.length) {
      window.alert('所选文件中没有可解析的测点。')
      return
    }
    const next = [...series, ...added]
    setSeries(next)
    setActiveId(added[added.length - 1].id)
    setSelectedId(null)
    fitAll(next)
  }

  function removeSeries(id: string) {
    const next = series.filter((s) => s.id !== id)
    setSeries(next)
    if (activeId === id) {
      setActiveId(next[next.length - 1]?.id ?? null)
      setSelectedId(null)
    }
    fitAll(next)
  }

  function setRangeDisplay(key: keyof AxisRange, displayValue: number) {
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

  const activeEnergyBlock = seriesEnergies.find((s) => s.active)
  const otherEnergyBlocks = seriesEnergies.filter((s) => !s.active)

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
          导入 CSV 会按文件名添加曲线；再次导入叠加到同一张图。双击曲线可切换当前编辑对象。当前为
          {unitSystem === 'metric' ? '公制（cm / kg）' : '英制（in / Lb）'}。
        </p>
      </header>

      <main className="layout">
        <section className="chart-panel" aria-label="拉力曲线图">
          <div className="chart-toolbar">
            <div className="unit-switch curve-switch" role="group" aria-label="交互模式">
              <button
                type="button"
                className={!editMode ? 'is-active' : ''}
                onClick={() => setEditMode(false)}
              >
                浏览
              </button>
              <button
                type="button"
                className={editMode ? 'is-active' : ''}
                onClick={() => setEditMode(true)}
              >
                编辑测点
              </button>
            </div>
            <div className="unit-switch curve-switch" role="group" aria-label="曲线模式">
              <button
                type="button"
                className={curveMode === 'linear' ? 'is-active' : ''}
                onClick={() => setCurveMode('linear')}
              >
                折线
              </button>
              <button
                type="button"
                className={curveMode === 'spline' ? 'is-active' : ''}
                onClick={() => setCurveMode('spline')}
              >
                平滑样条
              </button>
            </div>
            <button type="button" className="ghost" onClick={() => setRange((r) => zoomRange(r, 1 / 1.25))}>
              放大
            </button>
            <button type="button" className="ghost" onClick={() => setRange((r) => zoomRange(r, 1.25))}>
              缩小
            </button>
            <button type="button" className="ghost" onClick={() => fitAll(series)}>
              适应数据
            </button>
            <button type="button" className="ghost" onClick={() => setRange(DEFAULT_RANGE)}>
              复位
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => void exportImage()}
              disabled={exporting || !series.length}
            >
              {exporting ? '导出中…' : '导出图片'}
            </button>
          </div>

          <div className="export-bundle">
            <div className="export-head">
              <span className="export-brand">DFC 拉力曲线</span>
              <span className="export-meta">
                {unitSystem === 'metric' ? '公制 cm / kg' : '英制 in / Lb'}
                {' · '}
                {curveMode === 'spline' ? '平滑样条' : '折线'}
                {active ? ` · 当前：${active.name}` : ''}
              </span>
            </div>
            <div className="export-body">
              <div className="chart-frame" ref={chartFrameRef}>
                <ForceChart
                  series={series}
                  activeId={activeId}
                  range={range}
                  selectedId={selectedId}
                  unitSystem={unitSystem}
                  curveMode={curveMode}
                  editMode={editMode}
                  onChange={setActivePoints}
                  onSelect={setSelectedId}
                  onSelectSeries={selectSeries}
                  onRangeChange={setRange}
                  onProbe={setProbe}
                />
              </div>
              <div className="export-stats">
                {activeEnergyBlock && (
                  <EnergyStats
                    energy={activeEnergyBlock.energy}
                    unitSystem={unitSystem}
                    title={activeEnergyBlock.name}
                    accentColor={activeEnergyBlock.color}
                    active
                  />
                )}
                {otherEnergyBlocks.map((s) => (
                  <EnergyStats
                    key={s.id}
                    energy={s.energy}
                    unitSystem={unitSystem}
                    title={s.name}
                    accentColor={s.color}
                    compact
                    onSelect={() => selectSeries(s.id)}
                  />
                ))}
                {!series.length && (
                  <EnergyStats energy={energy} unitSystem={unitSystem} title="蓄能" />
                )}
              </div>
            </div>
            {series.length > 0 && (
              <div className="curve-legend" aria-label="图例">
                {series.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`legend-item${s.id === activeId ? ' is-active' : ''}`}
                    onClick={() => selectSeries(s.id)}
                    title="点击切换为当前曲线"
                  >
                    <i style={{ background: s.color }} />
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="hint">
            双击曲线（或图例）切换当前曲线
            {' · '}
            {editMode
              ? '编辑：单击添加 · 拖拽测点 · 双击测点删除 · Alt/中键平移'
              : '浏览：拖拽平移 · 滚轮缩放'}
            {' · '}
            加粗高亮为当前可编辑曲线
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
          <section className="controls" aria-label="操作">
            <h2>操作</h2>
            <div className="btn-row">
              <button
                type="button"
                onClick={() => {
                  const s = makeSeries('示例曲线', sampleCurve(), series.length)
                  const next = [...series, s]
                  setSeries(next)
                  setActiveId(s.id)
                  setSelectedId(null)
                  fitAll(next)
                }}
              >
                添加示例
              </button>
              <button
                type="button"
                className="ghost"
                disabled={!activeId}
                onClick={() => {
                  if (activeId) removeSeries(activeId)
                }}
              >
                移除当前
              </button>
              <button type="button" className="ghost" onClick={exportCsv} disabled={!points.length}>
                导出 CSV
              </button>
              <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>
                导入 CSV
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => void exportImage()}
                disabled={exporting || !series.length}
              >
                {exporting ? '导出中…' : '导出图片'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files?.length) void onImportFiles(e.target.files)
                  e.target.value = ''
                }}
              />
            </div>
            <p className="import-hint">
              导入按文件名命名并叠加到图上（可多选）；双击图上曲线即可切换当前编辑对象。
            </p>

            {series.length > 0 && (
              <div className="compare-list">
                <div className="compare-list-head">
                  <span>曲线列表 ({series.length})</span>
                  <button
                    type="button"
                    className="ghost linkish"
                    onClick={() => {
                      setSeries([])
                      setActiveId(null)
                      setSelectedId(null)
                      setRange(DEFAULT_RANGE)
                    }}
                  >
                    全部清除
                  </button>
                </div>
                <ul>
                  {series.map((s) => (
                    <li
                      key={s.id}
                      className={s.id === activeId ? 'is-active' : undefined}
                      onClick={() => selectSeries(s.id)}
                    >
                      <span className="series-swatch" style={{ background: s.color }} />
                      <span className="compare-name" title={s.name}>
                        {s.name}
                        {s.id === activeId ? ' · 当前' : ''}
                      </span>
                      <span className="compare-count">{s.points.length} 点</span>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`移除 ${s.name}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          removeSeries(s.id)
                        }}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

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
            <h2>测点{active ? ` · ${active.name}` : ''}</h2>
            <div className="add-row">
              <input
                type="number"
                placeholder={`拉距 ${lenUnit}`}
                value={draftX}
                onChange={(e) => setDraftX(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPoint()}
                disabled={!activeId}
              />
              <input
                type="number"
                placeholder={`拉力 ${fUnit}`}
                value={draftY}
                onChange={(e) => setDraftY(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPoint()}
                disabled={!activeId}
              />
              <button type="button" onClick={addPoint} disabled={!activeId}>
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
