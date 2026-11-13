import AchievementCard from '../../components/AchievementCard'
export { default as AchievementCard } from '../../components/AchievementCard'
import { useEffect, useState } from 'react'
import * as api from '../../services/api'
import { useAuth } from '../../context/AuthContext'

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

  if (err) return <p className="rounded-2xl border border-error/30 bg-error/10 p-4 text-sm text-error">{err}</p>
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
