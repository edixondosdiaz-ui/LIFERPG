import BackButton from '../components/BackButton'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import * as api from '../services/api'
import { HABITS, PILLARS, XP } from '../lib/xp'

const COLORS = { vitalidad: '#2fbf4a', intelecto: '#38bdf8', finanzas: '#e6b43c' }

export default function Habits() {
  const { refreshProfile } = useAuth()
  const [today, setToday] = useState([])
  const [msg, setMsg] = useState({ type: '', text: '' })

  const load = useCallback(async () => setToday(await api.listHabitsToday()), [])
  useEffect(() => { load() }, [load])

  const count = (habit) => today.filter((h) => h.habit === habit).length

  async function log(pillar, habit) {
    setMsg({ type: '', text: '' })
    try {
      await api.logHabit({ pillar, habit })
      setMsg({ type: 'ok', text: `+${XP.HABIT} XP en ${PILLARS[pillar].label}` })
      await Promise.all([load(), refreshProfile()])
    } catch (err) {
      setMsg({ type: 'err', text: err.message })
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <BackButton to="/pilares" label="Pilares" />
        <p className="kicker mt-3 text-pu-light">Hoy</p>
        <h1 className="text-2xl font-extrabold tracking-tight">Hábitos</h1>
        <p className="mt-1 text-xs text-sub">{today.length} {today.length === 1 ? 'registro' : 'registros'} hoy · +{XP.HABIT} XP cada uno</p>
      </header>

      {msg.text && (
        <p key={msg.text + today.length} className={`animate-pop rounded-2xl border px-4 py-2.5 text-center text-sm font-semibold ${msg.type === 'ok' ? 'border-pu/30 bg-pu/10 text-pu-light' : 'border-red-400/30 bg-red-400/10 text-red-300'}`}>
          {msg.text}
        </p>
      )}

      {Object.entries(HABITS).map(([pillar, habits]) => {
        const c = COLORS[pillar]
        return (
          <section key={pillar} className="surface overflow-hidden p-4">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="h-5 w-1.5 rounded-full" style={{ background: c, boxShadow: `0 0 12px ${c}` }} />
              <h2 className="text-sm font-extrabold">{PILLARS[pillar].label}</h2>
            </div>
            <div className="space-y-2">
              {habits.map((habit) => {
                const n = count(habit)
                return (
                  <div key={habit} className="flex items-center justify-between gap-3 rounded-2xl border border-white/[.06] bg-card2/70 px-3.5 py-3"
                    style={n ? { borderColor: c + '55', background: `linear-gradient(90deg, ${c}1a, transparent)` } : undefined}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{habit}</p>
                      <p className="text-[11px] text-sub">{n ? <span style={{ color: c }}>{n} hoy</span> : 'Sin registrar hoy'}</p>
                    </div>
                    <button onClick={() => log(pillar, habit)} className="btn !px-4 !py-2 text-xs">Registrar</button>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
