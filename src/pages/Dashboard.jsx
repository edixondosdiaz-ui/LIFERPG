import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import * as ex from '../services/experience'
import * as px from '../services/pillars'
import { PILLARS, levelProgress } from '../lib/xp'
import { today, weekStart } from '../lib/dates'
import { PRODUCT } from '../lib/product'

const CARDS = {
  fuerza: { color: '#ff4d4f', path: 'fuerza', action: 'Empezar la rutina de hoy' },
  vitalidad: { color: '#2fbf4a', path: 'salud', action: '+250 ml de agua' },
  intelecto: { color: '#38bdf8', path: 'educacion', action: 'Iniciar Pomodoro' },
  finanzas: { color: '#e6b43c', path: 'finanzas', action: 'Registrar movimiento' },
}
export default function Dashboard() {
  const { profile, streak, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { ex.activity().then(setRows).catch(e => setMsg(e.message)) }, [profile?.xp])
  const lp = levelProgress(profile?.xp ?? 0)
  const completed = rows?.some(r => r.day === today())
  async function quick(key) {
    if (busy) return
    setBusy(true); setMsg('')
    try {
      if (key === 'vitalidad') {
        const r = await px.logWater(250)
        setMsg(`Agua registrada: ${r.total} ml hoy${r.xp_awarded ? ` · +${r.xp_awarded} XP` : ''}`)
        await refreshProfile(); setRows(await ex.activity())
      } else if (key === 'fuerza') {
        await ex.timerAction('workout','start'); navigate('/pilares/fuerza')
      } else if (key === 'intelecto') {
        const last = (await px.listStudy('1900-01-01'))[0]
        await ex.timerAction('study','start',{ mode:'pomodoro', focus:PRODUCT.focusMinutes, brk:PRODUCT.breakMinutes, topic:last?.topic || 'Estudio', category:last?.category || 'General' })
        navigate('/pilares/educacion')
      } else navigate('/pilares/finanzas#movimiento')
    } catch (e) { setMsg(e.message) } finally { setBusy(false) }
  }
  return <div className="space-y-5">
    <section className="surface space-y-3 bg-gradient-to-br from-pu-dark/30 to-card p-4">
      <div className="flex items-center justify-between"><h1 className="text-xl font-extrabold">Hoy · Nivel {lp.level}</h1><span className="text-xs text-orange-300">Racha {streak} días</span></div>
      <div className="flex justify-between text-xs text-sub"><span>@{profile?.username}</span><b>{lp.current} / {lp.needed} XP</b></div>
      <div className="h-2 rounded-full bg-white/10"><div className="h-full rounded-full bg-pu" style={{width:`${lp.pct}%`}} /></div>
    </section>
    <section className="surface p-4"><h2 className="font-bold">Objetivo del día</h2><p className="mt-1 text-sm text-sub">{!rows ? 'Consultando actividad…' : completed ? 'Objetivo cumplido. Ya registraste actividad hoy.' : 'Registra una actividad en cualquiera de tus pilares.'}</p><Link to="/pilares/habitos" className="mt-3 inline-block text-xs font-bold text-pu-light">Tus hábitos rápidos →</Link></section>
    {msg && <p role="status" className="text-sm text-pu-light">{msg}</p>}
    <div className="grid grid-cols-1 gap-3">
      {Object.entries(PILLARS).map(([key,p]) => {
        const c=CARDS[key], lp=levelProgress(profile?.pillar_xp?.[key] ?? 0)
        const days=rows ? new Set(rows.filter(r => r.pillar===key && r.day>=weekStart()).map(r=>r.day)).size : null
        return <section key={key} className="overflow-hidden rounded-3xl border p-4" style={{borderColor:c.color+'44', background:`linear-gradient(135deg,${c.color}20,#15161c)`}}>
          <Link to={`/pilares/${c.path}`} className="block" aria-label={`Abrir ${p.label}`}><div className="flex justify-between"><h2 className="font-extrabold">{p.label.replace('Control financiero','Finanzas')}</h2><span className="text-xs font-bold" style={{color:c.color}}>Nivel {lp.level}</span></div><p className="mt-3 text-xs text-sub">{days === null ? 'Cargando semana…' : `${days} de 7 días activos esta semana`}</p><div className="mt-2 h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full" style={{width:`${(days ?? 0)/7*100}%`,background:c.color}} /></div></Link>
          <button disabled={busy} onClick={()=>quick(key)} className="mt-4 w-full rounded-2xl border py-3 text-sm font-bold disabled:opacity-50" style={{borderColor:c.color+'55',color:c.color}}>{c.action}</button>
          {key==='vitalidad' && <Link to="/pilares/salud/correr" className="mt-2 block rounded-2xl bg-white/5 py-3 text-center text-sm font-bold text-emerald-300">Correr / Caminar</Link>}
        </section>
      })}
    </div>
  </div>
}
