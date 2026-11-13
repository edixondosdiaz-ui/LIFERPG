import OwnRankBar from '../components/OwnRankBar'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ranking, LEAGUES } from '../services/social'
import UserSheet from '../components/UserSheet'
import { RankingPodium, RankRow, RankIcon } from '../components/RankingCards'
import { rankNumber } from '../lib/ranking'

export default function Ranking(){
  const {user}=useAuth()
  const [scope,setScope]=useState('global'),[data,setData]=useState(null),[error,setError]=useState(''),[selected,setSelected]=useState(null)
  const ownRef=useRef(null),scopeRef=useRef(scope),request=useRef(0)
  scopeRef.current=scope
  const load=useCallback(async()=>{const token=++request.current;const result=await ranking(scope);if(scopeRef.current===scope && token===request.current){setData(result);setError('')}},[scope])
  useEffect(()=>{
    let active=true;setData(null)
    const report=e=>{console.error('[Ranking]',e);if(active)setError('No pudimos cargar el ranking. Intenta de nuevo.')}
    load().catch(report)
    const refresh=()=>{if(document.visibilityState==='visible')load().catch(report)}
    window.addEventListener('focus',refresh)
    const timer=setInterval(refresh,30000)
    return()=>{active=false;request.current++;clearInterval(timer);window.removeEventListener('focus',refresh)}
  },[load])
  return <div className="space-y-5 pb-[100px]">
    <header className="flex items-center justify-between gap-3"><div><p className="kicker text-pu-light">Competencia</p><h1 className="text-2xl font-extrabold">Ranking</h1></div><Link to="/amigos" className="pilot-secondary !px-3 text-[12px]">Buscar amigos</Link></header>
    <div className="grid grid-cols-3 gap-2">{[['global','Global'],['friends','Amigos'],['league','Mi Liga']].map(([id,label])=><button type="button" key={id} onClick={()=>setScope(id)} aria-pressed={scope===id} className={`flex min-h-[48px] items-center justify-center gap-1 rounded-button border text-[12px] font-bold transition active:scale-press ${scope===id?'border-pu-light bg-panel-raised text-pu-light':'border-stroke-glass bg-panel text-sub'}`}>{id==='league' && <RankIcon className="h-5 w-5"/>}{label}</button>)}</div>
    {error && <div role="alert" className="space-y-3"><p className="text-sm text-error">{error}</p><button className="pilot-secondary" onClick={()=>load().catch(e=>{console.error('[Ranking]',e);setError('No pudimos actualizar el ranking. Intenta de nuevo.')})}>Intentar de nuevo</button></div>}
    {!data && !error && <p className="text-sm text-sub">Cargando ranking…</p>}
    {data && <>
      <section className="surface flex items-center justify-between gap-3 bg-hero p-4"><div><p className="flex items-center gap-2 text-[12px] text-sub"><RankIcon className="h-5 w-5 text-pu-light"/>Tu posición</p><p className="mt-1 font-display text-[32px] font-extrabold tabular-nums text-pu-light">{data.position?`#${rankNumber(data.position)}`:'—'}</p></div><p className="text-right text-[12px] text-sub"><b className="font-display text-[20px] tabular-nums text-ink">{rankNumber(data.total)}</b><br/>participantes{scope==='league' && <><br/><b className="text-ink">{LEAGUES[data.tier]}</b></>}</p></section>
      {scope==='league' && <details className="surface p-4"><summary className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-bold"><RankIcon className="h-6 w-6 text-gold"/>{LEAGUES[data.tier]} · reglas de la liga</summary><div className="mt-3 space-y-2 text-[12px] text-sub"><p>Semana del {data.week_start}. Bronce → Plata → Oro → Platino → Diamante → Maestro.</p><p>Con al menos {data.league_min_members} participantes, el {data.league_percent}% superior asciende y el {data.league_percent}% inferior desciende. Los empates en el corte se mantienen; no se asciende sin XP.</p></div></details>}
      <div className="animate-fade-up"><RankingPodium rows={data.rows.slice(0,3)} userId={user.id} onOpen={setSelected} scope={scope} ownRef={ownRef}/></div>
      <p className="text-[12px] leading-relaxed text-sub">Global y Amigos usan XP total. Mi Liga usa XP semanal desde {new Date(data.tracking_started_at).toLocaleDateString('es-CO',{timeZone:'America/Bogota'})}. Mostramos hasta 100 participantes; los perfiles privados ocultan sus métricas.</p>
      <section aria-label="Clasificación" className="space-y-2 animate-fade-up">{data.rows.slice(3).map(row=><RankRow key={row.id} row={row} scope={scope} mine={row.id===user.id} onOpen={setSelected} rowRef={row.id===user.id?ownRef:undefined}/>)}</section>
      {!data.rows.length && <p className="text-sm text-sub">Aún no hay participantes en este ranking.</p>}
      {scope==='friends' && data.total===1 && <Link className="btn block text-center" to="/amigos">Busca amigos para competir</Link>}
      <OwnRankBar row={data.me} anchorRef={ownRef} scope={scope} onOpen={setSelected}/>
    </>}
    {selected && <UserSheet username={selected} scope={scope} onClose={()=>setSelected(null)} onChanged={load}/>}
  </div>
}
