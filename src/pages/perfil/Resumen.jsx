import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import * as api from '../../services/api'
import { PILLARS, levelProgress } from '../../lib/xp'
import Avatar from '../../components/Avatar'
import AvatarEditor from '../../components/AvatarEditor'
import { DEFAULT_AVATAR } from '../../lib/avatar'

const COLORS = { fuerza: '#ff4d4f', vitalidad: '#2fbf4a', intelecto: '#38bdf8', finanzas: '#e6b43c' }

export default function Resumen() {
  const { user, profile, equipped, streak, refreshProfile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const xp = profile?.xp ?? 0
  const { level, current, needed, pct } = levelProgress(xp)
  const pillarXp = profile?.pillar_xp ?? {}
  const badge = equipped.find((e) => e.slot === 'badge')?.icon
  const since = (profile?.created_at || user?.created_at)
    ? new Date(profile?.created_at || user.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '–'

  async function save() {
    setBusy(true); setErr('')
    try { await api.updateAvatar(draft); await refreshProfile(); setEditing(false) }
    catch (e) { setErr(e.message) }
    setBusy(false)
  }

  if (editing) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold tracking-tight">Tu versión futura</h1>
        <AvatarEditor value={draft} onChange={setDraft} equipped={equipped} />
        {err && <p className="text-xs font-semibold text-red-300">{err}</p>}
        <div className="flex gap-2.5">
          <button onClick={() => setEditing(false)} className="rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-bold text-sub active:scale-95">Cancelar</button>
          <button disabled={busy} onClick={save} className="btn flex-1">{busy ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[28px] border border-white/[.08] bg-gradient-to-br from-pu-dark/45 via-card to-card p-6 text-center shadow-[0_24px_60px_-24px_rgba(168,85,247,.65)]">
        <div className="pointer-events-none absolute -top-20 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-pu/30 blur-3xl" />
        <div className="relative mx-auto w-fit"><Avatar avatar={profile?.avatar} equipped={equipped} view="bust" size={150} /></div>
        <p className="relative mt-4 truncate text-2xl font-extrabold tracking-tight">@{profile?.username} {badge && <span>{badge}</span>}</p>
        {profile?.display_name && <p className="relative text-sm text-ink/80">{profile.display_name}</p>}
        <p className="relative text-xs text-sub">Miembro desde {since}</p>
        <button onClick={() => { setDraft({ ...DEFAULT_AVATAR, ...(profile?.avatar || {}) }); setEditing(true) }}
          className="relative mt-4 rounded-full border border-white/10 bg-white/[.07] px-4 py-2 text-xs font-bold transition hover:bg-white/10 active:scale-95">Editar avatar</button>
        <div className="relative mt-5 text-left">
          <div className="flex items-center justify-between text-[11px] text-sub"><span>Nivel {level}</span><b className="text-pu-light">{current} / {needed} XP</b></div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-pu-dark to-pu-light transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2.5">
        <div className="surface py-3.5 text-center"><p className="text-xl font-extrabold">🔥 {streak}</p><p className="mt-0.5 text-[11px] text-sub">Racha</p></div>
        <div className="surface py-3.5 text-center"><p className="text-xl font-extrabold">{xp.toLocaleString('es-CO')}</p><p className="mt-0.5 text-[11px] text-sub">XP total</p></div>
        <Link to="/perfil/tienda" className="surface py-3.5 text-center transition active:scale-95"><p className="text-xl font-extrabold text-gold">{(profile?.coins ?? 0).toLocaleString('es-CO')}</p><p className="mt-0.5 text-[11px] text-sub">Monedas</p></Link>
      </div>

      <section className="surface p-4">
        <h2 className="mb-3 text-sm font-extrabold">XP por pilar</h2>
        <div className="space-y-3">
          {Object.entries(PILLARS).map(([k, p]) => {
            const px = pillarXp[k] ?? 0
            const lp = levelProgress(px)
            return (
              <div key={k}>
                <div className="mb-1 flex justify-between text-xs"><span className="font-bold">{p.label}</span><b style={{ color: COLORS[k] }}>{px.toLocaleString('es-CO')} XP · Niv {lp.level}</b></div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${lp.pct}%`, background: COLORS[k] }} /></div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
