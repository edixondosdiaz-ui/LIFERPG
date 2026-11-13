import StudyCalendar from '../components/StudyCalendar'
import RankingPreview from './RankingPreview'
import HealthPreview from './HealthPreview'
import AchievementsPreview from './AchievementsPreview'
import StrengthPreview from './StrengthPreview'
import COPInput from '../components/COPInput'
import { useState } from 'react'
import { PillarTile } from '../components/PilotCards'
import { TodayIdentity, XPAvatar } from '../components/TodayHeader'
import WeeklyHabitStreak from '../components/WeeklyHabitStreak'

const titles = {fuerza:['Fuerza','Empezar la rutina de hoy'],vitalidad:['Salud','+250 ml de agua'],intelecto:['Educación','Iniciar Pomodoro'],finanzas:['Finanzas','Registrar movimiento']}
export default function Preview() {
  const [screen,setScreen]=useState(new URLSearchParams(location.search).get('pantalla') || 'hoy')
  const [amount,setAmount]=useState('')
  const compact=new URLSearchParams(location.search).has('compact')
  return <main className={`visual-pilot min-h-screen text-ink ${compact?'':'px-3 py-6'}`}>
    {!compact && <div className="mx-auto mb-6 max-w-4xl space-y-3"><p className="pilot-eyebrow">LifeRPG · Piloto visual</p><h1 className="text-2xl font-extrabold">Más profundidad. La misma identidad.</h1><p className="max-w-2xl text-sm leading-relaxed text-sub">Vista previa de componentes reales, sin datos de usuario ni registros simulados. Los guiones representan información que vendrá de Supabase.</p><div className="flex flex-wrap gap-3">{['hoy','salud','finanzas','fuerza','logros','ranking','estudio'].map(id=><button key={id} onClick={()=>setScreen(id)} className={screen===id?'btn':'pilot-secondary'}>{id==='hoy'?'Hoy':id==='salud'?'Salud':id==='finanzas'?'Finanzas':id==='fuerza'?'Fuerza':id==='logros'?'Logros':id==='ranking'?'Ranking':'Estudio'}</button>)}</div></div>}
    <section className={compact?"mx-auto max-w-md":"pilot-preview-phone"}><header className="flex h-header items-center justify-between border-b border-stroke-glass bg-header px-4"><TodayIdentity/><XPAvatar/></header><div className={`pillar-page space-y-4 px-4 py-5 ${screen==='finanzas'?'finance-page':''}`}>
      {screen==='estudio'?<StudyCalendar preview/>:screen==='ranking'?<RankingPreview/>:screen==='salud'?<HealthPreview/>:screen==='logros'?<AchievementsPreview/>:screen==='fuerza'?<StrengthPreview/>:screen==='hoy'?<><WeeklyHabitStreak preview/>{Object.entries(titles).map(([pillar,[title,action]])=><PillarTile key={pillar} pillar={pillar} title={title} level={null} days={null} action={action} preview/>)}</>:screen==='finanzas'?<><h1 className="text-2xl font-extrabold">Finanzas</h1><section className="surface space-y-3 p-4"><p className="text-[12px] text-sub">Balance del mes</p><p className="text-[28px] font-extrabold">—</p><p className="text-[12px] text-sub">Ahorro del mes · —</p></section><section className="surface space-y-3 p-4"><h2 className="font-bold">Nuevo movimiento</h2><form className="space-y-3" onSubmit={e=>e.preventDefault()}><COPInput label="Monto en COP" value={amount} onChange={setAmount}/><label className="block text-sub">Descripción (opcional)<input className="field mt-1" placeholder="Descripción"/></label><label className="block text-sub">Fecha<input className="field mt-1" type="date"/></label><button disabled className="btn w-full">Registrar movimiento</button></form><p className="text-xs text-sub">Vista previa: no guarda datos ni consulta cuentas.</p></section></>:<HealthPreview/>}
    </div><footer className="grid grid-cols-4 gap-2 border-t border-stroke-glass p-4 text-center text-[11px] text-sub"><b className="text-pu-light">Hoy</b><span>Progreso</span><span>Ranking</span><span>Tienda</span></footer></section>
  </main>
}
