import { useEffect, useRef, useState } from 'react'
import * as ex from '../services/experience'
import * as px from '../services/pillars'
import { Card, Chip } from './ui'
import { clock } from '../lib/dates'
import { PRODUCT } from '../lib/product'

export default function StudyFocus({ cats, last, onSaved, notify, children }) {
  const [timer, setTimer] = useState(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const working = useRef(false)
  const autoAttempted = useRef(false)
  const [cfg, setCfg] = useState({ mode:'pomodoro', focus:PRODUCT.focusMinutes, brk:PRODUCT.breakMinutes, topic:'', category:last?.category || 'General' })
  const [minutes, setMinutes] = useState(String(PRODUCT.focusMinutes))
  const [, tick] = useState(0)
  useEffect(() => {
    let live = true
    Promise.all([ex.getTimer('study'),ex.getTimer('break')]).then(([s,b])=>{ if (live) { setTimer(s || b); if (s) setCfg(s.config) } }).catch(e=>notify(e.message,'err')).finally(()=>{if(live) setReady(true)})
    return ()=>{live=false}
  }, [notify])
  async function act(action) {
    if (working.current) return
    working.current=true; setBusy(true)
    try {
      const kind=timer?.kind || 'study'
      if (action==='start') setTimer(await ex.timerAction('study','start',{...cfg,topic:cfg.topic.trim() || 'Estudio'}))
      else if (action==='finish') {
        const result=await ex.timerAction(kind,'finish')
        setTimer(null)
        if (kind==='study') {
          await onSaved()
          notify(`Sesión guardada · ${Math.floor(result.seconds/60)} min · +${result.xp_awarded || 0} XP`)
          if (timer.config.mode==='pomodoro') setTimer(await ex.timerAction('break','start',timer.config))
        }
      } else if (action==='discard') { await ex.timerAction(kind,'discard'); setTimer(null) }
      else setTimer(await ex.timerAction(kind,action))
    } catch(e) { notify(e.message,'err') } finally {working.current=false;setBusy(false)}
  }
  const elapsed=ex.timerSeconds(timer)
  const isBreak=timer?.kind==='break'
  const target=timer ? (isBreak ? timer.config.brk*60 : timer.config.mode==='pomodoro' ? timer.config.focus*60 : null) : cfg.focus*60
  useEffect(()=>{autoAttempted.current=false},[timer?.kind,timer?.running_since])
  useEffect(()=>{
    if (!timer?.running_since) return
    const id=setInterval(()=>{ tick(n=>n+1); if(target && ex.timerSeconds(timer)>=target && !autoAttempted.current) {autoAttempted.current=true;act('finish')} },1000)
    return ()=>clearInterval(id)
  },[timer,target,onSaved])
  async function manual(e) {
    e.preventDefault()
    if(working.current) return
    working.current=true;setBusy(true)
    try { const r=await px.logStudy({topic:cfg.topic.trim() || 'Estudio',category:cfg.category,mode:'libre',minutes:Number(minutes)}); await onSaved();notify(`Registro manual guardado · +${r.xp_awarded || 0} XP`) } catch(e) {notify(e.message,'err')} finally {working.current=false;setBusy(false)}
  }
  return <div className="space-y-4"><section className="surface sticky top-20 z-10 space-y-3 !bg-card p-4"><h2 className="font-bold">{isBreak ? 'Descanso' : 'Enfócate'}</h2>
    <p className="text-center text-5xl font-black tabular-nums">{clock(timer ? target ? Math.max(0,target-elapsed) : elapsed : cfg.mode==='pomodoro' ? cfg.focus*60 : 0)}</p>
    {timer ? <><p className="text-center text-xs text-sub">{timer.config.category} · {timer.running_since ? 'En curso' : 'En pausa'}</p><div className="grid grid-cols-2 gap-2"><button className="btn" disabled={busy} onClick={()=>act(timer.running_since?'pause':'resume')}>{timer.running_since?'Pausar':'Reanudar'}</button><button className="btn" disabled={busy} onClick={()=>act('finish')}>{isBreak?'Terminar descanso':'Terminar y guardar'}</button></div><button className="text-xs text-sub" disabled={busy} onClick={()=>{if(confirm('¿Descartar el temporizador sin guardar?'))act('discard')}}>Descartar</button></> : <button className="btn w-full" disabled={!ready || busy} onClick={()=>act('start')}>Iniciar {cfg.mode==='pomodoro'?'Pomodoro':'sesión libre'}</button>}
  </section><Card title="Configurar sesión">
    {!timer && <><label className="block text-xs text-sub">Modo<select className="field mt-2" value={cfg.mode} onChange={e=>setCfg({...cfg,mode:e.target.value})}><option value="pomodoro">Pomodoro</option><option value="libre">Cronómetro libre</option></select></label><input className="field" aria-label="Tema de estudio" placeholder="Tema (opcional)" maxLength={80} value={cfg.topic} onChange={e=>setCfg({...cfg,topic:e.target.value})}/><div className="flex flex-wrap gap-2">{cats.map(c=><Chip key={c} active={cfg.category===c} color="#38bdf8" onClick={()=>setCfg({...cfg,category:c})}>{c}</Chip>)}</div><input className="field" aria-label="Otra categoría" placeholder="Otra categoría" maxLength={40} value={cats.includes(cfg.category)?'':cfg.category} onChange={e=>setCfg({...cfg,category:e.target.value})}/>{cfg.mode==='pomodoro' && <div className="grid grid-cols-2 gap-2">{[['focus','Enfoque (min)',120],['brk','Descanso (min)',60]].map(([k,label,max])=><label key={k} className="text-xs text-sub">{label}<input className="field mt-2" type="number" min={1} max={max} required value={cfg[k]} onChange={e=>setCfg({...cfg,[k]:Math.max(1,Math.min(max,Number(e.target.value)||1))})}/></label>)}</div>}</>}
    <p className="text-xs text-sub">El servidor cuenta el tiempo enfocado; las pausas y los descansos no dan XP.</p>
  </Card><Card title="Registro manual rápido"><form onSubmit={manual} className="space-y-3"><p className="text-xs text-sub">Para una actividad que hiciste sin cronómetro. Categoría: {cfg.category || 'General'}.</p><label className="block text-xs">Minutos<input className="field mt-2" type="number" min={1} max={720} required value={minutes} onChange={e=>setMinutes(e.target.value)}/></label><button disabled={busy} className="btn w-full">Guardar sesión manual</button></form></Card>{children}</div>
}
