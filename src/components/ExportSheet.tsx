import { ForceChart } from './ForceChart'
import { formatNumber, type CurveMode } from '../lib/energy'
import type { AxisRange, CurveSeries, EnergyResult } from '../lib/types'
import {
  forceLabel,
  lengthLabel,
  perForceEnergyLabel,
  type UnitSystem,
} from '../lib/units'
import './ExportSheet.css'

export type SeriesEnergyRow = {
  id: string
  name: string
  color: string
  energy: EnergyResult | null
}

type Props = {
  series: CurveSeries[]
  rows: SeriesEnergyRow[]
  range: AxisRange
  unitSystem: UnitSystem
  curveMode: CurveMode
  /** Pixel size of the on-screen chart frame — keeps export scaling identical */
  chartSize: { w: number; h: number }
}

/** Dedicated print/export composition — not a screenshot of the live UI. */
export function ExportSheet({
  series,
  rows,
  range,
  unitSystem,
  curveMode,
  chartSize,
}: Props) {
  const n = series.length
  /** 1 条：横排；≥2 条：竖向长图，保证每条测量数据完整入图 */
  const layout: 'side' | 'stack' = n <= 1 ? 'side' : 'stack'
  const lenUnit = lengthLabel(unitSystem)
  const fUnit = forceLabel(unitSystem)
  const perLabel = perForceEnergyLabel(unitSystem)
  const chartW = Math.round(Math.max(320, chartSize.w))
  const chartH = Math.round(Math.max(280, chartSize.h))
  const sheetWidth =
    layout === 'side'
      ? chartW + 340
      : Math.max(chartW + 48, 720)

  return (
    <div
      className={`export-sheet export-sheet--${layout}`}
      data-series-count={n}
      style={{ width: sheetWidth }}
    >
      <header className="export-sheet-head">
        <div>
          <p className="export-sheet-brand">弓箭性能</p>
          <h1>{n >= 2 ? '分析计算工具 · 对比' : '分析计算工具'}</h1>
        </div>
        <div className="export-sheet-meta">
          <span>{unitSystem === 'metric' ? '公制 · cm / kg' : '英制 · in / Lb'}</span>
          <span>{curveMode === 'spline' ? '平滑样条' : '折线'}</span>
          <span>{n} 条曲线</span>
        </div>
      </header>

      <div className="export-sheet-legend">
        {series.map((s) => (
          <span key={s.id} className="export-sheet-legend-item">
            <i style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>

      <div className="export-sheet-chart-wrap">
        <div
          className="export-sheet-chart"
          style={{ width: chartW, height: chartH }}
        >
          <ForceChart
            series={series}
            activeId={null}
            range={range}
            selectedId={null}
            unitSystem={unitSystem}
            curveMode={curveMode}
            editMode={false}
            uniformCurves
            fixedSize={{ w: chartW, h: chartH }}
            onChange={() => {}}
            onSelect={() => {}}
            onSelectSeries={() => {}}
            onRangeChange={() => {}}
          />
        </div>
      </div>

      {n >= 2 && (
        <section className="export-sheet-summary" aria-label="对比摘要">
          <h2>对比摘要</h2>
          <table>
            <thead>
              <tr>
                <th>曲线</th>
                <th>储存能量</th>
                <th>{unitSystem === 'imperial' ? '每磅蓄能' : '每千克蓄能'}</th>
                <th>峰值拉力</th>
                <th>蓄能系数</th>
                <th>做功距离</th>
                <th>测点</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const e = row.energy
                return (
                  <tr key={row.id}>
                    <td>
                      <span className="export-sheet-name">
                        <i style={{ background: row.color }} />
                        {row.name}
                      </span>
                    </td>
                    <td>{e ? `${formatNumber(e.joules)} J` : '—'}</td>
                    <td>
                      {e
                        ? `${formatNumber(
                            unitSystem === 'imperial' ? e.joulesPerLb : e.joulesPerKg,
                          )} ${perLabel}`
                        : '—'}
                    </td>
                    <td>
                      {e
                        ? `${formatNumber(
                            unitSystem === 'imperial' ? e.peakForceLb : e.peakForceKg,
                            1,
                          )} ${fUnit}`
                        : '—'}
                    </td>
                    <td>
                      {e?.energyCoefficient == null
                        ? '—'
                        : formatNumber(e.energyCoefficient, 3)}
                    </td>
                    <td>
                      {e
                        ? `${formatNumber(
                            unitSystem === 'imperial' ? e.drawLengthIn : e.drawLengthCm,
                            1,
                          )} ${lenUnit}`
                        : '—'}
                    </td>
                    <td>{e ? e.pointCount : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}

      <section className="export-sheet-details" aria-label="分项测量">
        <h2>{n >= 2 ? '分项测量' : '测量数据'}</h2>
        <div className={`export-sheet-cards${n >= 3 ? ' cols-2' : n === 2 ? ' cols-2' : ' cols-1'}`}>
          {rows.map((row) => (
            <article
              key={row.id}
              className="export-sheet-card"
              style={{ ['--series-accent' as string]: row.color }}
            >
              <h3>
                <i style={{ background: row.color }} />
                {row.name}
              </h3>
              {row.energy ? (
                <dl>
                  <div className="is-primary">
                    <dt>储存能量</dt>
                    <dd>
                      {formatNumber(row.energy.joules)} <small>J</small>
                    </dd>
                  </div>
                  <div className="is-primary">
                    <dt>{unitSystem === 'imperial' ? '每磅蓄能' : '每千克蓄能'}</dt>
                    <dd>
                      {formatNumber(
                        unitSystem === 'imperial'
                          ? row.energy.joulesPerLb
                          : row.energy.joulesPerKg,
                      )}{' '}
                      <small>{perLabel}</small>
                    </dd>
                  </div>
                  <div>
                    <dt>峰值拉力</dt>
                    <dd>
                      {formatNumber(
                        unitSystem === 'imperial'
                          ? row.energy.peakForceLb
                          : row.energy.peakForceKg,
                        1,
                      )}{' '}
                      <small>{fUnit}</small>
                    </dd>
                  </div>
                  <div>
                    <dt>蓄能系数</dt>
                    <dd>
                      {row.energy.energyCoefficient == null
                        ? '—'
                        : formatNumber(row.energy.energyCoefficient, 3)}
                    </dd>
                  </div>
                  <div>
                    <dt>做功距离</dt>
                    <dd>
                      {formatNumber(
                        unitSystem === 'imperial'
                          ? row.energy.drawLengthIn
                          : row.energy.drawLengthCm,
                        1,
                      )}{' '}
                      <small>{lenUnit}</small>
                    </dd>
                  </div>
                  <div>
                    <dt>测点</dt>
                    <dd>
                      {row.energy.pointCount} <small>个</small>
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="export-sheet-empty">测点不足，无法计算蓄能</p>
              )}
            </article>
          ))}
        </div>
      </section>

      <footer className="export-sheet-foot">
        蓄能系数 = 曲线下面积 ÷（½ × 拉距 × 当前拉力）
      </footer>
    </div>
  )
}
