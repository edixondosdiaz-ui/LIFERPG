import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import * as ex from '../services/experience'
import { PILLARS } from '../lib/xp'
import { monthStart, weekStart, fmtDay, streakOf } from '../lib/dates'
import Logros from './perfil/Logros'
import AdvancedTrends from '../components/AdvancedTrends'

export default function Progreso() {
  const { streak, profile } = useAuth()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { ex.activity().then(setRows).catch(e => setError(e.message)) }, [profile?.xp])
  return <div className="space-y-5">
    <h1 className="text-2xl font-extrabold">Progreso</h1>
    <p className="text-sm text-sub">Racha actual: <b className="text-ink">{streak} días</b></p>
    {error && <p role="alert" className="text-sm text-error">{error}</p>}
    {!rows && !error && <p className="text-sub">Cargando actividad…</p>}
    {rows && <><section className="surface space-y-4 p-4"><h2 className="font-bold">Semana y mes actuales</h2><p className="text-xs text-sub">Días activos por pilar</p>
      {Object.entries(PILLARS).map(([key,p]) => {
        const own = rows.filter(r => r.pillar === key)
        const days = new Set(own.map(r => r.day))
        const week = [...days].filter(d => d >= weekStart()).length
        const month = [...days].filter(d => d >= monthStart()).length
        return <div key={key}><div className="flex justify-between text-sm"><b>{p.label}</b><span>{week} semana · {month} mes</span></div><div className="mt-2 h-2 rounded-full bg-white/10"><div className="h-full rounded-full bg-pu" style={{width:`${week / 7 * 100}%`}} /></div><p className="mt-1 text-xs text-sub">Racha: {streakOf(days)} días</p></div>
      })}
    </section><section className="surface space-y-3 p-4"><h2 className="font-bold">Historial de actividad · últimos 90 días</h2>{!rows.length && <p className="text-sm text-sub">Tu primera actividad aparecerá aquí.</p>}<div className="max-h-80 space-y-3 overflow-y-auto">{rows.map(r => <div key={`${r.day}-${r.pillar}`} className="flex justify-between gap-2 text-xs"><span>{fmtDay(r.day)} · {PILLARS[r.pillar]?.label}</span><b>{r.entries} registros</b></div>)}</div></section></>}
    <Logros />
    <AdvancedTrends />
  </div>
}
