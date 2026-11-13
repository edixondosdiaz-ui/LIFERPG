import { useState } from 'react'
import HealthSections from '../components/HealthSections'
import { HydrationPanel } from '../components/PilotCards'
import RunControls from '../components/RunControls'
import { healthOrder } from '../lib/healthLayout'
import { PRODUCT } from '../lib/product'

export default function HealthPreview(){
  const [order,setOrder]=useState(healthOrder())
  return <div className="space-y-4"><h1 className="text-2xl font-extrabold">Salud</h1><p className="text-[12px] text-sub">Vista de componentes sin datos personales. Puedes reordenar; aquí no se guarda el orden ni se activa la ubicación.</p><HealthSections order={order} onOrder={setOrder}>{ {
    running:<div className="space-y-3"><p className="text-[12px] text-sub">Distancia · —<br/>Tiempo · —<br/>Ritmo · —</p><RunControls disabled session={null} activity="walk"/><details><summary className="flex min-h-[44px] cursor-pointer items-center gap-2 text-[12px] text-sub">ⓘ Cómo medimos tu recorrido</summary><p className="text-[12px] text-sub">Tu recorrido es privado. La ubicación solo se solicita al iniciar o reanudar una actividad.</p></details></div>,
    water:<HydrationPanel total={null} goal={PRODUCT.waterGoalMl} pct={null} preview/>,
    sleep:<label className="block text-sub">Horas dormidas<input className="field mt-1" aria-label="Horas dormidas" type="number" inputMode="decimal" readOnly placeholder="—"/></label>,
    food:<div className="space-y-3"><label className="block text-sub">Nombre del alimento<input className="field mt-1" aria-label="Nombre del alimento" placeholder="Nombre"/></label><button disabled className="btn w-full">Agregar alimento</button></div>
  } }</HealthSections></div>
}
