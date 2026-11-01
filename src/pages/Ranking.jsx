import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import * as api from '../services/api'
import { levelFromXp } from '../lib/xp'
import Avatar from '../components/Avatar'
import { haptic } from '../lib/ui'

const MEDAL = ['#e6b43c', '#b8c0cc', '#c9803a']

function Row({ i, r, me, to }) {
  const inner = (
    <>
      <span className="w-7 text-center text-sm font-black" style={{ color: MEDAL[i] || '#8b91a5' }}>{i + 1}</span>
      <Avatar avatar={r.avatar} view="head" size={38} />
      <p className="min-w-0 flex-1 truncate text-sm font-bold">@{r.username}{me && <span className="ml-1.5 text-[10px] text-pu-light">tú</span>}</p>
      <div className="text-right"><p className="text-sm font-extrabold">{r.xp.toLocaleString('es-CO')}</p><p className="text-[10px] text-sub">Niv {levelFromXp(r.xp)}</p></div>
    </>
  )
  const cls = `flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 ${me ? 'border-pu/50 bg-pu/10' : 'border-white/[.06] bg-card'}`
  return to ? <Link to={to} className={`${cls} transition active:scale-[.98]`}>{inner}</Link> : <div className={cls}>{inner}</div>
}

export default function Ranking() {
  const { user, profile } = useAuth()
  const [tab, setTab] = useState('global')
  const [rows, setRows] = useState(null)
  const [friends, setFriends] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => { api.getLeaderboard().then(setRows).catch((e) => setErr(e.message)) }, [])
  useEffect(() => {
    if (tab !== 'amigos' || friends) return
    api.listFriendships().then(setFriends).catch((e) => setErr(e.message))
  }, [tab, friends])

  // Ranking entre amigos: tú + tus amigos aceptados, siempre por nombre de usuario
  const friendRows = friends && profile ? [
    { id: user.id, username: profile.username, xp: profile.xp ?? 0, avatar: profile.avatar },
    ...friends.filter((f) => f.direction === 'friend').map((f) => ({ id: f.user_id, username: f.username, xp: f.xp, avatar: f.avatar })),
  ].sort((a, b) => b.xp - a.xp) : null
  const pending = friends ? friends.filter((f) => f.direction === 'incoming').length : 0

  const list = tab === 'global' ? rows : friendRows
  const pos = list ? list.findIndex((r) => r.id === user.id) + 1 : 0

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div><p className="kicker text-pu-light">Competencia</p><h1 className="text-2xl font-extrabold tracking-tight">Ranking</h1></div>
        <Link to="/amigos" className="relative rounded-full border border-white/10 bg-white/[.07] px-4 py-2 text-xs font-bold transition active:scale-95">
          Amigos{pending > 0 && <i className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[#ff4d4f] text-[10px] not-italic text-white">{pending}</i>}
        </Link>
      </header>

      <div className="flex gap-1.5 rounded-2xl border border-white/[.07] bg-card p-1.5 text-[11px] font-bold">
        {[['global', 'Global'], ['amigos', 'Amigos']].map(([id, label]) => (
          <button key={id} onClick={() => { haptic(4); setTab(id) }}
            className={`flex-1 rounded-xl py-2.5 text-center transition active:scale-95 ${tab === id ? 'bg-gradient-to-b from-pu-light to-pu-dark text-white' : 'text-sub'}`}>{label}</button>
        ))}
        <span className="flex-1 rounded-xl py-2.5 text-center text-sub/50">Mi Liga · pronto</span>
      </div>

      {err && <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-300">No se pudo cargar el ranking: {err}</p>}
      {!list && !err && <p className="text-center text-sm text-sub">Cargando…</p>}

      {list && (
        <>
          <div className="surface flex items-center justify-between p-4">
            <div><p className="kicker !text-[10px]">Tu posición</p><p className="text-3xl font-black text-pu-light">{pos ? `#${pos}` : '–'}</p></div>
            <p className="text-right text-xs text-sub">de {list.length} {list.length === 1 ? 'jugador' : 'jugadores'}</p>
          </div>
          {tab === 'amigos' && list.length === 1 && (
            <div className="rounded-3xl border border-dashed border-line px-6 py-8 text-center">
              <p className="text-sm font-bold">Aún no tienes amigos</p>
              <p className="mt-1 text-xs text-sub">Busca a alguien por su nombre de usuario y compite con él.</p>
              <Link to="/amigos" className="btn mt-4">Buscar amigos</Link>
            </div>
          )}
          <div className="space-y-2">
            {list.map((r, i) => (
              <Row key={r.id} i={i} r={r} me={r.id === user.id} to={tab === 'amigos' && r.id !== user.id ? `/u/${r.username}` : undefined} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
