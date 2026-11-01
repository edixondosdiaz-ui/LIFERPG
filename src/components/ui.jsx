import { useCallback, useEffect, useRef, useState } from 'react'
import BackButton from './BackButton'
import { useAuth } from '../context/AuthContext'
import { levelProgress } from '../lib/xp'

// Cabecera común de los pilares: volver, título y nivel/XP del pilar
export function PillarHeader({ pillar, title, kicker, color, icon }) {
  const { profile } = useAuth()
  const xp = profile?.pillar_xp?.[pillar] ?? 0
  const lp = levelProgress(xp)
  return (
    <header className="space-y-4">
      <BackButton to="/pilares" label="Pilares" />
      <div className="relative overflow-hidden rounded-3xl border p-4"
        style={{ borderColor: color + '40', background: `linear-gradient(135deg, ${color}2e, #15161c 70%)` }}>
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full blur-3xl" style={{ background: color + '40' }} />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl text-2xl" style={{ background: color + '2b' }}>{icon}</span>
            <div>
              <p className="text-[11px] font-bold text-sub">{kicker}</p>
              <h1 className="text-2xl font-extrabold leading-tight tracking-tight">{title}</h1>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-sub">Nivel</p>
            <p className="text-3xl font-black leading-none" style={{ color }}>{lp.level}</p>
          </div>
        </div>
        <div className="relative mt-3 flex items-center justify-between text-[11px] text-sub">
          <span>{lp.current} / {lp.needed} XP al siguiente nivel</span><span>{xp.toLocaleString('es-CO')} XP</span>
        </div>
        <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${lp.pct}%`, background: `linear-gradient(90deg, ${color}99, ${color})` }} />
        </div>
      </div>
    </header>
  )
}

// Pestañas tipo segmento
export function Tabs({ items, value, onChange, color = '#a855f7' }) {
  return (
    <div className="flex gap-1.5 rounded-2xl border border-white/[.07] bg-card p-1.5" role="tablist">
      {items.map((t) => {
        const on = value === t.id
        return (
          <button key={t.id} role="tab" aria-selected={on} onClick={() => onChange(t.id)}
            className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition active:scale-95 ${on ? 'text-white' : 'text-sub hover:text-ink'}`}
            style={on ? { background: `linear-gradient(180deg, ${color}, ${color}bb)`, boxShadow: `0 6px 18px -8px ${color}` } : undefined}>
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

// Mensajes cortos (XP ganado, errores). Uso: const [toast, show] = useToast()
export function useToast() {
  const [msg, setMsg] = useState(null)
  const timer = useRef()
  const show = useCallback((text, type = 'ok') => {
    clearTimeout(timer.current)
    setMsg({ text, type, n: Date.now() })
    timer.current = setTimeout(() => setMsg(null), 4200)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  return [msg, show]
}

export function Toast({ msg }) {
  if (!msg) return null
  const cls = msg.type === 'pr' ? 'border-pu/40 bg-gradient-to-r from-pu/25 to-pu-dark/10 text-pu-light'
    : msg.type === 'err' ? 'border-red-400/30 bg-red-400/10 text-red-300' : 'border-pu/30 bg-pu/10 text-pu-light'
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 mx-auto flex max-w-md justify-center px-4" role="status" aria-live="polite">
      <p key={msg.n} className={`animate-pop rounded-2xl border px-4 py-2.5 text-center text-sm font-bold shadow-[0_12px_30px_-10px_rgba(0,0,0,.8)] backdrop-blur-md ${cls}`}>{msg.text}</p>
    </div>
  )
}

export const xpText = (r) => (r?.xp_awarded ? ` · +${r.xp_awarded} XP` : '')

export function Card({ title, right, children, className = '' }) {
  return (
    <section className={`surface space-y-3 p-4 ${className}`}>
      {(title || right) && (
        <div className="flex items-center justify-between gap-2">
          {title && <h2 className="text-sm font-extrabold">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

export function Stat({ label, value, sub, color }) {
  return (
    <div className="rounded-2xl border border-white/[.06] bg-card2/70 px-3 py-2.5">
      <p className="text-[10px] font-bold text-sub">{label}</p>
      <p className="mt-0.5 truncate text-lg font-extrabold leading-tight" style={color ? { color } : undefined}>{value}</p>
      {sub && <p className="text-[10px] text-sub">{sub}</p>}
    </div>
  )
}

export function Empty({ title, text }) {
  return (
    <div className="rounded-3xl border border-dashed border-line px-6 py-8 text-center">
      <p className="text-sm font-bold">{title}</p>
      {text && <p className="mt-1 text-xs text-sub">{text}</p>}
    </div>
  )
}

export function Chip({ active, color = '#a855f7', children, ...p }) {
  return (
    <button type="button" {...p}
      className={`rounded-full border px-3 py-1.5 text-xs font-bold transition active:scale-95 ${active ? 'text-white' : 'border-white/10 bg-white/5 text-sub hover:text-ink'}`}
      style={active ? { background: color, borderColor: color } : undefined}>
      {children}
    </button>
  )
}

export function Segment({ value, onChange, options, color }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => <Chip key={o.id ?? o} active={value === (o.id ?? o)} color={color} onClick={() => onChange(o.id ?? o)}>{o.label ?? o}</Chip>)}
    </div>
  )
}

export const confirmDelete = (text) => window.confirm(text)

// Editor de objetivos (agua, sueño, calorías, estudio…). fields: [{ key, label, unit, min, max, step }]
export function GoalEditor({ fields, settings, onSave, title = 'Objetivos' }) {
  const [open, setOpen] = useState(false)
  const [vals, setVals] = useState({})
  const [busy, setBusy] = useState(false)
  useEffect(() => { setVals(Object.fromEntries(fields.map((f) => [f.key, String(settings[f.key] ?? '')]))) }, [settings, fields])
  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await onSave(Object.fromEntries(fields.map((f) => [f.key, Number(vals[f.key])])))
      setOpen(false)
    } finally { setBusy(false) }
  }
  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="text-[11px] font-bold text-sub transition hover:text-ink">
        {open ? '− Cerrar' : `⚙ ${title}`}
      </button>
      {open && (
        <form onSubmit={save} className="animate-pop mt-2 space-y-2.5 rounded-2xl border border-white/[.06] bg-card2/70 p-3">
          <div className="grid grid-cols-2 gap-2">
            {fields.map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1 block text-[10px] font-bold text-sub">{f.label}{f.unit ? ` (${f.unit})` : ''}</span>
                <input className="field" type="number" inputMode="decimal" required min={f.min} max={f.max} step={f.step ?? 1}
                  value={vals[f.key] ?? ''} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} />
              </label>
            ))}
          </div>
          <button disabled={busy} className="btn w-full">{busy ? 'Guardando…' : 'Guardar objetivos'}</button>
        </form>
      )}
    </div>
  )
}
