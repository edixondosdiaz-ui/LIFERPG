import { useEffect, useState } from 'react'
import * as api from '../../services/api'
import { useAuth } from '../../context/AuthContext'

export function AchievementCard({ a }) {
  const pct = a.unlocked ? 100 : Math.min(100, Math.round((a.progress / a.target) * 100))
  const state = a.unlocked ? 'done' : a.progress > 0 ? 'prog' : 'lock'
  const fill = state === 'done' ? 100 : pct

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-3.5 ${state === 'done' ? 'border-gold/50' : state === 'prog' ? 'border-pu/40' : 'border-white/[.06]'}`}
      style={{ background: state === 'lock' ? 'rgba(255,255,255,.02)' : `linear-gradient(90deg, ${state === 'done' ? 'rgba(230,180,60,.30)' : 'rgba(168,85,247,.38)'} ${fill}%, rgba(255,255,255,.03) ${fill}%)` }}>
      <div className="flex items-center gap-3">
        <span className={`grid h-12 w-12 flex-none place-items-center rounded-2xl bg-black/30 text-2xl ${state === 'lock' ? 'opacity-40 grayscale' : ''}`}>{state === 'lock' ? '🔒' : a.icon}</span>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-extrabold ${state === 'lock' ? 'text-sub' : ''}`}>{a.name}</p>
          <p className="text-[11px] text-ink/60">{a.description}</p>
          <p className="mt-1 text-[11px] font-bold">
            <span className={state === 'done' ? 'text-gold' : state === 'prog' ? 'text-pu-light' : 'text-sub'}>{a.unlocked ? '✓ ' : ''}{a.unlocked ? a.target : a.progress}/{a.target} · {pct}% · +{a.reward_coins} monedas</span>
          </p>
        </div>
      </div>
    </div>
  )
}

function Section({ title, count, items }) {
  if (!items.length) return null
  return (
    <section className="space-y-2.5">
      <h2 className="text-sm font-extrabold">{title} <span className="font-semibold text-sub">· {count}</span></h2>
      {items.map((a) => <AchievementCard key={a.id} a={a} />)}
    </section>
  )
}

export default function Logros() {
  const { refreshProfile } = useAuth()
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.getAchievements().then((r) => { setRows(r); refreshProfile() }).catch((e) => setErr(e.message))
  }, [refreshProfile])

  if (err) return <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-300">{err}</p>
  if (!rows) return <p className="text-center text-sm text-sub">Cargando…</p>

  const done = rows.filter((a) => a.unlocked)
  const prog = rows.filter((a) => !a.unlocked && a.progress > 0).sort((x, y) => y.progress / y.target - x.progress / x.target)
  const lock = rows.filter((a) => !a.unlocked && a.progress === 0)

  return (
    <div className="space-y-6">
      <header className="surface flex items-center justify-between p-4">
        <div><h1 className="text-xl font-extrabold tracking-tight">Logros</h1><p className="text-xs text-sub">{done.length} de {rows.length} desbloqueados</p></div>
        <div className="text-right"><p className="text-3xl font-black text-pu-light">{rows.length ? Math.round((done.length / rows.length) * 100) : 0}%</p></div>
      </header>
      <Section title="Cerca de conseguirlos" count={prog.length} items={prog} />
      <Section title="Desbloqueados" count={done.length} items={done} />
      <Section title="Bloqueados" count={lock.length} items={lock} />
    </div>
  )
}
