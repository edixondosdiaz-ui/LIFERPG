import { useId } from 'react'

const GRID = 'rgba(255,255,255,.07)'

// Barras (una o varias series). data: [{ label, value } | { label, values: [a, b] }]
export function BarChart({ data, colors = ['#a855f7'], height = 112, goal, format = (v) => v, labelEvery = 1, empty = 'Aún no hay datos.' }) {
  const rows = data.map((d) => ({ ...d, values: d.values ?? [d.value ?? 0] }))
  const max = Math.max(goal ?? 0, ...rows.flatMap((r) => r.values), 1)
  if (!rows.some((r) => r.values.some((v) => v > 0))) {
    return <p className="rounded-2xl border border-dashed border-line px-3 py-4 text-center text-xs text-sub">{empty}</p>
  }
  return (
    <div>
      <div className="relative flex items-end gap-1" style={{ height }}>
        {goal ? <i className="pointer-events-none absolute inset-x-0 border-t border-dashed border-white/25" style={{ bottom: `${(goal / max) * 100}%` }} /> : null}
        {rows.map((r, i) => (
          <div key={i} className="flex h-full min-w-0 flex-1 items-end justify-center gap-[2px]"
            title={`${r.label}: ${r.values.map((v) => format(v)).join(' · ')}`}>
            {r.values.map((v, k) => (
              <div key={k} className="w-full max-w-[22px] rounded-t-md transition-all duration-500"
                style={{ height: `${v > 0 ? Math.max(4, (v / max) * 100) : 0}%`, background: r.active && k === 0 ? colors[k] : colors[k] + (r.active ? '' : '99') }} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1">
        {rows.map((r, i) => (
          <span key={i} className={`min-w-0 flex-1 truncate text-center text-[10px] ${r.active ? 'font-bold text-ink' : 'text-sub'}`}>
            {i % labelEvery === 0 || i === rows.length - 1 ? r.label : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

// Línea con área. points: [{ label, value }]
export function LineChart({ points, color = '#a855f7', height = 120, format = (v) => v, empty = 'Necesitas al menos 2 registros.' }) {
  const id = useId().replace(/:/g, '')
  if (points.length < 2) {
    return <p className="rounded-2xl border border-dashed border-line px-3 py-4 text-center text-xs text-sub">{empty}</p>
  }
  const W = 300, H = 100, P = 6
  const vals = points.map((p) => p.value)
  let min = Math.min(...vals), max = Math.max(...vals)
  if (min === max) { min -= 1; max += 1 }
  const x = (i) => P + (i / (points.length - 1)) * (W - 2 * P)
  const y = (v) => H - P - ((v - min) / (max - min)) * (H - 2 * P)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`
  const last = points[points.length - 1]
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none" role="img" aria-label="Gráfica de evolución">
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity=".35" /><stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke={GRID} strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
        <path d={area} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px] text-sub">
        <span>{points[0].label}</span>
        <span className="font-bold" style={{ color }}>{format(last.value)}</span>
        <span>{last.label}</span>
      </div>
    </div>
  )
}

// Anillo de progreso con contenido al centro
export function Ring({ pct, color = '#a855f7', size = 132, stroke = 11, children }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(100, pct))
  return (
    <div className="relative grid flex-none place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} style={{ transition: 'stroke-dashoffset .7s ease', filter: `drop-shadow(0 0 8px ${color}88)` }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

// Barra de progreso fina con etiqueta
export function Meter({ label, value, goal, unit = '', color = '#a855f7', format = (v) => Math.round(v) }) {
  const pct = goal ? Math.min(100, (value / goal) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-semibold">{label}</span>
        <span className="text-sub"><b className="text-ink">{format(value)}</b> / {format(goal)} {unit}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

// Barras horizontales: [{ label, value, color? }]
export function HBars({ items, color = '#a855f7', format = (v) => v, empty = 'Sin datos todavía.' }) {
  const max = Math.max(...items.map((i) => i.value), 1)
  if (!items.length) return <p className="rounded-2xl border border-dashed border-line px-3 py-4 text-center text-xs text-sub">{empty}</p>
  return (
    <div className="space-y-2.5">
      {items.map((it) => (
        <div key={it.label}>
          <div className="mb-1 flex justify-between text-xs"><span className="font-semibold">{it.label}</span><span className="text-sub">{format(it.value)}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(it.value / max) * 100}%`, background: it.color || color }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Calendario de actividad (cuadrícula tipo contribuciones). days: [{ date, level 0-4 }]
export function Heatmap({ days, color = '#38bdf8', weeks = 10 }) {
  const cols = []
  for (let i = 0; i < days.length; i += 7) cols.push(days.slice(i, i + 7))
  return (
    <div className="flex justify-between gap-1" role="img" aria-label={`Actividad de las últimas ${weeks} semanas`}>
      {cols.map((col, i) => (
        <div key={i} className="flex flex-1 flex-col gap-1">
          {col.map((d) => (
            <i key={d.date} hidden={d.hidden} title={`${d.date}: ${d.label ?? ''}`} className="block aspect-square w-full rounded-[4px]"
              style={{ background: d.level ? color : 'rgba(255,255,255,.06)', opacity: d.level ? 0.25 + d.level * 0.19 : 1,
                       outline: d.today ? `1.5px solid ${color}` : 'none' }} />
          ))}
        </div>
      ))}
    </div>
  )
}
