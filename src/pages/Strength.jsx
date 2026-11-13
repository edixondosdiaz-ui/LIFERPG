import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import * as ex from '../services/experience'
import RoutineWorkout from '../components/RoutineWorkout'
import { palette } from '../design/tokens'
import { Card, PillarHeader, Toast, useToast, xpText } from '../components/ui'
import { clock, fmtDuration } from '../lib/dates'

export default function Strength(){
  const { refreshProfile } = useAuth()
  const [start, setStart] = useState(null)
  const [timerReady, setTimerReady] = useState(false)
  const [timerBusy, setTimerBusy] = useState(false)
  const [summary, setSummary] = useState(null)
  const [revision,setRevision]=useState(0)
  const loadStats=async()=>setRevision(v=>v+1)
  const [,tick]=useState(0)
  const [toast,notify]=useToast()
  useEffect(() => { ex.getTimer('workout').then(setStart).catch(e => notify(e.message,'err')).finally(() => setTimerReady(true)) }, [])
  useEffect(()=>{if(!start)return;const id=setInterval(()=>tick(n=>n+1),1000);return()=>clearInterval(id)},[start])
  async function startWorkout() {
    setTimerBusy(true)
    try { setStart(await ex.timerAction('workout','start')); setSummary(null) } catch(e) { notify(e.message,'err') } finally { setTimerBusy(false) }
  }
  async function finishWorkout() {
    setTimerBusy(true)
    try { const r = await ex.timerAction('workout','finish'); setStart(null); setSummary(r); await Promise.all([loadStats(), refreshProfile()]); notify(`Entrenamiento guardado · ${fmtDuration(r.seconds)}${xpText(r)}`, 'pr') }
    catch (err) { notify(err.message, 'err') } finally { setTimerBusy(false) }
  }


  const elapsed=ex.timerSeconds(start)
  return <div className="space-y-5">
    <PillarHeader pillar="fuerza" title="Fuerza" kicker="Entrenamiento" color={palette.strength} icon="⚔️"/>
      <Card className="!bg-card" title="Entrenamiento de hoy"
        right={start ? <span className="rounded-full bg-error/15 px-2.5 py-1 text-[10px] font-extrabold text-error">● En curso</span> : null}>
        {start ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-4xl font-black tabular-nums tracking-tight">{clock(elapsed)}</p>
            <div className="space-y-2"><button disabled={timerBusy} onClick={finishWorkout} className="btn !bg-none !bg-error-strong !shadow-none">Terminar</button><button disabled={timerBusy} className="block w-full text-xs text-sub" onClick={async()=>{if(!confirm('¿Descartar el cronómetro? Las series registradas se conservan.'))return;setTimerBusy(true);try{await ex.timerAction('workout','discard');setStart(null)}catch(e){notify(e.message,'err')}finally{setTimerBusy(false)}}}>Descartar cronómetro</button></div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-sub">Inicia el cronómetro para medir el tiempo total de tu sesión.</p>
            <button disabled={!timerReady || timerBusy} onClick={startWorkout} className="btn w-full">Empezar entrenamiento</button>
          </div>
        )}
        {summary && <div role="status" className="rounded-2xl bg-pu/10 p-4 text-sm"><b>Entrenamiento terminado</b><p>{fmtDuration(summary.seconds)} · {Math.round(summary.volume).toLocaleString('es-CO')} kg de volumen</p><p>{summary.personal_records} récords personales · +{summary.total_xp} XP en Fuerza durante la sesión</p></div>}
      </Card>


    <RoutineWorkout revision={revision} notify={notify}/>
    <Toast msg={toast}/>
  </div>
}
