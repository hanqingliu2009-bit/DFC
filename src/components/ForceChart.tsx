import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from 'react'
import type { AxisRange, CurveProbe, ForcePoint } from '../lib/types'
import {
  createPoint,
  forceCurveBeziers,
  formatNumber,
  probeCurveAt,
  roundCoord,
  sampleForceCurve,
  sortedPoints,
  type CurveMode,
} from '../lib/energy'
import {
  cmToDisplay,
  displayToCm,
  displayToLb,
  forceLabel,
  lbToDisplay,
  lengthLabel,
  type UnitSystem,
} from '../lib/units'

type Props = {
  points: ForcePoint[]
  range: AxisRange
  selectedId: string | null
  unitSystem: UnitSystem
  curveMode: CurveMode
  onChange: (points: ForcePoint[]) => void
  onSelect: (id: string | null) => void
  onRangeChange: (range: AxisRange) => void
  onProbe?: (probe: CurveProbe | null) => void
}

const PAD = { top: 28, right: 24, bottom: 48, left: 56 }
const DBL_MS = 350
const MIN_X_SPAN_CM = 2
const MIN_Y_SPAN_LB = 2
const ZOOM_STEP = 1.15

export function ForceChart({
  points,
  range,
  selectedId,
  unitSystem,
  curveMode,
  onChange,
  onSelect,
  onRangeChange,
  onProbe,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ w: 800, h: 480 })
  const dragId = useRef<string | null>(null)
  const dragOrigin = useRef<{ x: number; y: number } | null>(null)
  const dragging = useRef(false)
  const panRef = useRef<{
    startX: number
    startY: number
    range: AxisRange
  } | null>(null)
  const lastPointClick = useRef<{ id: string; at: number } | null>(null)
  const pointsRef = useRef(points)
  pointsRef.current = points
  const rangeRef = useRef(range)
  rangeRef.current = range
  const onRangeChangeRef = useRef(onRangeChange)
  onRangeChangeRef.current = onRangeChange
  const onProbeRef = useRef(onProbe)
  onProbeRef.current = onProbe
  const [probe, setProbe] = useState<CurveProbe | null>(null)
  const [isPanning, setIsPanning] = useState(false)

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect
      if (!cr) return
      setSize({ w: Math.max(320, cr.width), h: Math.max(280, cr.height) })
    })
    const preventSelect = (ev: Event) => ev.preventDefault()
    el.addEventListener('selectstart', preventSelect)
    ro.observe(el)
    return () => {
      ro.disconnect()
      el.removeEventListener('selectstart', preventSelect)
      document.body.classList.remove('is-chart-dragging')
    }
  }, [])

  const plotW = size.w - PAD.left - PAD.right
  const plotH = size.h - PAD.top - PAD.bottom
  const xSpan = Math.max(range.xMax - range.xMin, 1e-6)
  const ySpan = Math.max(range.yMax - range.yMin, 1e-6)

  const toPixel = useCallback(
    (xCm: number, yLb: number) => ({
      px: PAD.left + ((xCm - range.xMin) / xSpan) * plotW,
      py: PAD.top + (1 - (yLb - range.yMin) / ySpan) * plotH,
    }),
    [plotW, plotH, range, xSpan, ySpan],
  )

  const toData = useCallback(
    (clientX: number, clientY: number, clamp = true) => {
      const svg = svgRef.current
      const r = rangeRef.current
      const xSp = Math.max(r.xMax - r.xMin, 1e-6)
      const ySp = Math.max(r.yMax - r.yMin, 1e-6)
      if (!svg) return { xCm: 0, yLb: 0 }
      const rect = svg.getBoundingClientRect()
      const px = ((clientX - rect.left) / rect.width) * size.w
      const py = ((clientY - rect.top) / rect.height) * size.h
      let xCm = r.xMin + ((px - PAD.left) / plotW) * xSp
      let yLb = r.yMin + (1 - (py - PAD.top) / plotH) * ySp
      if (clamp) {
        xCm = Math.min(r.xMax, Math.max(r.xMin, xCm))
        yLb = Math.min(r.yMax, Math.max(r.yMin, yLb))
      }
      return {
        xCm: roundCoord(xCm),
        yLb: roundCoord(yLb),
      }
    },
    [size, plotW, plotH],
  )

  useEffect(() => {
    const el = svgRef.current
    if (!el) return

    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault()
      const r = rangeRef.current
      const xSp = Math.max(r.xMax - r.xMin, 1e-6)
      const ySp = Math.max(r.yMax - r.yMin, 1e-6)
      const factor = ev.deltaY > 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      const anchor = toData(ev.clientX, ev.clientY, false)

      let nextXSpan = xSp * factor
      let nextYSpan = ySp * factor
      if (nextXSpan < MIN_X_SPAN_CM) nextXSpan = MIN_X_SPAN_CM
      if (nextYSpan < MIN_Y_SPAN_LB) nextYSpan = MIN_Y_SPAN_LB
      // 限制放得过大
      if (nextXSpan > 5000) nextXSpan = 5000
      if (nextYSpan > 5000) nextYSpan = 5000

      const xRatio = xSp > 0 ? (anchor.xCm - r.xMin) / xSp : 0.5
      const yRatio = ySp > 0 ? (anchor.yLb - r.yMin) / ySp : 0.5
      const xMin = anchor.xCm - xRatio * nextXSpan
      const yMin = anchor.yLb - yRatio * nextYSpan
      onRangeChangeRef.current({
        xMin: roundCoord(xMin, 4),
        xMax: roundCoord(xMin + nextXSpan, 4),
        yMin: roundCoord(yMin, 4),
        yMax: roundCoord(yMin + nextYSpan, 4),
      })
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [toData])

  const sorted = useMemo(() => sortedPoints(points), [points])
  const curveSamples = useMemo(
    () => sampleForceCurve(sorted, curveMode),
    [sorted, curveMode],
  )
  const beziers = useMemo(
    () => (curveMode === 'spline' ? forceCurveBeziers(sorted) : []),
    [sorted, curveMode],
  )
  const x0 = sorted.length ? sorted[0].xCm : 0

  const pathD =
    curveMode === 'spline' && beziers.length > 0
      ? (() => {
          const first = toPixel(beziers[0].x0, beziers[0].y0)
          let d = `M ${first.px} ${first.py}`
          for (const s of beziers) {
            const c1 = toPixel(s.x1, s.y1)
            const c2 = toPixel(s.x2, s.y2)
            const end = toPixel(s.x3, s.y3)
            d += ` C ${c1.px} ${c1.py}, ${c2.px} ${c2.py}, ${end.px} ${end.py}`
          }
          return d
        })()
      : curveSamples.length >= 2
        ? curveSamples
            .map((p, i) => {
              const { px, py } = toPixel(p.xCm, p.yLb)
              return `${i === 0 ? 'M' : 'L'} ${px} ${py}`
            })
            .join(' ')
        : ''

  const linearGhostD =
    curveMode === 'spline' && sorted.length >= 2
      ? sorted
          .map((p, i) => {
            const { px, py } = toPixel(p.xCm, p.yLb)
            return `${i === 0 ? 'M' : 'L'} ${px} ${py}`
          })
          .join(' ')
      : ''

  const areaD =
    curveSamples.length >= 2
      ? (() => {
          const first = toPixel(curveSamples[0].xCm, range.yMin)
          const last = toPixel(curveSamples[curveSamples.length - 1].xCm, range.yMin)
          const curve =
            curveMode === 'spline' && pathD
              ? pathD
              : curveSamples
                  .map((p, i) => {
                    const { px, py } = toPixel(p.xCm, p.yLb)
                    return `${i === 0 ? 'M' : 'L'} ${px} ${py}`
                  })
                  .join(' ')
          return `${curve} L ${last.px} ${last.py} L ${first.px} ${first.py} Z`
        })()
      : ''

  const xTicks = niceTicks(
    cmToDisplay(range.xMin, unitSystem),
    cmToDisplay(range.xMax, unitSystem),
    8,
  ).map((display) => ({
    cm: displayToCm(display, unitSystem),
    label: display,
  }))
  const yTicks = niceTicks(
    lbToDisplay(range.yMin, unitSystem),
    lbToDisplay(range.yMax, unitSystem),
    6,
  ).map((display) => ({
    lb: displayToLb(display, unitSystem),
    label: display,
  }))

  function publishProbe(next: CurveProbe | null) {
    setProbe(next)
    onProbeRef.current?.(next)
  }

  function updateProbeFromX(xCm: number) {
    if (sorted.length < 2) {
      publishProbe(null)
      return
    }
    if (xCm < sorted[0].xCm || xCm > sorted[sorted.length - 1].xCm) {
      publishProbe(null)
      return
    }
    publishProbe(probeCurveAt(sorted, xCm, curveMode))
  }

  function beginInteract(e: ReactPointerEvent) {
    e.preventDefault()
    window.getSelection()?.removeAllRanges()
    document.body.classList.add('is-chart-dragging')
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }

  function endInteract() {
    dragId.current = null
    dragOrigin.current = null
    dragging.current = false
    panRef.current = null
    setIsPanning(false)
    document.body.classList.remove('is-chart-dragging')
  }

  function onPointerDown(e: ReactPointerEvent) {
    const target = e.target as Element
    const pointId =
      target.getAttribute('data-point-id') ??
      target.closest('[data-point-id]')?.getAttribute('data-point-id')

    // 中键 / Alt+左键：平移视图
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      panRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        range: { ...rangeRef.current },
      }
      setIsPanning(true)
      beginInteract(e)
      return
    }

    if (e.button !== 0) return

    if (pointId) {
      const now = performance.now()
      const prev = lastPointClick.current
      if (prev && prev.id === pointId && now - prev.at <= DBL_MS) {
        lastPointClick.current = null
        endInteract()
        onChange(pointsRef.current.filter((p) => p.id !== pointId))
        onSelect(null)
        e.preventDefault()
        return
      }
      lastPointClick.current = { id: pointId, at: now }
      dragId.current = pointId
      dragOrigin.current = { x: e.clientX, y: e.clientY }
      dragging.current = false
      onSelect(pointId)
      beginInteract(e)
      return
    }

    lastPointClick.current = null
    const { xCm, yLb } = toData(e.clientX, e.clientY)
    const r = rangeRef.current
    if (xCm < r.xMin || xCm > r.xMax || yLb < r.yMin || yLb > r.yMax) {
      onSelect(null)
      return
    }
    const p = createPoint(xCm, yLb)
    onChange([...pointsRef.current, p])
    onSelect(p.id)
    dragId.current = p.id
    dragOrigin.current = { x: e.clientX, y: e.clientY }
    dragging.current = false
    beginInteract(e)
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (panRef.current) {
      e.preventDefault()
      window.getSelection()?.removeAllRanges()
      const start = panRef.current
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const xSp = Math.max(start.range.xMax - start.range.xMin, 1e-6)
      const ySp = Math.max(start.range.yMax - start.range.yMin, 1e-6)
      const dxPx = ((e.clientX - start.startX) / rect.width) * size.w
      const dyPx = ((e.clientY - start.startY) / rect.height) * size.h
      const dxCm = -(dxPx / plotW) * xSp
      const dyLb = (dyPx / plotH) * ySp
      onRangeChangeRef.current({
        xMin: roundCoord(start.range.xMin + dxCm, 4),
        xMax: roundCoord(start.range.xMax + dxCm, 4),
        yMin: roundCoord(start.range.yMin + dyLb, 4),
        yMax: roundCoord(start.range.yMax + dyLb, 4),
      })
      return
    }

    const data = toData(e.clientX, e.clientY)
    if (!dragId.current) {
      updateProbeFromX(data.xCm)
    }

    if (!dragId.current) return

    if (dragging.current || dragOrigin.current) {
      e.preventDefault()
      window.getSelection()?.removeAllRanges()
    }

    if (!dragging.current && dragOrigin.current) {
      const dx = e.clientX - dragOrigin.current.x
      const dy = e.clientY - dragOrigin.current.y
      if (dx * dx + dy * dy < 36) return
      dragging.current = true
      lastPointClick.current = null
    }

    onChange(
      pointsRef.current.map((p) =>
        p.id === dragId.current ? { ...p, xCm: data.xCm, yLb: data.yLb } : p,
      ),
    )
  }

  function onPointerUp() {
    endInteract()
  }

  function onPointerLeave() {
    if (!dragId.current) publishProbe(null)
  }

  function onDragStart(e: SyntheticEvent) {
    e.preventDefault()
  }

  const triangle =
    probe && sorted.length >= 2
      ? {
          base0: toPixel(x0, range.yMin),
          base1: toPixel(probe.xCm, range.yMin),
          tip: toPixel(probe.xCm, probe.yLb),
          onCurve: toPixel(probe.xCm, probe.yLb),
        }
      : null

  const tipBox =
    probe && triangle
      ? {
          x: Math.min(triangle.onCurve.px + 12, PAD.left + plotW - 168),
          y: Math.max(PAD.top + 8, triangle.onCurve.py - 64),
        }
      : null

  return (
    <svg
      ref={svgRef}
      className={`force-chart${isPanning ? ' is-panning' : ''}`}
      viewBox={`0 0 ${size.w} ${size.h}`}
      preserveAspectRatio="none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerLeave}
      onDragStart={onDragStart}
      role="img"
      aria-label="拉力曲线图，滚轮缩放，Alt 拖拽或中键平移，点击添加测点"
    >
      <defs>
        <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="var(--grid)" strokeWidth="1" />
        </pattern>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.04" />
        </linearGradient>
      </defs>

      <rect x={0} y={0} width={size.w} height={size.h} fill="var(--chart-bg)" />
      <rect
        x={PAD.left}
        y={PAD.top}
        width={plotW}
        height={plotH}
        fill="url(#grid)"
        opacity={0.55}
      />

      {yTicks.map((t) => {
        const { py } = toPixel(range.xMin, t.lb)
        return (
          <g key={`y-${t.lb}`}>
            <line
              x1={PAD.left}
              y1={py}
              x2={PAD.left + plotW}
              y2={py}
              stroke="var(--grid-strong)"
              strokeWidth={1}
            />
            <text x={PAD.left - 10} y={py + 4} textAnchor="end" className="tick">
              {t.label}
            </text>
          </g>
        )
      })}

      {xTicks.map((t) => {
        const { px } = toPixel(t.cm, range.yMin)
        return (
          <g key={`x-${t.cm}`}>
            <line
              x1={px}
              y1={PAD.top}
              x2={px}
              y2={PAD.top + plotH}
              stroke="var(--grid-strong)"
              strokeWidth={1}
            />
            <text x={px} y={PAD.top + plotH + 22} textAnchor="middle" className="tick">
              {t.label}
            </text>
          </g>
        )
      })}

      <line
        x1={PAD.left}
        y1={PAD.top}
        x2={PAD.left}
        y2={PAD.top + plotH}
        stroke="var(--axis)"
        strokeWidth={1.5}
      />
      <line
        x1={PAD.left}
        y1={PAD.top + plotH}
        x2={PAD.left + plotW}
        y2={PAD.top + plotH}
        stroke="var(--axis)"
        strokeWidth={1.5}
      />

      <text
        x={18}
        y={PAD.top + plotH / 2}
        className="axis-label"
        transform={`rotate(-90 18 ${PAD.top + plotH / 2})`}
        textAnchor="middle"
      >
        拉力 ({forceLabel(unitSystem)})
      </text>
      <text
        x={PAD.left + plotW / 2}
        y={size.h - 10}
        className="axis-label"
        textAnchor="middle"
      >
        拉距 ({lengthLabel(unitSystem)})
      </text>

      {areaD && <path d={areaD} fill="url(#areaFill)" pointerEvents="none" />}
      {linearGhostD && (
        <path
          d={linearGhostD}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          opacity={0.55}
          pointerEvents="none"
        />
      )}
      {pathD && (
        <path
          d={pathD}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          pointerEvents="none"
        />
      )}

      {triangle && (
        <g pointerEvents="none" className="probe-overlay">
          <path
            d={`M ${triangle.base0.px} ${triangle.base0.py} L ${triangle.base1.px} ${triangle.base1.py} L ${triangle.tip.px} ${triangle.tip.py} Z`}
            fill="var(--focus)"
            fillOpacity={0.08}
            stroke="var(--focus)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
          <line
            x1={triangle.onCurve.px}
            y1={PAD.top}
            x2={triangle.onCurve.px}
            y2={PAD.top + plotH}
            stroke="var(--focus)"
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.55}
          />
          <circle
            cx={triangle.onCurve.px}
            cy={triangle.onCurve.py}
            r={6}
            fill="var(--focus)"
            stroke="var(--chart-bg)"
            strokeWidth={2}
          />
        </g>
      )}

      {sorted.map((p) => {
        const { px, py } = toPixel(p.xCm, p.yLb)
        const selected = p.id === selectedId
        return (
          <g key={p.id} data-point-id={p.id} style={{ cursor: 'grab' }}>
            <circle data-point-id={p.id} cx={px} cy={py} r={14} fill="transparent" />
            <circle
              data-point-id={p.id}
              cx={px}
              cy={py}
              r={selected ? 7 : 5.5}
              fill={selected ? 'var(--accent)' : 'var(--chart-bg)'}
              stroke="var(--accent)"
              strokeWidth={2.2}
            />
          </g>
        )
      })}

      {probe && tipBox && (
        <g pointerEvents="none" className="probe-tip">
          <rect
            x={tipBox.x}
            y={tipBox.y}
            width={160}
            height={58}
            rx={4}
            fill="var(--panel)"
            stroke="var(--stroke)"
          />
          <text x={tipBox.x + 10} y={tipBox.y + 18} className="probe-tip-text">
            {formatNumber(cmToDisplay(probe.xCm, unitSystem), 1)} {lengthLabel(unitSystem)} ·{' '}
            {formatNumber(lbToDisplay(probe.yLb, unitSystem), 1)} {forceLabel(unitSystem)}
          </text>
          <text x={tipBox.x + 10} y={tipBox.y + 36} className="probe-tip-text">
            当前蓄能 {formatNumber(probe.joules)} J
          </text>
          <text x={tipBox.x + 10} y={tipBox.y + 52} className="probe-tip-text accent">
            蓄能系数{' '}
            {probe.energyCoefficient == null
              ? '—'
              : formatNumber(probe.energyCoefficient, 3)}
          </text>
        </g>
      )}
    </svg>
  )
}

function niceTicks(min: number, max: number, count: number): number[] {
  const span = max - min
  if (span <= 0) return [min]
  const raw = span / Math.max(count - 1, 1)
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag
  const start = Math.ceil(min / step) * step
  const ticks: number[] = []
  for (let v = start; v <= max + step * 1e-9; v += step) {
    ticks.push(roundCoord(v, 6))
  }
  return ticks
}
