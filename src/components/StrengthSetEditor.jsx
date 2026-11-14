import { useState } from 'react'
import StrengthMarks from './StrengthMarks'
import { copySet, validSet } from '../lib/strengthRoutine'

export default function StrengthSetEditor({exercise,draft,onDraft,onSave,onRename,onRemove,saved=[],preview=false}){
  const [more,setMore]=useState(false),[repeat,setRepeat]=useState('3')
  const rows=draft.rows,locked=draft.busy || Boolean(draft.request)
  const count=rows.reduce((n,r)=>n+Number(r.sets || 0),0)
  const valid=rows.length>0 && rows.every(validSet) && count<=30
  function update(index,key,value){onDraft({...draft,rows:rows.map((r,i)=>i===index?{...r,[key]:value}:r)})}
  return <section className="surface space-y-3 p-3" aria-label={exercise.name}>
    <div className="flex items-start justify-between gap-2"><h3 className="min-w-0 break-words pt-2 font-bold">{exercise.name}</h3>{!preview && <details className="relative shrink-0"><summary className="flex min-h-[44px] cursor-pointer items-center rounded-small border border-stroke px-2 text-[12px]">Opciones</summary><div className="absolute right-0 z-10 w-44 rounded-button border border-stroke bg-card p-2"><button type="button" disabled={locked} onClick={onRename} className="min-h-[44px] w-full text-[12px]">Cambiar nombre</button></div></details>}</div>
    {saved.length>0 && <StrengthMarks rows={saved}/>}
    {!preview && <div className="flex flex-wrap gap-3">{saved.length>0 && !draft.editing && <button type="button" className="pilot-secondary" onClick={()=>onDraft({...draft,editing:true})}>Editar marcas</button>}<button type="button" disabled={locked} onClick={onRemove} className="min-h-[44px] text-[12px] text-error">Borrar ejercicio</button></div>}
    {(saved.length===0 || draft.editing) && <form onSubmit={e=>{e.preventDefault();if(!preview && valid && !draft.busy)onSave()}} className="space-y-3">
      <div className="grid grid-cols-[1fr_1fr_44px] gap-2 text-[12px] text-sub" aria-hidden="true"><span>Peso (kg)</span><span>Reps.</span><span/></div>
      {rows.map((row,index)=><div key={index} className="space-y-2"><div className="grid grid-cols-[1fr_1fr_44px] gap-2">{[['weight','Peso (kg)','decimal',0,1000,'0.01'],['reps','Repeticiones','numeric',1,200,'1']].map(([key,label,mode,min,max,step])=><input key={key} aria-label={`${label}, fila ${index+1}, ${exercise.name}`} className="field !px-2 !py-2" type="number" inputMode={mode} min={min} max={max} step={step} required disabled={locked} value={row[key]} onChange={e=>update(index,key,e.target.value)}/>) }<button type="button" aria-label={`Quitar fila ${index+1}`} disabled={locked || rows.length===1} className="flex h-[44px] w-[44px] items-center justify-center rounded-small border border-stroke text-sub disabled:opacity-40" onClick={()=>onDraft({...draft,rows:rows.filter((_,i)=>i!==index)})}>×</button></div>{more && <div className="grid grid-cols-2 gap-2">{[['rest','Descanso (s)',86400],['rir','RIR (0–10)',10]].map(([key,label,max])=><label key={key} className="block text-sub">{label}<input aria-label={`${label}, fila ${index+1}, ${exercise.name}`} className="field mt-1 !px-2 !py-2" type="number" inputMode="numeric" min={0} max={max} step={1} disabled={locked} value={row[key]} onChange={e=>update(index,key,e.target.value)}/></label>)}</div>}</div>)}
      <div className="flex flex-wrap justify-between gap-2"><button type="button" onClick={()=>setMore(v=>!v)} aria-expanded={more} className="min-h-[44px] text-[12px] text-pu-light">{more?'Ocultar opcionales':'Descanso y RIR (opcionales)'}</button><button type="button" disabled={locked || count>=30} onClick={()=>onDraft({...draft,rows:[...rows,copySet(rows)]})} className="pilot-secondary !px-3 !py-2 text-[12px]">Agregar serie</button></div>
      {rows.length===1 && <div className="flex items-end gap-2"><label className="block text-sub">Series iguales<input aria-label="Cantidad de series iguales" className="field mt-1" type="number" inputMode="numeric" min="1" max="30" value={repeat} disabled={locked} onChange={e=>setRepeat(e.target.value)}/></label><button type="button" className="pilot-secondary" disabled={locked || !Number.isInteger(Number(repeat)) || Number(repeat)<1 || Number(repeat)>30} onClick={()=>onDraft({...draft,rows:Array.from({length:Number(repeat)},()=>({...rows[0],sets:'1'}))})}>Repetir</button></div>}
      <StrengthMarks rows={rows.filter(validSet).map(r=>({exercise_id:exercise.id,name:exercise.name,weight_kg:r.weight,reps:Number(r.reps)}))}/>
      <button type="submit" className="btn w-full" disabled={preview || draft.busy || !valid}>{draft.busy?'Guardando…':draft.request?'Verificar y reintentar':`Guardar ${count} ${count===1?'serie':'series'}`}</button>
      {count>30 && <p role="status" className="text-[12px] text-warning">Guarda máximo 30 series a la vez. Reduce la cantidad para continuar.</p>}
      {draft.request && !draft.busy && <p role="status" className="text-[12px] text-warning">No sabemos si se recibió el registro. Reintenta: se verificará antes de guardar para evitar duplicados.</p>}
    </form>}
  </section>
}
