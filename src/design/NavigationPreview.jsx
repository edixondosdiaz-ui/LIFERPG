import { useState } from 'react'
import { MemoryRouter, Route, Routes, Outlet, useNavigate } from 'react-router-dom'
import PillarMenu from '../components/PillarMenu'
import { PILLAR_MENUS } from '../lib/pillarNavigation'
import { TutorialView } from '../pages/Tutorial'
import { TUTORIAL_STEPS } from '../lib/tutorial'
function Shell({pillar}){const navigate=useNavigate();return <div className="space-y-4"><PillarMenu pillar={pillar}/><Outlet/><button className="pilot-secondary" onClick={()=>navigate(-1)}>Atrás del historial</button></div>}
export function TutorialPreview(){const [index,setIndex]=useState(0);return <TutorialView index={index} onSkip={()=>setIndex(0)} onBack={()=>setIndex(v=>Math.max(0,v-1))} onNext={()=>setIndex(v=>Math.min(TUTORIAL_STEPS.length-1,v+1))}/>}
export default function NavigationPreview(){const [pillar,setPillar]=useState('finanzas');return <div className="space-y-4"><p className="text-xs text-sub">Prueba de navegación sin datos personales.</p><select className="field" aria-label="Pilar de prueba" value={pillar} onChange={e=>setPillar(e.target.value)}>{Object.keys(PILLAR_MENUS).map(p=><option key={p}>{p}</option>)}</select><MemoryRouter key={pillar} initialEntries={['/pilares/'+pillar+'/'+PILLAR_MENUS[pillar][0].path]}><Routes><Route path={'/pilares/'+pillar} element={<Shell pillar={pillar}/>}>{PILLAR_MENUS[pillar].map(item=><Route key={item.path} path={item.path} element={<section className="surface p-4"><h2 className="font-bold">{item.label}</h2><p className="text-xs text-sub">Esta vista no consulta registros.</p></section>}/>)}</Route></Routes></MemoryRouter></div>}
