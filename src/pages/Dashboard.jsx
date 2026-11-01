import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import * as api from '../services/api'
import { PILLARS, levelProgress } from '../lib/xp'
import Avatar from '../components/Avatar'

const COLORS = { fuerza: '#ff4d4f', vitalidad: '#2fbf4a', intelecto: '#38bdf8', finanzas: '#e6b43c' }

export default function Dashboard() {
  const { profile, equipped, streak } = useAuth()
  const [todayCount, setTodayCount] = useState(null)
  useEffect(() => { api.listHabitsToday().then((r) => setTodayCount(r.length)).catch(() => {}) }, [profile?.xp])

  const xp = profile?.xp ?? 0
  const { level, current, needed, pct } = levelProgress(xp)
  const pillarXp = profile?.pillar_xp ?? {}
  const username = profile?.username ?? ''
  const badge = equipped.find((e) => e.slot === 'badge')?.icon

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[28px] border border-white/[.08] bg-gradient-to-br from-pu-dark/45 via-card to-card p-5 shadow-[0_24px_60px_-24px_rgba(168,85,247,.65)]">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-pu/30 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="relative flex-none">
            <div className="rounded-full bg-gradient-to-br from-pu-light to-pu-dark p-[3px] shadow-[0_0_30px_#a855f780]">
              <Avatar avatar={profile?.avatar} equipped={equipped} view="head" size={78} />
            </div>
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider text-app">NIV {level}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xl font-extrabold tracking-tight">@{username}{badge && <span className="ml-1">{badge}</span>}</p>
              <span className="flex-none rounded-full bg-orange-400/15 px-2.5 py-1 text-[11px] font-extrabold text-orange-300" title="Racha de días seguidos">🔥 {streak}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-sub">
              <span>Experiencia</span><b className="text-pu-light">{current} / {needed} XP</b>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-pu-dark to-pu-light shadow-[0_0_12px_#a855f7cc] transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border border-white/[.08] bg-white/5 py-3 text-center backdrop-blur-md">
            <p className="text-xl font-extrabold leading-none">{xp.toLocaleString('es-CO')}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-sub">XP total</p>
          </div>
          <div className="rounded-2xl border border-white/[.08] bg-white/5 py-3 text-center backdrop-blur-md">
            <p className="text-xl font-extrabold leading-none">{todayCount ?? '–'}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-sub">Hábitos hoy</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="kicker mb-3">Pilares</h2>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(PILLARS).map(([key, p]) => {
            const px = pillarXp[key] ?? 0
            const lp = levelProgress(px)
            const c = COLORS[key]
            return (
              <div key={key} className="relative overflow-hidden rounded-2xl border p-3.5 transition active:scale-[.97]"
                style={{ borderColor: c + '33', background: `linear-gradient(145deg, ${c}1f, transparent 70%)` }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{p.label.replace('Control financiero', 'Finanzas')}</span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold" style={{ background: c + '26', color: c }}>NIV {lp.level}</span>
                </div>
                <p className="mt-3 text-2xl font-black leading-none" style={{ color: c }}>{px.toLocaleString('es-CO')}</p>
                <p className="mt-0.5 text-[10px] text-sub">XP acumulado</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${lp.pct}%`, background: c }} />
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
