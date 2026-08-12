import { useMemo } from 'react'
import {
  displayDrawToCm,
  drawLabelHint,
  joulesPerForceDisplay,
  kineticEnergyJoules,
  linkArrowKeToBow,
  perForceKeLabel,
  perForceKeUnit,
  type MassUnit,
  type SpeedUnit,
} from '../lib/arrowEnergy'
import { formatNumber, type CurveMode } from '../lib/energy'
import type { CurveSeries } from '../lib/types'
import {
  displayToLb,
  forceLabel,
  lbToDisplay,
  type UnitSystem,
} from '../lib/units'

export type ArrowRow = {
  id: string
  name: string
  mass: string
  massUnit: MassUnit
  speed: string
  speedUnit: SpeedUnit
  /** 可选：测速拉距（显示单位） */
  draw: string
  /** 关联拉力曲线 id；空字符串 = 无 */
  seriesId: string
  /** 测速拉力（显示单位）；无曲线时手填，有曲线+拉距时由曲线覆盖显示 */
  force: string
}

type Props = {
  series: CurveSeries[]
  unitSystem: UnitSystem
  curveMode: CurveMode
  rows: ArrowRow[]
  onRowsChange: (rows: ArrowRow[]) => void
  exporting?: boolean
  onExportImage?: () => void
}

export function createArrowRow(seriesId = ''): ArrowRow {
  return {
    id: crypto.randomUUID(),
    name: '',
    mass: '',
    massUnit: 'grain',
    speed: '',
    speedUnit: 'fps',
    draw: '',
    seriesId,
    force: '',
  }
}

export function ArrowEnergyPanel({
  series,
  unitSystem,
  curveMode,
  rows,
  onRowsChange,
  exporting = false,
  onExportImage,
}: Props) {
  const usableSeries = useMemo(
    () => series.filter((s) => s.points.length >= 2),
    [series],
  )

  function updateRow(id: string, patch: Partial<ArrowRow>) {
    onRowsChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function removeRow(id: string) {
    if (rows.length <= 1) {
      onRowsChange([createArrowRow()])
      return
    }
    onRowsChange(rows.filter((r) => r.id !== id))
  }

  function clearAll() {
    onRowsChange([createArrowRow()])
  }

  const fUnit = forceLabel(unitSystem)
  const drawHint = drawLabelHint(unitSystem)
  const kePerForceLabel = perForceKeLabel(unitSystem)
  const kePerForceUnit = perForceKeUnit(unitSystem)
  const canExport = rows.some((r) => {
    const ke = kineticEnergyJoules(Number(r.mass), r.massUnit, Number(r.speed), r.speedUnit)
    return ke != null
  })

  return (
    <section className="arrow-panel" aria-label="箭动能计算">
      <div className="arrow-panel-head">
        <div>
          <h2>箭动能</h2>
          <p className="arrow-lede">
            输入箭重与箭速计算动能（J）。可选测速拉距；拉力曲线可选「无」并手填测速拉力算每磅/每千克动能。关联曲线时可自动取拉力与蓄能、效率。
          </p>
        </div>
        <div className="arrow-panel-actions">
          <button type="button" className="ghost" onClick={clearAll}>
            清除全部
          </button>
          <button
            type="button"
            className="ghost"
            disabled={exporting || !canExport}
            onClick={() => onExportImage?.()}
          >
            {exporting ? '导出中…' : '导出图片'}
          </button>
          <button
            type="button"
            onClick={() => onRowsChange([...rows, createArrowRow()])}
          >
            添加一支箭
          </button>
        </div>
      </div>

      <p className="arrow-formula">
        E<sub>k</sub> = ½ m v² · 效率 = 箭动能 ÷ 测速拉距下蓄能（仅关联曲线时）
      </p>

      {!usableSeries.length && (
        <p className="arrow-warn">
          当前没有可用拉力曲线。仍可算动能；测速拉力可手填以计算每磅/每千克动能。效率需关联曲线。
        </p>
      )}

      <div className="arrow-list">
        {rows.map((row, index) => {
          const massN = Number(row.mass)
          const speedN = Number(row.speed)
          const ke = kineticEnergyJoules(massN, row.massUnit, speedN, row.speedUnit)
          const drawN = Number(row.draw)
          const linkedSeries = row.seriesId
            ? (usableSeries.find((s) => s.id === row.seriesId) ?? null)
            : null
          const bow =
            ke != null &&
            Number.isFinite(drawN) &&
            drawN > 0 &&
            linkedSeries
              ? linkArrowKeToBow(
                  ke,
                  linkedSeries.points,
                  displayDrawToCm(drawN, unitSystem),
                  curveMode,
                )
              : null

          const forceFromCurve =
            bow != null
              ? String(roundForceDisplay(lbToDisplay(bow.forceLb, unitSystem)))
              : null
          const forceDisplay = forceFromCurve ?? row.force ?? ''
          const forceLinked = forceFromCurve != null
          const forceN = Number(forceDisplay)
          const forceLb =
            Number.isFinite(forceN) && forceN > 0
              ? displayToLb(forceN, unitSystem)
              : null
          const joulesPerLb =
            ke != null && forceLb != null && forceLb > 1e-9 ? ke / forceLb : null

          return (
            <article key={row.id} className="arrow-card">
              <div className="arrow-card-top">
                <span className="arrow-index">#{index + 1}</span>
                <input
                  className="arrow-name"
                  type="text"
                  placeholder="备注（如箭名）"
                  value={row.name}
                  onChange={(e) => updateRow(row.id, { name: e.target.value })}
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="删除"
                  onClick={() => removeRow(row.id)}
                >
                  ×
                </button>
              </div>

              <div className="arrow-fields">
                <label>
                  <span>箭重</span>
                  <div className="arrow-input-row">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={row.mass}
                      onChange={(e) => updateRow(row.id, { mass: e.target.value })}
                      placeholder="质量"
                    />
                    <div className="unit-switch" role="group" aria-label="箭重单位">
                      <button
                        type="button"
                        className={row.massUnit === 'grain' ? 'is-active' : ''}
                        onClick={() => updateRow(row.id, { massUnit: 'grain' })}
                      >
                        grain
                      </button>
                      <button
                        type="button"
                        className={row.massUnit === 'gram' ? 'is-active' : ''}
                        onClick={() => updateRow(row.id, { massUnit: 'gram' })}
                      >
                        g
                      </button>
                    </div>
                  </div>
                </label>

                <label>
                  <span>箭速</span>
                  <div className="arrow-input-row">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={row.speed}
                      onChange={(e) => updateRow(row.id, { speed: e.target.value })}
                      placeholder="速度"
                    />
                    <div className="unit-switch" role="group" aria-label="箭速单位">
                      <button
                        type="button"
                        className={row.speedUnit === 'fps' ? 'is-active' : ''}
                        onClick={() => updateRow(row.id, { speedUnit: 'fps' })}
                      >
                        FPS
                      </button>
                      <button
                        type="button"
                        className={row.speedUnit === 'mps' ? 'is-active' : ''}
                        onClick={() => updateRow(row.id, { speedUnit: 'mps' })}
                      >
                        m/s
                      </button>
                    </div>
                  </div>
                </label>
              </div>

              <div className="arrow-result primary">
                <span className="stat-label">动能</span>
                <span className="stat-value">
                  {ke == null ? '—' : formatNumber(ke, 2)}
                </span>
                <span className="stat-unit">J</span>
              </div>

              <div className="arrow-optional">
                <p className="arrow-optional-title">可选 · 测速参数</p>
                <div className="arrow-fields">
                  <label>
                    <span>{drawHint}</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={row.draw}
                      onChange={(e) => {
                        const nextDraw = e.target.value
                        const patch: Partial<ArrowRow> = { draw: nextDraw }
                        const drawLost =
                          !nextDraw ||
                          !Number.isFinite(Number(nextDraw)) ||
                          Number(nextDraw) <= 0
                        if (forceFromCurve && drawLost) {
                          patch.force = forceFromCurve
                        }
                        updateRow(row.id, patch)
                      }}
                      placeholder="选填"
                    />
                  </label>
                  <label>
                    <span>拉力曲线</span>
                    <select
                      value={row.seriesId}
                      onChange={(e) => {
                        const nextId = e.target.value
                        const patch: Partial<ArrowRow> = { seriesId: nextId }
                        if (!nextId && forceFromCurve) {
                          patch.force = forceFromCurve
                        }
                        updateRow(row.id, patch)
                      }}
                    >
                      <option value="">无</option>
                      {usableSeries.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="arrow-fields">
                  <label>
                    <span>
                      测速拉力 ({fUnit})
                      {forceLinked
                        ? ' · 曲线自动'
                        : !row.seriesId
                          ? ' · 可手动输入'
                          : ''}
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={forceDisplay}
                      readOnly={forceLinked}
                      onChange={(e) => updateRow(row.id, { force: e.target.value })}
                      placeholder={forceLinked ? '由曲线计算' : '手动输入'}
                    />
                  </label>
                  <label>
                    <span>测速拉距下蓄能</span>
                    <input
                      type="text"
                      readOnly
                      value={bow ? `${formatNumber(bow.storedJ, 2)} J` : ''}
                      placeholder="关联曲线后计算"
                    />
                  </label>
                </div>

                <div className="arrow-extra-grid">
                  <div className="arrow-mini">
                    <span className="stat-label">{kePerForceLabel}</span>
                    <span className="stat-value sm">
                      {(() => {
                        const v = joulesPerForceDisplay(joulesPerLb, unitSystem)
                        return v == null ? '—' : formatNumber(v, 3)
                      })()}
                    </span>
                    <span className="stat-unit">{kePerForceUnit}</span>
                  </div>
                  <div className="arrow-mini accent">
                    <span className="stat-label">效率</span>
                    <span className="stat-value sm">
                      {bow?.efficiencyPct == null
                        ? ''
                        : formatNumber(bow.efficiencyPct, 1)}
                    </span>
                    <span className="stat-unit">
                      {bow?.efficiencyPct == null ? '' : '%'}
                    </span>
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function roundForceDisplay(n: number): number {
  return Math.round(n * 100) / 100
}
