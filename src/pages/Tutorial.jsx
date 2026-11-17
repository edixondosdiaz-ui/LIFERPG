import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import { TUTORIAL_STEPS } from '../lib/tutorial'
import { PillarIcon } from '../components/PillarMenu'
export default function Tutorial({onboarding=false}){
 const {refreshProfile}=useAuth(),navigate=useNavigate(),[index,setIndex]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('')
 async function finish(skipped){if(busy)return;setBusy(true);setError('');try{const {error}=await supabase.rpc('finish_tutorial',{p_skipped:skipped});if(error)throw error;await refreshProfile();navigate(onboarding?'/':'/configuracion',{replace:true})}catch{setError('No pudimos guardar tu elección. Intenta de nuevo.')}finally{setBusy(false)}}
 return <TutorialView index={index} busy={busy} error={error} onSkip={()=>finish(true)} onBack={()=>setIndex(v=>v-1)} onNext={()=>index===TUTORIAL_STEPS.length-1?finish(false):setIndex(v=>v+1)}/>
}
export function TutorialView({index,busy=false,error='',onSkip,onBack,onNext}){
 const step=TUTORIAL_STEPS[index]
 return <section className="mx-auto flex w-full max-w-md flex-col gap-4 p-4" aria-label="Tutorial de bienvenida"><div className="flex items-center justify-between gap-2"><p className="text-xs text-sub">{index+1} de {TUTORIAL_STEPS.length}</p><button className="min-h-[44px] text-sm text-pu-light" disabled={busy} onClick={onSkip}>Omitir</button></div><div className="pilot-bar" role="progressbar" aria-label="Avance del tutorial" aria-valuemin={1} aria-valuemax={TUTORIAL_STEPS.length} aria-valuenow={index+1}><div className="h-full rounded-full bg-pu transition-all duration-ui" style={{width:`${(index+1)/TUTORIAL_STEPS.length*100}%`}}/></div><div className="surface space-y-4 p-5" aria-live="polite"><PillarIcon name={step.icon} className="h-12 w-12 text-pu-light"/><h1 className="text-xl font-extrabold">{step.title}</h1>{step.lines.map(line=><p key={line} className="text-sm leading-relaxed text-sub">{line}</p>)}</div>{error && <p role="alert" className="text-sm text-error">{error}</p>}<div className="grid grid-cols-2 gap-2"><button className="pilot-secondary" disabled={index===0 || busy} onClick={onBack}>Atrás</button><button className="btn" disabled={busy} onClick={onNext}>{busy?'Guardando…':index===TUTORIAL_STEPS.length-1?'Empezar':'Siguiente'}</button></div></section>
}
