import { palette } from '../../design/tokens'
import NameChange from '../../components/NameChange'
import { premiumStatus } from '../../services/economy'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import * as ex from '../../services/experience'
import { AchievementCard } from './Logros'
import { useAuth } from '../../context/AuthContext'
import * as api from '../../services/api'
import { PILLARS, levelProgress } from '../../lib/xp'
import Avatar from '../../components/Avatar'
import AvatarEditor from '../../components/AvatarEditor'
import { normalizeAvatar } from '../../lib/avatar'

const COLORS = { fuerza: palette.strength, vitalidad: palette.health, intelecto: palette.education, finanzas: palette.finance }

export default function Resumen() {
  const { user, profile, equipped, streak, refreshProfile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [params, setParams] = useSearchParams()
  const [stats, setStats] = useState(null)
  const [achievements, setAchievements] = useState([])
  const [premium, setPremium] = useState(null)
  useEffect(()=>{premiumStatus().then(setPremium).catch(()=>{})},[profile?.coins])
  useEffect(() => {
    ex.summary().then(setStats).catch(e => setErr(e.message))
    api.getAchievements().then(async a => { setAchievements([...a].sort((x,y) => Number(y.unlocked)-Number(x.unlocked) || y.progress/y.target-x.progress/x.target).slice(0,3)); await refreshProfile() }).catch(e => setErr(e.message))
  }, [profile?.xp])
  useEffect(() => {
    if (params.get('editar') === 'avatar') { setDraft(normalizeAvatar(profile?.avatar)); setEditing(true) }
  }, [params])
  function closeEditor() { setEditing(false); setParams({}, { replace: true }) }
  const xp = profile?.xp ?? 0
  const { level, current, needed, pct } = levelProgress(xp)
  const pillarXp = profile?.pillar_xp ?? {}
  const badge = equipped.find((e) => e.slot === 'badge')?.icon
  const since = (profile?.created_at || user?.created_at)
    ? new Date(profile?.created_at || user.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '–'

  async function save() {
    setBusy(true); setErr('')
    try { await api.updateAvatar(draft); await refreshProfile(); closeEditor() }
    catch (e) { setErr(e.message) }
    setBusy(false)
  }

  if (editing) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold tracking-tight">Tu versión futura</h1>
        <AvatarEditor value={draft} onChange={setDraft} equipped={equipped} canShop />
        {err && <p className="text-xs font-semibold text-error">{err}</p>}
        <div className="flex gap-2.5">
          <button onClick={closeEditor} className="rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-bold text-sub active:scale-press">Cancelar</button>
          <button disabled={busy} onClick={save} className="btn flex-1">{busy ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-hero border border-white/[.08] bg-gradient-to-br from-pu-dark/45 via-card to-card p-6 text-center shadow-card">
        <div className="relative mx-auto w-fit"><Avatar avatar={profile?.avatar} equipped={equipped} view="bust" size={150} /></div>
        <button onClick={() => { setDraft(normalizeAvatar(profile?.avatar)); setEditing(true) }} className="relative mt-3 rounded-full border border-white/10 bg-white/[.07] px-4 py-2 text-xs font-bold">Editar avatar</button>
        <p className="relative mt-4 truncate text-2xl font-extrabold tracking-tight">@{profile?.username} {badge && <span>{badge}</span>}</p>
        {equipped.find(e=>e.slot==='title') && <p className="relative mt-1 text-sm font-bold text-pu-light">{equipped.find(e=>e.slot==='title').text}</p>}
        <NameChange onChanged={async()=>setStats(await ex.summary())} />
        <div className="relative mt-5 text-left">
          <div className="flex items-center justify-between text-[11px] text-sub"><span>Nivel {level}</span><b className="text-pu-light">{current} / {needed} XP</b></div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-pu-dark to-pu-light transition-all duration-ui" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2.5">
        <div className="surface py-3.5 text-center"><p className="text-xl font-extrabold">🔥 {streak}</p><p className="mt-0.5 text-[11px] text-sub">Racha</p></div>
        <div className="surface py-3.5 text-center"><p className="text-xl font-extrabold">{xp.toLocaleString('es-CO')}</p><p className="mt-0.5 text-[11px] text-sub">XP total</p></div>
        <Link to="/tienda" className="surface py-3.5 text-center transition active:scale-press"><p className="text-xl font-extrabold text-gold">{(profile?.coins ?? 0).toLocaleString('es-CO')}</p><p className="mt-0.5 text-[11px] text-sub">Monedas</p></Link>
      </div>

      {err && <p role="alert" className="text-xs text-error">{err}</p>}
      <section className="surface grid grid-cols-2 gap-3 p-4 text-center"><div><p className="text-xl font-black">{stats ? `#${stats.global_rank}` : '–'}</p><p className="text-xs text-sub">Posición global</p></div><div><p className="text-xl font-black">{stats ? `#${stats.friends_rank}` : '–'}</p><p className="text-xs text-sub">Entre amigos</p></div></section>

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
      <section className="space-y-3"><div className="flex justify-between"><h2 className="font-bold">Tus logros destacados</h2><Link to="/progreso" className="text-sm text-pu-light">Ver todos</Link></div>{achievements.map(a => <AchievementCard key={a.id} a={a} />)}</section>
      <section className="surface space-y-3 p-4"><h2 className="font-bold">Estadísticas de por vida</h2>{stats && <div className="grid grid-cols-2 gap-3 text-sm">{[['Hábitos',stats.habits],['Series',stats.sets],['Entrenamientos',stats.workouts],['Horas de estudio',stats.study_hours],['Tareas completadas',stats.study_tasks],['Días de finanzas',stats.fin_days]].map(([label,value]) => <p key={label}><b>{value ?? '–'}</b> <span className="text-sub">{label}</span></p>)}</div>}<p className="text-xs text-sub">Miembro desde {since}</p></section>
      <Link to="/premium" className="surface block space-y-1 border-pu/30 p-4"><h2 className="font-bold text-pu-light">LifeRPG Premium</h2><p className="text-xs text-sub">{premium?.active ? 'Premium activo · Ver beneficios' : 'Conocer la prueba gratuita sin tarjeta'}</p></Link>
    </div>
  )
}
