import { palette } from '../design/tokens'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import * as api from '../services/api'
import Avatar from '../components/Avatar'
import BackButton from '../components/BackButton'
import { PILLARS, levelFromXp, levelProgress } from '../lib/xp'

const COLORS = { fuerza: palette.strength, vitalidad: palette.health, intelecto: palette.education, finanzas: palette.finance }

// Barra enfrentada: quien tiene más, resalta
function Versus({ label, a, b, color = palette.brand.DEFAULT, fmt = (n) => n.toLocaleString('es-CO') }) {
  const max = Math.max(a, b, 1)
  const win = a === b ? 0 : a > b ? 1 : 2
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <b className={win === 1 ? 'text-ink' : 'text-sub'}>{fmt(a)}</b>
        <span className="font-semibold text-sub">{label}</span>
        <b className={win === 2 ? 'text-ink' : 'text-sub'}>{fmt(b)}</b>
      </div>
      <div className="flex gap-1">
        <div className="flex h-2 flex-1 justify-end overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-all duration-ui" style={{ width: `${(a / max) * 100}%`, background: color, opacity: win === 2 ? 0.45 : 1 }} /></div>
        <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-all duration-ui" style={{ width: `${(b / max) * 100}%`, background: color, opacity: win === 1 ? 0.45 : 1 }} /></div>
      </div>
    </div>
  )
}

export default function FriendProfile() {
  const { username } = useParams()
  const { profile } = useAuth()
  const [them, setThem] = useState(null)
  const [me, setMe] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    setThem(null); setErr('')
    Promise.all([api.getFriendProfile(username), api.getFriendProfile(profile.username)])
      .then(([t, m]) => { setThem(t); setMe(m) })
      .catch((e) => setErr(e.message))
  }, [username, profile.username])

  return (
    <div className="space-y-5">
      <BackButton to="/amigos" label="Amigos" />
      {err && <p className="rounded-2xl border border-error/30 bg-error/10 p-4 text-sm text-error">{err}</p>}
      {!them && !err && <p className="text-center text-sm text-sub">Cargando…</p>}

      {them?.private && <section className="surface space-y-3 p-4"><Avatar avatar={them.avatar} view="head" size={70}/><h1 className="break-words text-xl font-extrabold">@{them.username}</h1><p className="text-sm text-sub">Este perfil es privado.</p></section>}
      {them && me && !them.private && (
        <>
          <section className="relative overflow-hidden rounded-hero border border-white/[.08] bg-gradient-to-br from-pu-dark/45 via-card to-card p-6 text-center shadow-card">
            <div className="relative mx-auto w-fit"><Avatar avatar={them.avatar} equipped={them.equipped} view="bust" size={140} /></div>
            <p className="relative mt-4 truncate text-2xl font-extrabold tracking-tight">@{them.username} {them.equipped.find((e) => e.slot === 'badge')?.icon}</p>
            {them.equipped.find(e=>e.slot==='title') && <p className="relative text-sm font-bold text-pu-light">{them.equipped.find(e=>e.slot==='title').text}</p>}
            <div className="relative mt-4 grid grid-cols-3 gap-2.5">
              <div className="rounded-2xl border border-white/[.08] bg-white/5 py-2.5"><p className="text-lg font-extrabold">{levelFromXp(them.xp)}</p><p className="text-[10px] text-sub">Nivel</p></div>
              <div className="rounded-2xl border border-white/[.08] bg-white/5 py-2.5"><p className="text-lg font-extrabold">🔥 {them.streak}</p><p className="text-[10px] text-sub">Racha</p></div>
              <div className="rounded-2xl border border-white/[.08] bg-white/5 py-2.5"><p className="text-lg font-extrabold">{them.achievements}</p><p className="text-[10px] text-sub">Logros</p></div>
            </div>
          </section>

          <section className="surface space-y-4 p-4">
            <div className="flex items-center justify-between text-sm font-extrabold"><span>Tú</span><span className="text-xs font-semibold text-sub">Comparación</span><span>@{them.username}</span></div>
            <Versus label="XP total" a={me.xp} b={them.xp} />
            <Versus label="Nivel" a={levelFromXp(me.xp)} b={levelFromXp(them.xp)} />
            <Versus label="Racha" a={me.streak} b={them.streak} color={palette.nutrition} />
            <Versus label="Hábitos" a={me.habits} b={them.habits} />
            <Versus label="Series de fuerza" a={me.sets} b={them.sets} />
            <Versus label="Logros" a={me.achievements} b={them.achievements} color={palette.finance} />
          </section>

          <section className="surface space-y-4 p-4">
            <h2 className="text-sm font-extrabold">Progreso por pilar</h2>
            {Object.entries(PILLARS).map(([k, p]) => (
              <Versus key={k} label={`${p.label} · Niv ${levelProgress(me.pillar_xp?.[k] ?? 0).level} vs ${levelProgress(them.pillar_xp?.[k] ?? 0).level}`}
                a={me.pillar_xp?.[k] ?? 0} b={them.pillar_xp?.[k] ?? 0} color={COLORS[k]} />
            ))}
          </section>
        </>
      )}
    </div>
  )
}
