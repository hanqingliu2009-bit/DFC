import {
  displayDrawToCm,
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
  lengthLabel,
  lbToDisplay,
  type UnitSystem,
} from '../lib/units'
import './ArrowExportSheet.css'

export type ArrowExportRow = {
  id: string
  name: string
  mass: string
  massUnit: MassUnit
  speed: string
  speedUnit: SpeedUnit
  draw: string
  seriesId: string
  force: string
}

type Props = {
  rows: ArrowExportRow[]
  series: CurveSeries[]
  unitSystem: UnitSystem
  curveMode: CurveMode
}

function massUnitLabel(u: MassUnit) {
  return u === 'grain' ? 'grain' : 'g'
}

function speedUnitLabel(u: SpeedUnit) {
  return u === 'fps' ? 'FPS' : 'm/s'
}

/** Portrait export sheet for arrow kinetic energy results. */
export function ArrowExportSheet({ rows, series, unitSystem, curveMode }: Props) {
  const usable = series.filter((s) => s.points.length >= 2)
  const fUnit = forceLabel(unitSystem)
  const lenUnit = lengthLabel(unitSystem)
  const kePerLabel = perForceKeLabel(unitSystem)
  const kePerUnit = perForceKeUnit(unitSystem)
  const computed = rows.map((row, index) => {
    const massN = Number(row.mass)
    const speedN = Number(row.speed)
    const ke = kineticEnergyJoules(massN, row.massUnit, speedN, row.speedUnit)
    const drawN = Number(row.draw)
    const linkedSeries = row.seriesId
      ? (usable.find((s) => s.id === row.seriesId) ?? null)
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

    const forceDisplay =
      bow != null
        ? lbToDisplay(bow.forceLb, unitSystem)
        : (() => {
            const n = Number(row.force)
            return Number.isFinite(n) && n > 0 ? n : null
          })()
    const forceLb =
      bow != null
        ? bow.forceLb
        : forceDisplay != null
          ? displayToLb(forceDisplay, unitSystem)
          : null
    const joulesPerLb =
      ke != null && forceLb != null && forceLb > 1e-9 ? ke / forceLb : null

    const hasOptional =
      Boolean(row.draw) || Boolean(row.force) || Boolean(row.seriesId) || forceDisplay != null

    return {
      index,
      title: row.name.trim() || `箭 #${index + 1}`,
      mass: row.mass,
      massUnit: row.massUnit,
      speed: row.speed,
      speedUnit: row.speedUnit,
      draw: row.draw,
      curveName: linkedSeries?.name ?? (row.seriesId ? '—' : '无'),
      ke,
      bow,
      forceDisplay,
      joulesPerLb,
      hasOptional,
    }
  })

  return (
    <div className="arrow-export-sheet">
      <header className="arrow-export-head">
        <div>
          <p className="arrow-export-brand">弓箭性能</p>
          <h1>箭动能分析</h1>
        </div>
        <div className="arrow-export-meta">
          <span>{unitSystem === 'metric' ? '公制' : '英制'}</span>
          <span>{computed.length} 支箭</span>
        </div>
      </header>

      <section className="arrow-export-summary">
        <h2>汇总</h2>
        <table>
          <thead>
            <tr>
              <th>箭</th>
              <th>箭重</th>
              <th>箭速</th>
              <th>动能</th>
              <th>拉距</th>
              <th>{kePerUnit}</th>
              <th>效率</th>
            </tr>
          </thead>
          <tbody>
            {computed.map((c) => (
              <tr key={c.index}>
                <td>{c.title}</td>
                <td>
                  {c.mass
                    ? `${c.mass} ${massUnitLabel(c.massUnit)}`
                    : '—'}
                </td>
                <td>
                  {c.speed
                    ? `${c.speed} ${speedUnitLabel(c.speedUnit)}`
                    : '—'}
                </td>
                <td>{c.ke == null ? '—' : `${formatNumber(c.ke, 2)} J`}</td>
                <td>
                  {c.draw ? `${c.draw} ${lenUnit}` : '—'}
                </td>
                <td>
                  {(() => {
                    const v = joulesPerForceDisplay(c.joulesPerLb, unitSystem)
                    return v == null ? '—' : formatNumber(v, 3)
                  })()}
                </td>
                <td>
                  {c.bow?.efficiencyPct == null
                    ? ''
                    : `${formatNumber(c.bow.efficiencyPct, 1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="arrow-export-details">
        <h2>分项</h2>
        {computed.map((c) => (
          <article key={c.index} className="arrow-export-card">
            <h3>
              #{c.index + 1} · {c.title}
            </h3>
            <dl>
              <div>
                <dt>箭重</dt>
                <dd>
                  {c.mass
                    ? `${c.mass} ${massUnitLabel(c.massUnit)}`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>箭速</dt>
                <dd>
                  {c.speed
                    ? `${c.speed} ${speedUnitLabel(c.speedUnit)}`
                    : '—'}
                </dd>
              </div>
              <div className="is-primary">
                <dt>动能</dt>
                <dd>
                  {c.ke == null ? '—' : formatNumber(c.ke, 2)} <small>J</small>
                </dd>
              </div>
              {c.hasOptional && (
                <>
                  <div>
                    <dt>测速拉距</dt>
                    <dd>
                      {c.draw ? (
                        <>
                          {c.draw} <small>{lenUnit}</small>
                        </>
                      ) : (
                        ''
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>关联曲线</dt>
                    <dd>{c.curveName}</dd>
                  </div>
                  <div>
                    <dt>测速拉力</dt>
                    <dd>
                      {c.forceDisplay == null
                        ? ''
                        : formatNumber(c.forceDisplay, 1)}{' '}
                      {c.forceDisplay != null && <small>{fUnit}</small>}
                    </dd>
                  </div>
                  <div>
                    <dt>测速拉距下蓄能</dt>
                    <dd>
                      {c.bow ? (
                        <>
                          {formatNumber(c.bow.storedJ, 2)} <small>J</small>
                        </>
                      ) : (
                        ''
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{kePerLabel}</dt>
                    <dd>
                      {(() => {
                        const v = joulesPerForceDisplay(c.joulesPerLb, unitSystem)
                        return v == null ? '—' : formatNumber(v, 3)
                      })()}{' '}
                      <small>{kePerUnit}</small>
                    </dd>
                  </div>
                  <div className="is-accent">
                    <dt>效率</dt>
                    <dd>
                      {c.bow?.efficiencyPct == null ? (
                        ''
                      ) : (
                        <>
                          {formatNumber(c.bow.efficiencyPct, 1)} <small>%</small>
                        </>
                      )}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </article>
        ))}
      </section>

      <footer className="arrow-export-foot">
        E<sub>k</sub> = ½ m v² · 效率 = 箭动能 ÷ 测速拉距下蓄能 × 100%（仅关联曲线时）
      </footer>
    </div>
  )
}
