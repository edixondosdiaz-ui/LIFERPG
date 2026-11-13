import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as social from '../services/social'
export default function RoutineManager({ value,onChange }) {
  const [rows,setRows]=useState([]),[quota,setQuota]=useState(null),[name,setName]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const load=useCallback(async()=>{const [r,q]=await Promise.all([social.listRoutines(),social.routineQuota()]);setRows(r);setQuota(q)},[])
  useEffect(()=>{load().catch(e=>setError(e.message))},[load])
  async function run(fn){setBusy(true);setError('');try{await fn();await load()}catch(e){setError(e.message)}finally{setBusy(false)}}
  return <section className="surface space-y-3 p-4"><h2 className="text-sm font-bold">Tus rutinas</h2>{error && <p className="text-xs text-red-300">{error}</p>}
    <select aria-label="Rutina" className="field" value={value} onChange={e=>onChange(e.target.value)}><option value="">Todos los ejercicios del día</option>{rows.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select>
    <p className="text-xs text-sub">{quota?`${quota.count} rutinas · ${quota.limit===null?'sin límite con Premium':`límite Gratis: ${quota.limit}`}`:'Consultando límite…'}</p>
    <form className="flex gap-2" onSubmit={e=>{e.preventDefault();run(async()=>{const r=await social.addRoutine(name);setName('');onChange(r.id)})}}><input aria-label="Nombre de nueva rutina" className="field" required maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder="Nueva rutina"/><button className="btn" disabled={busy || !quota || (quota.limit!==null && quota.count>=quota.limit)}>Crear</button></form>
    {quota?.limit!==null && quota?.count>=quota?.limit && <Link to="/premium" className="text-xs text-pu-light">Rutinas ilimitadas con Premium →</Link>}
    {value && <div className="flex gap-3"><button disabled={busy} className="text-xs text-pu-light" onClick={()=>{const next=prompt('Nombre de la rutina',rows.find(r=>r.id===value)?.name);if(next?.trim())run(()=>social.renameRoutine(value,next))}}>Renombrar</button><button disabled={busy} className="text-xs text-red-300" onClick={()=>{if(confirm('¿Eliminar esta rutina? Tus ejercicios y series se conservan.'))run(async()=>{await social.deleteRoutine(value);onChange('')})}}>Eliminar rutina</button></div>}
  </section>
}
