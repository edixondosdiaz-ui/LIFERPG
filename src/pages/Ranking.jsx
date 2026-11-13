import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ranking, LEAGUES } from '../services/social'
import Avatar from '../components/Avatar'
import UserSheet from '../components/UserSheet'
import { levelFromXp } from '../lib/xp'
export default function Ranking() {
  const { user }=useAuth()
  const [scope,setScope]=useState('global'),[data,setData]=useState(null),[error,setError]=useState(''),[selected,setSelected]=useState(null)
  const load=useCallback(async()=>{setError('');setData(await ranking(scope))},[scope])
  useEffect(()=>{setData(null);load().catch(e=>setError(e.message))},[load])
  return <div className="space-y-5"><header className="flex items-center justify-between"><div><p className="kicker text-pu-light">Competencia</p><h1 className="text-2xl font-extrabold">Ranking</h1></div><Link to="/amigos" className="rounded-2xl border border-white/10 px-4 py-2 text-xs font-bold">Buscar y gestionar amigos</Link></header>
    <div className="grid grid-cols-3 gap-2">{[['global','Global'],['friends','Amigos'],['league','Mi Liga']].map(([id,label])=><button key={id} onClick={()=>setScope(id)} className={`rounded-2xl py-3 text-sm font-bold ${scope===id?'bg-pu/25 text-pu-light':'bg-white/5 text-sub'}`}>{label}</button>)}</div>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}{!data && !error && <p className="text-sm text-sub">Cargando ranking…</p>}
    {data && <><section className="surface flex items-center justify-between p-4"><div><p className="text-xs text-sub">Tu posición</p><p className="text-3xl font-black text-pu-light">{data.position?`#${data.position}`:'–'}</p></div><p className="text-right text-xs text-sub">{data.total} participantes{scope==='league' && <><br/><b className="text-ink">{LEAGUES[data.tier]}</b></>}</p></section>
      {scope==='league' && <section className="surface space-y-2 p-4 text-xs text-sub"><h2 className="font-bold text-ink">Semana del {data.week_start}</h2><p>Bronce → Plata → Oro → Platino → Diamante → Maestro.</p><p>Con al menos {data.league_min_members} participantes por liga, el {data.league_percent} % superior sube y el {data.league_percent} % inferior baja al cerrar la semana. Los empates que crucen el corte se mantienen; no se asciende sin XP.</p><p>El cierre ocurre automáticamente en el servidor al consultar el ranking de la nueva semana.</p></section>}
      <p className="text-[11px] text-sub">Global y Amigos usan XP total; Mi Liga usa XP semanal registrado desde {new Date(data.tracking_started_at).toLocaleDateString('es-CO',{timeZone:'America/Bogota'})}. Se muestran hasta 100 participantes.</p>
      <div className="space-y-2">{data.rows.map(r=><button key={r.id} onClick={()=>setSelected(r.username)} className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left ${r.id===user.id?'border-pu/50 bg-pu/10':'border-white/10 bg-card'}`}><span className="w-7 text-center text-sm font-black text-pu-light">{r.position}</span><Avatar avatar={r.avatar} size={40} view="head"/><span className="min-w-0 flex-1 truncate text-sm font-bold">@{r.username}{r.id===user.id?' · tú':''}<span className="block text-[10px] font-normal text-sub">Nivel {levelFromXp(r.xp)}</span></span><b className="text-xs">{scope==='league'?(r.week_xp===null?'Privado':`${r.week_xp} XP`):`${r.xp.toLocaleString('es-CO')} XP`}</b></button>)}</div>
      {scope==='friends' && data.total===1 && <Link className="btn block text-center" to="/amigos">Busca amigos para competir</Link>}
    </>}
    {selected && <UserSheet username={selected} scope={scope} onClose={()=>setSelected(null)} onChanged={load}/>}
  </div>
}
