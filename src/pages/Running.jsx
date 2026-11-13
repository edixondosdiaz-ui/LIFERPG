import RunControls from '../components/RunControls'
import { healthFailure } from '../lib/healthLayout'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../services/running'
import { getPreferences } from '../services/experience'
import { useAuth } from '../context/AuthContext'
import { clock } from '../lib/dates'
import { filterPoint, METERS_PER_MILE, paceText } from '../lib/running'
import RunRoute from '../components/RunRoute'
import { Card, Stat } from '../components/ui'

export default function Running({embedded=false}) {
  const { refreshProfile }=useAuth()
  const [rules,setRules]=useState(null),[ready,setReady]=useState(false),[activity,setActivity]=useState('walk'),[units,setUnits]=useState('km')
  const [session,setSession]=useState(null),[running,setRunning]=useState(false),[points,setPoints]=useState([]),[meters,setMeters]=useState(0),[currentPace,setCurrentPace]=useState(null)
  const [summary,setSummary]=useState(null),[rows,setRows]=useState([]),[stats,setStats]=useState(null),[detail,setDetail]=useState(null)
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[wakeMessage,setWakeMessage]=useState('')
  const [manualDistance,setManualDistance]=useState(''),[manualMinutes,setManualMinutes]=useState('')
  const sessionRef=useRef(null),runningRef=useRef(false),watch=useRef(null),wake=useRef(null),queue=useRef(Promise.resolve()),frame=useRef(null),pending=useRef([])
  const previous=useRef(null),sampleAt=useRef(null),segment=useRef(0),clockBase=useRef({seconds:0,at:0}),manualId=useRef(null),flushRef=useRef(null),mounted=useRef(true),actionBusy=useRef(false)
  const [,tick]=useState(0)
  const [attempt,setAttempt]=useState(0)
  function adopt(s) {sessionRef.current=s;if(mounted.current)setSession(s);clockBase.current={seconds:s?.active_seconds || 0,at:performance.now()}}
  const reload=useCallback(async()=>{const [h,s]=await Promise.all([api.history(),api.overview()]);if(mounted.current){setRows(h);setStats(s)}},[])
  useEffect(()=>{
    mounted.current=true;let active=true;setReady(false);setError('')
    ;(async()=>{try{const [r,s,p]=await Promise.all([api.getRules(),api.activeRun(),getPreferences().catch(e=>{console.error('[Salud] Preferencias de recorrido',e);return null})]);if(!active)return;setRules(r);setUnits(p?.units || 'km');if(s){adopt(s);setActivity(s.activity);segment.current=s.segment;setMeters(Number(s.meters));setPoints(await api.route(s.id));setNotice('Recuperamos tu borrador en pausa. Reanuda para volver a usar el GPS.')}await reload()}catch(e){if(active)setError(healthFailure(e))}finally{if(active)setReady(true)}})()
    return()=>{active=false;mounted.current=false;stopTracking();if(sessionRef.current?.status==='running')flushRef.current?.('pause').catch(()=>{})}
  },[reload,attempt])
  function stopTracking(){if(runningRef.current){clockBase.current={seconds:clockBase.current.seconds+Math.max(0,(performance.now()-clockBase.current.at)/1000),at:performance.now()}}runningRef.current=false;if(mounted.current){setRunning(false);setCurrentPace(null)}if(watch.current!==null){navigator.geolocation.clearWatch(watch.current);watch.current=null}wake.current?.release().catch(()=>{});wake.current=null;previous.current=null;sampleAt.current=null}
  async function wakeScreen(){if(!navigator.wakeLock){setWakeMessage('Este navegador no admite mantener la pantalla encendida automáticamente.');return}try{const lock=await navigator.wakeLock.request('screen');if(!runningRef.current){await lock.release();return}wake.current=lock;setWakeMessage('Pantalla encendida mientras el navegador lo permita.')}catch{if(mounted.current)setWakeMessage('No se pudo bloquear el apagado. Mantén la pantalla encendida manualmente.')}}
  async function transmit(packet){
    const s=await api.saveRun(packet.id,packet.seq,packet.points,packet.action,packet.writer)
    pending.current.splice(0,packet.points.length);frame.current=null;adopt(s)
    if(mounted.current)setError('')
    return s
  }
  function flush(action='save'){
    const work=queue.current.catch(()=>{}).then(async()=>{
      if(!sessionRef.current)return null
      if(frame.current)await transmit(frame.current)
      if(sessionRef.current.status==='completed')return sessionRef.current
      do{
        const s=sessionRef.current
        frame.current={id:s.id,seq:s.last_seq+1,points:pending.current.slice(0,60),action:pending.current.length>60?'save':action,writer:s.writer_token}
        await transmit(frame.current)
      }while(pending.current.length>0)
      return sessionRef.current
    })
    queue.current=work;return work
  }
  flushRef.current=flush
  useEffect(()=>{if(!running || !rules)return;const id=setInterval(()=>flushRef.current('save').catch(e=>{if(mounted.current)setError(healthFailure(e,'No pudimos guardar el último tramo. Mantén esta pantalla abierta y reintenta.'))}),Number(rules.heartbeat_seconds)*1000);return()=>clearInterval(id)},[running,rules])
  useEffect(()=>{if(!running)return;const id=setInterval(()=>tick(n=>n+1),1000);return()=>clearInterval(id)},[running])
  useEffect(()=>{
    function visibility(){if(document.visibilityState==='hidden' && runningRef.current){stopTracking();setNotice('La actividad se pausó al ocultar la app. Reanuda cuando regreses.');flushRef.current('pause').catch(e=>{if(mounted.current)setError(healthFailure(e))})}}
    document.addEventListener('visibilitychange',visibility);return()=>document.removeEventListener('visibilitychange',visibility)
  },[])
  function watchGps(r){
    runningRef.current=true;setRunning(true);previous.current=null;sampleAt.current=null;segment.current=sessionRef.current.segment;clockBase.current={seconds:sessionRef.current.active_seconds,at:performance.now()}
    wakeScreen()
    watch.current=navigator.geolocation.watchPosition(position=>{
      if(!runningRef.current)return
      const c=position.coords,p={lat:c.latitude,lng:c.longitude,accuracy:c.accuracy,t:position.timestamp}
      if(sampleAt.current!==null && p.t-sampleAt.current<Number(r.sample_seconds)*1000)return
      sampleAt.current=p.t;pending.current.push(p)
      const result=filterPoint(previous.current,p,sessionRef.current.activity,r)
      if(!result.accepted){if(result.reason!=='interval')setNotice(result.reason);return}
      if(result.break)segment.current+=1
      if(previous.current && result.meters>0)setCurrentPace((p.t-previous.current.t)/1000/(result.meters/1000))
      previous.current=p;setMeters(m=>m+result.meters);setPoints(list=>[...list,{...p,segment:segment.current}]);setNotice('GPS activo. Tu ruta es privada.')
    },e=>{setNotice(e.code===1?'Permiso de ubicación denegado. Puedes usar el registro manual.':'No pudimos obtener un punto GPS. Espera señal al aire libre.');if(e.code===1){stopTracking();flushRef.current('pause').catch(err=>setError(healthFailure(err)))}}, {enableHighAccuracy:true,maximumAge:0,timeout:15000})
  }
  async function act(fn){if(actionBusy.current)return;actionBusy.current=true;setBusy(true);setError('');try{await fn()}catch(e){setError(healthFailure(e))}finally{actionBusy.current=false;if(mounted.current)setBusy(false)}}
  function start(){act(async()=>{
    if(!window.isSecureContext || !navigator.geolocation)throw Error('El GPS requiere HTTPS (o localhost) y un navegador con ubicación. Puedes registrar manualmente.')
    const s=await api.startRun(activity);adopt(s);setSummary(null);setDetail(null);setPoints([]);setMeters(0);pending.current=[];frame.current=null;watchGps(rules)
  })}
  function resume(){act(async()=>{
    if(!window.isSecureContext || !navigator.geolocation)throw Error('La ubicación no está disponible en este navegador.')
    const s=await flush('resume');if(s.status==='completed'){await completeLocal(s);return}adopt(s);setMeters(Number(s.meters));watchGps(rules)
  })}
  function pause(){stopTracking();act(()=>flush('pause'))}
  async function completeLocal(s){stopTracking();setSummary(s);setDetail(null);setMeters(Number(s.meters));adopt(null);setCurrentPace(null);setPoints(await api.route(s.id));await refreshProfile();await reload()}
  function finish(){stopTracking();act(async()=>{await completeLocal(await flush('finish'))})}
  function discard(){if(!confirm('¿Descartar esta actividad sin XP y borrar su ruta?'))return;stopTracking();act(async()=>{await queue.current.catch(()=>{});await api.discardRun(sessionRef.current.id);adopt(null);pending.current=[];frame.current=null;setPoints([]);setMeters(0);setNotice('Borrador descartado')})}
  async function manual(e){e.preventDefault();act(async()=>{manualId.current ||= crypto.randomUUID();const s=await api.manualRun(activity,Number(manualDistance)*(units==='mi'?METERS_PER_MILE:1000),Math.round(Number(manualMinutes)*60),manualId.current);manualId.current=null;setSummary(s);setDetail(null);setPoints([]);setManualDistance('');setManualMinutes('');await refreshProfile();await reload()})}
  const unitMeters=units==='mi'?METERS_PER_MILE:1000
  const distance=m=>`${(Number(m)/unitMeters).toFixed(2)} ${units}`
  const elapsed=clockBase.current.seconds+(running?Math.max(0,(performance.now()-clockBase.current.at)/1000):0)
  const shown=detail || summary
  async function show(row){act(async()=>{setDetail(row);setPoints(await api.route(row.id))})}
  function erase(){if(!shown || !confirm('¿Borrar permanentemente los puntos de esta ruta? Se conservan las métricas y el XP.'))return;act(async()=>{await api.deleteRoute(shown.id);const changed={...shown,route_deleted:true};if(detail)setDetail(changed);else setSummary(changed);setPoints([]);await reload()})}
  return <div className="space-y-5">
    {!embedded && <><Link to="/pilares/salud" className="inline-flex min-h-[44px] items-center text-sm text-sub">← Salud</Link><h1 className="text-2xl font-extrabold">Running o caminata</h1></>}
    <details className="rounded-button border border-stroke bg-panel-inset p-3"><summary className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-semibold"><span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full border border-stroke text-[12px]">i</span>Cómo medimos tu recorrido</summary><div className="mt-2 space-y-2"><p className="text-[12px] text-sub">Usamos tu ubicación al iniciar o reanudar para medir distancia y ritmo. Tu recorrido es privado; descartamos las señales imprecisas.</p><p className="text-[12px] font-semibold text-warning">Mantén la pantalla encendida. Si ocultas la app, intentamos pausar y guardar la actividad.</p><p className="text-[12px] text-sub">Guardamos automáticamente cada {rules?.heartbeat_seconds ?? 30} segundos. Sin conexión, mantén esta pantalla abierta hasta poder guardar.</p></div></details>
    {error && <section role="alert" className="space-y-3 rounded-2xl border border-error/30 p-4 text-sm text-error"><p>{error}</p>{session && <button disabled={busy} className="text-xs underline" onClick={()=>act(async()=>{const saved=await flush(running?'save':'pause');if(saved?.status==='completed')await completeLocal(saved)})}>Reintentar guardado</button>}</section>}
    {ready && !rules && <button className="pilot-secondary" onClick={()=>setAttempt(v=>v+1)}>Reintentar cargar actividad</button>}
    {notice && <p role="status" className="text-xs text-pu-light">{notice}</p>}
    {!ready && <p className="text-sm text-sub">Recuperando actividad…</p>}
    {ready && rules && <>
      <label className="block text-sm font-bold">Actividad<select disabled={!!session || busy} className="field mt-2" value={activity} onChange={e=>{setActivity(e.target.value);manualId.current=null}}><option value="walk">Caminar</option><option value="run">Correr</option></select></label>
      <Card title={session?(running?'Actividad en curso':'Actividad en pausa'):'Actividad con GPS'}>
        {session ? <><div className="grid grid-cols-2 gap-2"><Stat label="Distancia aproximada" value={distance(meters)}/><Stat label="Tiempo activo" value={clock(elapsed)}/><Stat label={`Ritmo actual · min/${units}`} value={paceText(currentPace*(unitMeters/1000))}/><Stat label={`Ritmo promedio · min/${units}`} value={paceText(meters>0?elapsed/(meters/unitMeters):null)}/></div><RunControls session={session} running={running} busy={busy} activity={activity} onPause={pause} onResume={resume} onFinish={finish}/><button disabled={busy} className="min-h-[44px] text-xs text-sub" onClick={discard}>Descartar actividad</button><p className="text-[11px] text-sub">Último guardado: {new Date(session.heartbeat_at).toLocaleTimeString('es-CO',{timeZone:'America/Bogota'})}. Al recuperar un borrador siempre queda en pausa.</p></>
          : <><div className="grid grid-cols-2 gap-2"><Stat label="Última distancia" value={rows[0]?distance(rows[0].meters):'—'}/><Stat label="Tiempo activo" value={rows[0]?clock(rows[0].active_seconds):'—'}/><Stat label={`Ritmo promedio · min/${units}`} value={rows[0] && Number(rows[0].meters)>0?paceText(rows[0].active_seconds/(Number(rows[0].meters)/unitMeters)):'—'}/></div><RunControls session={null} running={false} busy={busy} activity={activity} onStart={start}/></>}
        {wakeMessage && <p className="text-xs text-sub">{wakeMessage}</p>}
      </Card>
      {!session && <Card title="Registro manual · sin ubicación"><form onSubmit={manual} className="space-y-3"><label className="block text-xs">Distancia ({units})<input className="field mt-2" required type="number" min={.1} max={units==='mi'?124:200} step=".01" inputMode="decimal" value={manualDistance} onChange={e=>{setManualDistance(e.target.value);manualId.current=null}}/></label><label className="block text-xs">Duración (minutos)<input className="field mt-2" required type="number" min={1} max={720} step=".1" inputMode="decimal" value={manualMinutes} onChange={e=>{setManualMinutes(e.target.value);manualId.current=null}}/></label><p className="text-xs text-sub">Manual: {rules.manual_xp_per_km} XP/km, máximo {rules.manual_daily_cap} XP al día. GPS: {rules.gps_xp_per_km} XP/km, tope diario conjunto {rules.daily_xp_cap}. Las velocidades imposibles no dan XP.</p><button disabled={busy} className="btn w-full">Guardar actividad manual</button></form></Card>}
    </>}
    {shown && !session && <Card title={detail?'Detalle de actividad':'Actividad finalizada'}><p className="font-bold">{shown.activity==='walk'?'Caminata':'Carrera'} · {shown.mode==='manual'?'Manual':'GPS'}</p><p className="text-sm">{distance(shown.meters)} · {clock(shown.active_seconds)} · ritmo {paceText(Number(shown.meters)>0?shown.active_seconds/(Number(shown.meters)/unitMeters):null)} min/{units}</p><p className="font-bold text-pu-light">+{shown.xp_awarded} XP</p>{shown.suspicious && <p className="text-xs text-warning">Sin XP: duración, señal o velocidad fuera de los límites de validación.</p>}{shown.mode==='gps' && !shown.route_deleted ? <><RunRoute points={points}/><button disabled={busy} onClick={erase} className="text-xs text-error">Borrar ruta privada</button></>:<p className="text-xs text-sub">{shown.mode==='manual'?'Este registro no tiene ruta GPS.':'Ruta eliminada permanentemente.'}</p>}</Card>}
    {stats && <Card title="Tu progreso"><div className="grid grid-cols-2 gap-3"><Stat label="Esta semana" value={distance(stats.week_meters)}/><Stat label="Este mes" value={distance(stats.month_meters)}/><Stat label="Mayor distancia" value={distance(stats.longest_meters)}/><Stat label={`Mejor ritmo · min/${units}`} value={paceText(Number(stats.best_pace)*(unitMeters/1000))}/><Stat label="Racha de actividad" value={`${stats.streak} días`}/></div><p className="text-xs text-sub">Incluye registros manuales; el mejor ritmo excluye actividades marcadas sin validez.</p></Card>}
    <Card title="Historial privado · últimas 50 actividades">{!rows.length && <p className="text-xs text-sub">Aún no hay actividades finalizadas.</p>}<div className="max-h-96 space-y-2 overflow-y-auto">{rows.map(r=><button key={r.id} disabled={busy || !!session} className="flex w-full justify-between gap-3 rounded-2xl bg-white/5 p-3 text-left text-xs" onClick={()=>show(r)}><span>{r.activity==='walk'?'Caminar':'Correr'} · {r.mode==='manual'?'Manual':'GPS'}<span className="mt-1 block text-sub">{r.completed_on}</span></span><b>{distance(r.meters)}<span className="mt-1 block text-sub">{clock(r.active_seconds)} · +{r.xp_awarded} XP</span></b></button>)}</div></Card>
  </div>
}
