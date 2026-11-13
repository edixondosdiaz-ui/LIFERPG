import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../services/api'
import Avatar from '../components/Avatar'
import BackButton from '../components/BackButton'
import { levelFromXp } from '../lib/xp'
import { haptic } from '../lib/ui'
import UserSheet from '../components/UserSheet'

const Person = ({ p, children, to, onOpen }) => {
  const body = (
    <>
      <Avatar avatar={p.avatar} view="head" size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-extrabold">@{p.username}</p>
        <p className="truncate text-[11px] text-sub">{p.xp==null?'Perfil privado':`Niv ${levelFromXp(p.xp)}`}</p>
      </div>
    </>
  )
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[.06] bg-card px-3.5 py-2.5">
      {onOpen ? <button onClick={()=>onOpen(p.username)} className="flex min-w-0 flex-1 items-center gap-3 text-left">{body}</button> : to ? <Link to={to} className="flex min-w-0 flex-1 items-center gap-3">{body}</Link> : body}
      <div className="flex flex-none gap-1.5">{children}</div>
    </div>
  )
}

const Mini = ({ children, tone = 'default', ...p }) => (
  <button {...p} className={`rounded-xl px-3 py-2 text-xs font-bold transition active:scale-press disabled:opacity-50 ${tone === 'primary' ? 'bg-gradient-to-b from-pu-dark to-pu-pressed text-white' : tone === 'danger' ? 'bg-error/10 text-error' : 'bg-white/10'}`}>{children}</button>
)

export default function Amigos() {
  const [selected,setSelected]=useState(null)
  const [list, setList] = useState(null)
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [removing, setRemoving] = useState(null)

  const load = useCallback(() => api.listFriendships().then(setList).catch((e) => setMsg({ type: 'err', text: e.message })), [])
  useEffect(() => { load() }, [load])

  const term = q.trim().replace(/^@/, '').toLowerCase()
  const runSearch = useCallback(async () => {
    if (term.length < 2) return setResults(null)
    try { setResults(await api.searchUsers(term)) } catch (e) { setMsg({ type: 'err', text: e.message }) }
  }, [term])
  useEffect(() => { const t = setTimeout(runSearch, 350); return () => clearTimeout(t) }, [runSearch])

  async function run(fn, okText) {
    setMsg({ type: '', text: '' }); haptic(10)
    try { await fn(); if (okText) setMsg({ type: 'ok', text: okText }); await Promise.all([load(), runSearch()]) }
    catch (e) { setMsg({ type: 'err', text: e.message }) }
  }

  const friends = (list ?? []).filter((f) => f.direction === 'friend')
  const incoming = (list ?? []).filter((f) => f.direction === 'incoming')
  const outgoing = (list ?? []).filter((f) => f.direction === 'outgoing')

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <BackButton to="/ranking" label="Ranking" />
        <h1 className="text-2xl font-extrabold tracking-tight">Amigos</h1>
      </header>

      <div>
        <input className="field" placeholder="Buscar por nombre de usuario" autoCapitalize="none" autoCorrect="off" spellCheck="false"
          value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar usuario" />
        {results && (
          <div className="mt-3 space-y-2">
            {results.length === 0 && <p className="py-2 text-center text-xs text-sub">No encontramos a nadie con “{term}”.</p>}
            {results.map((u) => (
              <Person onOpen={setSelected} key={u.id} p={u} to={u.relation === 'friend' ? `/u/${u.username}` : undefined}>
                {u.relation === 'none' && <Mini tone="primary" onClick={() => run(() => api.sendFriendRequest(u.username), `Solicitud enviada a @${u.username}`)}>Agregar</Mini>}
                {u.relation === 'sent' && <Mini disabled>Enviada</Mini>}
                {u.relation === 'received' && <Mini tone="primary" onClick={() => run(() => api.sendFriendRequest(u.username), `Ahora eres amigo de @${u.username}`)}>Aceptar</Mini>}
                {u.relation === 'friend' && <Mini disabled>Amigos ✓</Mini>}
              </Person>
            ))}
          </div>
        )}
      </div>

      {msg.text && <p key={msg.text} className={`animate-pop rounded-2xl border px-4 py-2.5 text-center text-sm font-semibold ${msg.type === 'ok' ? 'border-pu/30 bg-pu/10 text-pu-light' : 'border-error/30 bg-error/10 text-error'}`}>{msg.text}</p>}
      {!list && !msg.text && <p className="text-center text-sm text-sub">Cargando…</p>}

      {incoming.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-extrabold">Solicitudes recibidas <span className="font-semibold text-sub">· {incoming.length}</span></h2>
          {incoming.map((f) => (
            <Person onOpen={setSelected} key={f.friendship_id} p={f}>
              <Mini tone="primary" onClick={() => run(() => api.respondFriendRequest(f.friendship_id, true), `Ahora eres amigo de @${f.username}`)}>Aceptar</Mini>
              <Mini onClick={() => run(() => api.respondFriendRequest(f.friendship_id, false))}>Rechazar</Mini>
            </Person>
          ))}
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-extrabold">Enviadas <span className="font-semibold text-sub">· {outgoing.length}</span></h2>
          {outgoing.map((f) => (
            <Person onOpen={setSelected} key={f.friendship_id} p={f}><Mini onClick={() => run(() => api.removeFriendship(f.friendship_id))}>Cancelar</Mini></Person>
          ))}
        </section>
      )}

      {list && (
        <section className="space-y-2">
          <h2 className="text-sm font-extrabold">Mis amigos <span className="font-semibold text-sub">· {friends.length}</span></h2>
          {friends.length === 0 && <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-xs text-sub">Busca a alguien arriba para enviarle una solicitud.</p>}
          {friends.map((f) => (
            <Person onOpen={setSelected} key={f.friendship_id} p={f} to={`/u/${f.username}`}>
              {removing === f.friendship_id
                ? <><Mini tone="danger" onClick={() => { setRemoving(null); run(() => api.removeFriendship(f.friendship_id), `Eliminaste a @${f.username}`) }}>Eliminar</Mini><Mini onClick={() => setRemoving(null)}>No</Mini></>
                : <Mini aria-label={`Eliminar a ${f.username}`} onClick={() => setRemoving(f.friendship_id)}>⋯</Mini>}
            </Person>
          ))}
        </section>
      )}
      {selected && <UserSheet username={selected} onClose={()=>setSelected(null)} onChanged={load}/>}
    </div>
  )
}
