import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import * as routines from '../services/strengthRoutines'
import * as social from '../services/social'
import * as api from '../services/api'
import * as px from '../services/pillars'
import { Card, Stat } from './ui'
import { CreateRoutineDialog, ExercisePicker } from './StrengthRoutineDialogs'
import StrengthMarks from './StrengthMarks'
import { EditRoutineDays } from './StrengthRoutineDialogs'
import StrengthSetEditor from './StrengthSetEditor'
import { DAY_INITIALS, DAY_NAMES, defaultRoutine, weekdayInBogota, initialSet, seriesRows, workoutStats } from '../lib/strengthRoutine'
import { fmtLong, today as todayDate } from '../lib/dates'
import { kg } from '../lib/fitness'

function RoutineWorkout({revision,notify,preferred,forced=false,onSaved,onSelected}){
  const {refreshProfile}=useAuth()
  const [weekday,setWeekday]=useState(weekdayInBogota()),[items,setItems]=useState([]),[routineId,setRoutineId]=useState('')
  const [ready,setReady]=useState(false),[quota,setQuota]=useState(null),[error,setError]=useState('')
  const [exercises,setExercises]=useState([]),[state,setState]=useState(null),[loading,setLoading]=useState(false)
  const [creating,setCreating]=useState(false),[picking,setPicking]=useState(false),[drafts,setDrafts]=useState({})
  const [editingDays,setEditingDays]=useState(false)
  const currentRoutine=useRef(routineId),saving=useRef(new Set()),today=weekdayInBogota()
  currentRoutine.current=routineId
  async function loadRoutines(preferred){const [rows,q]=await Promise.all([routines.scheduledRoutines(),social.routineQuota()]);setItems(rows);setQuota(q);setRoutineId(preferred ?? defaultRoutine(rows,weekday));setReady(true)}
  useEffect(()=>{let live=true;Promise.all([routines.scheduledRoutines(),social.routineQuota()]).then(([rows,q])=>{if(live){setItems(rows);setQuota(q);setRoutineId(preferred || defaultRoutine(rows,weekdayInBogota()));setReady(true)}}).catch(()=>{if(live)setError('No pudimos cargar tus rutinas. Intenta de nuevo.')});return()=>{live=false}},[])
  const load=useCallback(async()=>{if(!routineId)return;const [rows,data]=await Promise.all([routines.routineExercises(routineId),routines.routineState(routineId)]);if(currentRoutine.current===routineId){setExercises(rows);setState(data);setError('')}},[routineId])
  useEffect(()=>{let live=true;setState(null);setExercises([]);if(!routineId)return;setLoading(true);load().catch(()=>{if(live)setError('No pudimos cargar esta rutina. Intenta de nuevo.')}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[load,revision,routineId])
  useEffect(()=>{onSelected?.(routineId)},[routineId,onSelected])
  function key(id){return `${routineId}:${id}`}
  function draftFor(exercise){return drafts[key(exercise.id)] || {rows:state?.today_sets.some(s=>s.exercise_id===exercise.id)?seriesRows(state.today_sets.filter(s=>s.exercise_id===exercise.id)):[initialSet(state?.previous_sets.filter(s=>s.exercise_id===exercise.id) || [])],busy:false,request:null,editing:false}}
  function changeDay(day){setWeekday(day);setRoutineId(defaultRoutine(items,day))}
  async function save(exercise){
    const id=key(exercise.id),rid=routineId,draft=draftFor(exercise)
    if(saving.current.has(id))return
    saving.current.add(id)
    const request=draft.request || crypto.randomUUID()
    setDrafts(v=>({...v,[id]:{...draft,busy:true,request}}))
    let committed=false
    try{const result=await routines.saveExercise(rid,exercise.id,draft.rows,request);committed=true;setDrafts(v=>{const next={...v};delete next[id];return next});notify(`${result.sets} series guardadas · +${result.xp_awarded} XP`);await Promise.all([load(),refreshProfile()]);await onSaved?.()}
    catch(e){if(committed)notify('Las series se guardaron. No pudimos actualizar el resumen; vuelve a consultarlo.','err');else{setDrafts(v=>({...v,[id]:{...draft,busy:false,request:e.uncertain===false?null:request}}));notify(e.uncertain===false?'No pudimos guardar. Revisa los valores e intenta de nuevo.':'Se interrumpió la conexión. Verifica el registro con el botón de reintentar.','err')}}finally{saving.current.delete(id)}
  }
  async function rename(exercise){const name=prompt('Nombre del ejercicio',exercise.name);if(!name?.trim())return;try{await api.renameExercise(exercise.id,name);await load()}catch{notify('No pudimos cambiar el nombre. Intenta de nuevo.','err')}}
  async function unlink(exercise){if(!confirm('¿Borrar este ejercicio de la rutina y sus marcas de hoy? El historial anterior se conserva.'))return;try{await routines.unlinkExercise(routineId,exercise.id);setDrafts(v=>{const next={...v};delete next[key(exercise.id)];return next});await load();await onSaved?.()}catch{notify('No pudimos quitar el ejercicio. Intenta de nuevo.','err')}}
  const stats=workoutStats(state?.today_sets || [],state?.previous_sets || []),marks=state?.previous_sets || []
  const routine=items.find(r=>r.id===routineId),atLimit=quota?.limit!=null && quota.count>=quota.limit
  return <>
    {!forced && <><nav aria-label="Día de la rutina" className="grid grid-cols-7">{DAY_INITIALS.map((initial,index)=><button key={index} type="button" aria-label={`${DAY_NAMES[index]}${today===index+1?', hoy':''}`} aria-current={today===index+1?'date':undefined} aria-pressed={weekday===index+1} onClick={()=>changeDay(index+1)} className={`min-h-[44px] rounded-small border text-[12px] font-bold ${weekday===index+1?'border-pu bg-pu/15 text-pu-light':'border-transparent text-sub'} ${today===index+1?'underline decoration-pu-light decoration-2 underline-offset-4':''}`}>{initial}</button>)}</nav>
    <section className="surface space-y-3 p-3"><label className="block text-sub">Seleccionar rutina<select className="field mt-1" value={routineId} disabled={!ready} onChange={e=>setRoutineId(e.target.value)}><option value="">{ready?'Selecciona una rutina':'Cargando rutinas…'}</option>{items.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>{ready && !routineId && <p className="text-[12px] text-sub">{items.length?'No tienes una rutina asignada a este día. Elige otra o crea una.':'Crea tu primera rutina, elige sus días y agrega tus ejercicios.'}</p>}<div className="flex flex-wrap items-center justify-between gap-2"><button type="button" className="pilot-secondary !px-3 !py-2 text-[12px]" disabled={!ready || !quota || atLimit} onClick={()=>setCreating(true)}>Crear rutina</button>{routineId && <a href={`#routine-add-exercise-${routineId}`} className="flex min-h-[44px] items-center text-[12px] text-pu-light">Ir a agregar ejercicio ↓</a>}</div>{quota && <p className="text-[12px] text-sub">{quota.count} rutinas · {quota.limit===null?'sin límite con Premium':`límite de tu plan: ${quota.limit}`}</p>}{atLimit && <Link to="/premium" className="inline-flex min-h-[44px] items-center text-[12px] text-pu-light">Ya tienes el máximo de {quota.limit} rutinas de tu plan. Premium permite rutinas ilimitadas →</Link>}{routine && <details><summary className="flex min-h-[44px] cursor-pointer items-center text-[12px] text-sub">Administrar rutina</summary><div className="flex flex-wrap gap-3"><button className="min-h-[44px] text-[12px] text-pu-light" onClick={()=>setEditingDays(true)}>Cambiar días</button><button className="min-h-[44px] text-[12px] text-pu-light" onClick={async()=>{const name=prompt('Nombre de la rutina',routine.name);if(name?.trim()){try{await social.renameRoutine(routineId,name);await loadRoutines(routineId)}catch{notify('No pudimos cambiar el nombre.','err')}}}}>Renombrar</button><button className="min-h-[44px] text-[12px] text-error" disabled={Object.values(drafts).some(d=>d.busy || d.request)} onClick={async()=>{if(confirm('¿Borrar esta rutina? Su historial de marcas se conserva.')){try{await routines.archiveRoutine(routineId);await loadRoutines('');await onSaved?.()}catch{notify('No pudimos eliminar la rutina.','err')}}}}>Eliminar rutina</button></div></details>}</section>
    </>}
    {error && <div role="alert" className="space-y-2 text-[12px] text-error"><p>{error}</p><button className="pilot-secondary" onClick={()=>{setError('');(ready?load():loadRoutines()).catch(()=>setError('No pudimos consultar tus rutinas. Intenta de nuevo.'))}}>Intentar de nuevo</button></div>}
    {routineId && <>
      <details className="surface p-3"><summary className="flex min-h-[44px] cursor-pointer items-center font-bold">Marcas del último entrenamiento</summary>{loading?<p className="mt-3 text-[12px] text-sub">Consultando marcas…</p>:!state?<p className="mt-3 text-[12px] text-sub">Tus marcas no están disponibles. Intenta consultar de nuevo.</p>:marks.length?<div className="mt-3 space-y-2"><p className="text-[12px] text-sub">{fmtLong(state.previous_day)}</p><StrengthMarks rows={marks}/></div>:<p className="mt-3 text-[12px] text-sub"><b className="text-ink">Sin marcas aún.</b> Registra tu primer entrenamiento para comparar la próxima vez.</p>}</details>
      <section aria-label={`Ejercicios de ${routine?.name || 'la rutina'}`} className="space-y-3"><h2 className="font-bold">{routine?.name} · registro de hoy</h2>{loading?<p className="text-[12px] text-sub">Cargando ejercicios…</p>:exercises.length===0?<p className="text-[12px] text-sub">Agrega un ejercicio para empezar.</p>:exercises.map(exercise=><StrengthSetEditor key={key(exercise.id)} exercise={exercise} saved={state?.today_sets.filter(s=>s.exercise_id===exercise.id) || []} draft={draftFor(exercise)} onDraft={draft=>setDrafts(v=>({...v,[key(exercise.id)]:draft}))} onSave={()=>save(exercise)} onRename={()=>rename(exercise)} onRemove={()=>unlink(exercise)}/>)}<button id={`routine-add-exercise-${routineId}`} type="button" disabled={loading || !state} onClick={()=>setPicking(true)} className="pilot-secondary w-full scroll-mt-4">Agregar ejercicio</button></section>
      <Card title="Resumen del día"><div className="grid grid-cols-2 gap-2"><Stat label="Volumen total" value={state?kg(stats.volume):'—'}/><Stat label="Series totales" value={state?stats.sets:'—'}/></div><p className="text-[12px] text-sub">{stats.delta===null?'La comparación aparecerá cuando haya un entrenamiento anterior.':`${stats.delta>=0?'+':''}${stats.delta.toLocaleString('es-CO',{maximumFractionDigits:1})}% de volumen frente al entreno anterior${stats.sets?' (hoy en curso)':''}.`}</p>{stats.best.length>0 && <div className="space-y-2"><h3 className="text-sm font-bold">Mejor marca de hoy por ejercicio</h3>{stats.best.map(row=><p key={row.exercise_id} className="break-words text-[12px]">{row.name}: {kg(row.weight_kg)} × {row.reps}</p>)}</div>}</Card>
    </>}
    <EditRoutineDays open={editingDays} routine={routine} onClose={()=>setEditingDays(false)} onSaved={()=>loadRoutines(routineId)}/>
    <CreateRoutineDialog open={creating} weekday={weekday} onClose={()=>setCreating(false)} onCreated={async id=>{try{await loadRoutines(id)}catch{setError('Tu rutina se creó. Vuelve a consultar para actualizar la lista.');setReady(false)}}}/>
    <ExercisePicker open={picking} routine={routineId} weekday={weekday} existing={exercises.map(e=>e.id)} onClose={()=>setPicking(false)} onAdded={async()=>{try{await load()}catch{setError('El ejercicio se agregó. Vuelve a consultar para actualizar la lista.')}}}/>
  </>
}

// Hoy se restaura desde el servidor, no desde el selector ni desde almacenamiento local.
export default function DailyRoutineWorkout({revision,notify}){
 const [day,setDay]=useState(todayDate),[daily,setDaily]=useState(null),[selected,setSelected]=useState(''),[version,setVersion]=useState(0),[error,setError]=useState('')
 const reload=useCallback(async()=>{try{setDaily(await routines.todayRoutines());setError('');setVersion(v=>v+1)}catch{setError('No pudimos recuperar tu entrenamiento de hoy. Intenta de nuevo.')}},[])
 useEffect(()=>{reload()},[reload,day])
 useEffect(()=>{const refresh=()=>setDay(todayDate());const id=setInterval(refresh,15000);window.addEventListener('focus',refresh);return()=>{clearInterval(id);window.removeEventListener('focus',refresh)}},[])
 if(error)return <div role="alert" className="surface space-y-3 p-3"><p>{error}</p><button className="pilot-secondary" onClick={reload}>Reintentar</button></div>
 if(!daily || daily.day!==day)return <p className="text-sm text-sub">Recuperando tu entrenamiento de hoy…</p>
 return <><RoutineWorkout key={day} revision={revision} notify={notify} preferred={daily.routines[0]?.id} onSaved={reload} onSelected={setSelected}/>{daily.routines.filter(r=>r.id!==selected).map(r=><RoutineWorkout key={day+':'+r.id} preferred={r.id} forced revision={version} notify={notify} onSaved={reload}/>)}</>
}
