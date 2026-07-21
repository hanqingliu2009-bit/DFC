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
import type { AxisRange, ForcePoint } from './lib/types'
import './App.css'

const DEFAULT_RANGE: AxisRange = { xMin: 0, xMax: 100, yMin: 0, yMax: 100 }

export default function App() {
  const [points, setPoints] = useState<ForcePoint[]>(() => sampleCurve())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [range, setRange] = useState<AxisRange>(DEFAULT_RANGE)
  const [draftX, setDraftX] = useState('')
  const [draftY, setDraftY] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const energy = useMemo(() => computeEnergy(points), [points])
  const sorted = useMemo(() => sortedPoints(points), [points])
  const selected = points.find((p) => p.id === selectedId) ?? null

  function addPoint() {
    const xCm = Number(draftX)
    const yLb = Number(draftY)
    if (!Number.isFinite(xCm) || !Number.isFinite(yLb)) return
    const p = createPoint(xCm, yLb)
    setPoints((prev) => [...prev, p])
    setSelectedId(p.id)
    setDraftX('')
    setDraftY('')
  }

  function updatePoint(id: string, field: 'xCm' | 'yLb', value: string) {
    const n = Number(value)
    if (!Number.isFinite(n)) return
    setPoints((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: n } : p)))
  }

  function removePoint(id: string) {
    setPoints((prev) => prev.filter((p) => p.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  function exportCsv() {
    const blob = new Blob([pointsToCsv(points)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'draw-force-curve.csv'
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

  return (
    <div className="app">
      <header className="hero">
        <p className="brand">DFC</p>
        <h1>拉力曲线</h1>
        <p className="lede">
          在图上点击添加测点，拖拽调整位置。曲线下方阴影面积即为蓄能。
        </p>
      </header>

      <main className="layout">
        <section className="chart-panel" aria-label="拉力曲线图">
          <div className="chart-frame">
            <ForceChart
              points={points}
              range={range}
              selectedId={selectedId}
              onChange={setPoints}
              onSelect={setSelectedId}
            />
          </div>
          <p className="hint">单击添加 · 拖拽移动 · 双击删除测点</p>
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
                  <span className="stat-label">每磅蓄能</span>
                  <span className="stat-value">{formatNumber(energy.joulesPerLb)}</span>
                  <span className="stat-unit">J/Lb</span>
                </div>
                <div className="stat">
                  <span className="stat-label">英制蓄能</span>
                  <span className="stat-value">{formatNumber(energy.footPounds)}</span>
                  <span className="stat-unit">ft·lb</span>
                </div>
                <div className="stat">
                  <span className="stat-label">每磅（英制）</span>
                  <span className="stat-value">{formatNumber(energy.footPoundsPerLb)}</span>
                  <span className="stat-unit">ft·lb/Lb</span>
                </div>
                <div className="stat">
                  <span className="stat-label">峰值拉力</span>
                  <span className="stat-value">{formatNumber(energy.peakForceLb, 1)}</span>
                  <span className="stat-unit">Lb</span>
                </div>
                <div className="stat">
                  <span className="stat-label">平均拉力</span>
                  <span className="stat-value">{formatNumber(energy.averageForceLb, 1)}</span>
                  <span className="stat-unit">Lb</span>
                </div>
                <div className="stat">
                  <span className="stat-label">做功距离</span>
                  <span className="stat-value">{formatNumber(energy.drawLengthCm, 1)}</span>
                  <span className="stat-unit">cm</span>
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
              E = ∫ F dx（梯形积分）· 每磅蓄能 = E ÷ 峰值拉力 · 1 Lb·cm ≈ 0.0445 J
              
            </p>
          </section>

          <section className="controls" aria-label="操作">
            <h2>操作</h2>
            <div className="btn-row">
              <button type="button" onClick={() => setPoints(sampleCurve())}>
                示例曲线
              </button>
              <button type="button" className="ghost" onClick={() => { setPoints([]); setSelectedId(null) }}>
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
                  ['xMin', 'X 最小 (cm)'],
                  ['xMax', 'X 最大 (cm)'],
                  ['yMin', 'Y 最小 (Lb)'],
                  ['yMax', 'Y 最大 (Lb)'],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  <span>{label}</span>
                  <input
                    type="number"
                    value={range[key]}
                    onChange={(e) =>
                      setRange((r) => ({ ...r, [key]: Number(e.target.value) }))
                    }
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
                placeholder="拉距 cm"
                value={draftX}
                onChange={(e) => setDraftX(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPoint()}
              />
              <input
                type="number"
                placeholder="拉力 Lb"
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
                已选：{selected.xCm} cm / {selected.yLb} Lb
              </p>
            )}

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>拉距 (cm)</th>
                    <th>拉力 (Lb)</th>
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
                          value={p.xCm}
                          onChange={(e) => updatePoint(p.id, 'xCm', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.1"
                          value={p.yLb}
                          onChange={(e) => updatePoint(p.id, 'yLb', e.target.value)}
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
