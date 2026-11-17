import { useState } from 'react'
import { PillarIcon } from '../components/PillarMenu'
import { PILLAR_MENUS } from '../lib/pillarNavigation'
import { HydrationPanel } from '../components/PilotCards'
import RunControls from '../components/RunControls'
import { PRODUCT } from '../lib/product'
export default function HealthPreview(){const [view,setView]=useState('correr');return <div className="space-y-4"><h1 className="text-2xl font-extrabold">Salud</h1><p className="text-xs text-sub">Vista previa sin datos personales ni ubicación.</p><nav className="menu-scroll flex gap-1 overflow-x-auto">{PILLAR_MENUS.salud.map(item=><button key={item.path} className="pilot-secondary shrink-0" aria-pressed={view===item.path} onClick={()=>setView(item.path)}><PillarIcon name={item.icon}/>{item.label}</button>)}</nav><section className="surface space-y-3 p-3">{view==='hidratacion'?<HydrationPanel total={null} goal={PRODUCT.waterGoalMl} pct={null} preview/>:view==='sueno'?<label className="block text-sub">Horas dormidas<input className="field mt-1" type="number" readOnly placeholder="—"/></label>:<><h2 className="font-bold">Running o caminata</h2><p className="text-xs text-sub">Distancia · —<br/>Tiempo · —<br/>Ritmo · —</p><RunControls disabled session={null} activity="walk"/></>}</section></div>}
