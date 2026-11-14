import { PillarTile } from '../components/PilotCards'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import * as ex from '../services/experience'
import * as px from '../services/pillars'
import { PILLARS, levelProgress } from '../lib/xp'
import { today, weekStart } from '../lib/dates'
import WeeklyHabitStreak from '../components/WeeklyHabitStreak'
import useHabitWeek from '../hooks/useHabitWeek'
import { PRODUCT } from '../lib/product'

const CARDS = {
  fuerza: { path: 'fuerza', action: 'Empezar la rutina de hoy' },
  vitalidad: { path: 'salud', action: 'Entrar a Salud' },
  intelecto: { path: 'educacion', action: 'Iniciar Pomodoro' },
  finanzas: { path: 'finanzas', action: 'Registrar movimiento' },
}
export default function Dashboard() {
  const { profile, user } = useAuth()
  const habits=useHabitWeek(user?.id)
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
        navigate('/pilares/salud')
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
    <WeeklyHabitStreak data={habits.data} error={habits.error} reload={habits.reload}/>
    {msg && <p role="status" className="text-sm text-pu-light">{msg}</p>}
    <div className="grid grid-cols-1 gap-3">
      {Object.entries(PILLARS).map(([key,p]) => {
        const c=CARDS[key], lp=levelProgress(profile?.pillar_xp?.[key] ?? 0)
        const days=rows ? new Set(rows.filter(r => r.pillar===key && r.day>=weekStart()).map(r=>r.day)).size : null
        return <PillarTile key={key} pillar={key} title={p.label} path={`/pilares/${c.path}`} level={lp.level} days={days} action={c.action} busy={busy} onQuick={()=>quick(key)} wholeLink={key==='vitalidad'}>
        </PillarTile>
      })}
    </div>
  </div>
}
