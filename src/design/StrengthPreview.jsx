import { useState } from 'react'
import StrengthSetEditor from '../components/StrengthSetEditor'
import { DAY_INITIALS, emptySet, weekdayInBogota } from '../lib/strengthRoutine'

// Solo presentación: no consulta Supabase, no simula marcas ni guarda registros.
export default function StrengthPreview(){
  const [draft,setDraft]=useState({rows:[emptySet()],busy:false,request:null})
  const day=weekdayInBogota()
  return <div className="space-y-4"><p className="text-[12px] text-sub">Vista de componentes sin datos personales. Guardar está deshabilitado.</p><section className="surface p-3"><h1 className="font-bold">Entrenamiento de hoy</h1><p className="mt-3 text-[28px]">—:—</p></section><div className="grid grid-cols-7">{DAY_INITIALS.map((initial,i)=><span key={i} className={`flex min-h-[44px] items-center justify-center rounded-small border ${day===i+1?'border-pu text-pu-light':'border-transparent text-sub'}`}>{initial}</span>)}</div><label className="block text-sub">Seleccionar rutina<select disabled className="field mt-1"><option>Sin datos personales</option></select></label><a href="#preview-add-exercise" className="flex min-h-[44px] items-center text-[12px] text-pu-light">Ir a agregar ejercicio ↓</a><details className="surface p-3"><summary className="flex min-h-[44px] cursor-pointer items-center font-bold">Marcas del último entrenamiento</summary><p className="mt-3 text-[12px] text-sub">Sin marcas aún. Registra tu primer entrenamiento para comparar la próxima vez.</p></details><StrengthSetEditor exercise={{id:'preview',name:'Registro de series · vista previa'}} draft={draft} onDraft={setDraft} preview/><button id="preview-add-exercise" type="button" disabled className="pilot-secondary w-full scroll-mt-4">Agregar ejercicio</button><section className="surface p-3"><h2 className="font-bold">Resumen del día</h2><p className="mt-3 text-[12px] text-sub">Volumen total · —<br/>Series totales · —</p></section></div>
}
