import { rankNumber } from '../lib/ranking'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { userSummary, LEAGUES } from '../services/social'
import * as api from '../services/api'
import { PILLARS } from '../lib/xp'
import Avatar from './Avatar'
import { AchievementCard } from '../pages/perfil/Logros'

export default function UserSheet({ username, scope='global', onClose, onChanged }) {
  const dialog=useRef(null)
  const [data,setData]=useState(null)
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const working=useRef(false),live=useRef(false),latest=useRef(0)
  const load=useCallback(async()=>{const token=++latest.current;const result=await userSummary(username,scope);if(live.current && token===latest.current){setData(result);setError('')}},[username,scope])
  useEffect(()=>{
    live.current=true;setData(null);setError('');if(!dialog.current?.open)dialog.current?.showModal()
    const report=e=>{console.error('[Perfil]',e);if(live.current){setData(null);setError('No pudimos consultar este perfil. Intenta de nuevo en un momento.')}}
    load().catch(report)
    const refresh=()=>{if(document.visibilityState==='visible')load().catch(report)}
    window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh)
    const timer=setInterval(refresh,15000)
    return()=>{live.current=false;latest.current++;clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);dialog.current?.close()}
  },[load])
  async function run(fn) {
    if(working.current)return
    working.current=true;setBusy(true);setError('')
    try{await fn();await load();await onChanged?.()}catch(e){console.error('[Perfil]',e);setError('No pudimos completar la solicitud. Intenta de nuevo.')}finally{working.current=false;setBusy(false)}
  }
  return <dialog ref={dialog} onCancel={onClose} onClick={e=>{if(e.target===dialog.current)onClose()}} className="fixed inset-x-0 bottom-0 top-auto m-0 mx-auto max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-hero border border-white/10 bg-card p-5 text-ink backdrop:bg-black/70" aria-label="Resumen de usuario">
    <div className="mb-4 flex justify-between"><h2 className="font-bold">Resumen de usuario</h2><button autoFocus onClick={onClose} className="min-h-[44px] rounded-small px-3 text-sub" aria-label="Cerrar resumen">Cerrar</button></div>
    {error && <p role="alert" className="mb-3 text-sm text-error">{error}</p>}
    {!data && !error && <p className="text-sub">Cargando…</p>}
    {data && <div className="space-y-4"><div className="flex items-center gap-4"><Avatar avatar={data.avatar} size={70} view="head"/><div className="min-w-0"><p className="break-words text-xl font-extrabold">@{data.username}</p>{!data.private && <p className="text-sm text-sub">Nivel <b className="font-display text-[20px] tabular-nums text-ink">{data.level}</b></p>}</div></div>
      {data.private ? <p className="rounded-2xl bg-white/5 p-3 text-xs text-sub">Este perfil es privado.</p> : <><div className="grid grid-cols-2 gap-3 rounded-2xl bg-white/5 p-4 text-xs">{[['XP total',data.xp?.toLocaleString('es-CO') ?? '—'],['Liga',LEAGUES[data.league] || 'Sin participar'],['Racha',`${rankNumber(data.streak)} días`],['XP semanal',rankNumber(data.week_xp)],['Posición',data.position?`#${rankNumber(data.position)}`:'–'],['Pilar fuerte',PILLARS[data.strongest_pillar]?.label || 'Sin actividad']].map(([label,value])=><p key={label}><span className="block text-sub">{label}</span><b className="break-words font-display text-[18px] tabular-nums">{value}</b></p>)}</div><div className="space-y-2">{(data.achievements || []).map(a=><AchievementCard key={a.id} a={a}/>)}</div></>}
      <div className="flex flex-wrap gap-2">
        {data.relationship==='none' && <button disabled={busy} className="btn flex-1" onClick={()=>run(()=>api.sendFriendRequest(data.username))}>Agregar amigo</button>}
        {data.relationship==='sent' && <button disabled className="btn flex-1">Solicitud enviada</button>}
        {data.relationship==='received' && <><button disabled={busy} className="btn flex-1" onClick={()=>run(()=>api.respondFriendRequest(data.friendship_id,true))}>Aceptar solicitud</button><button disabled={busy} className="rounded-2xl bg-white/10 px-4" onClick={()=>run(()=>api.respondFriendRequest(data.friendship_id,false))}>Rechazar</button></>}
        {!data.private && data.relationship==='friend' && <><Link to={`/u/${data.username}`} onClick={onClose} className="btn flex-1 text-center">Comparar</Link><button disabled={busy} className="rounded-2xl bg-error/10 px-4 py-3 text-sm text-error" onClick={()=>{if(confirm(`¿Eliminar a @${data.username} de tus amigos?`))run(()=>api.removeFriendship(data.friendship_id))}}>Eliminar</button></>}
        {data.relationship==='self' && <Link to="/perfil" onClick={onClose} className="btn flex-1 text-center">Mi perfil</Link>}
      </div>
    </div>}
  </dialog>
}
