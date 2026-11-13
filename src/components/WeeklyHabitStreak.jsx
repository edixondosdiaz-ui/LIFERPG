import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { today, fmtLong } from '../lib/dates'
import { habitWeekRows } from '../lib/habitWeek'
import { palette } from '../design/tokens'

export default function WeeklyHabitStreak({ data, error, reload, preview=false }) {
  const [selected,setSelected]=useState(null)
  const dialog=useRef(null),id=useId()
  const date=data?.today || today(),days=habitWeekRows(data,date)
  const day=days.find(d=>d.date===selected)
  useEffect(()=>{if(selected && !dialog.current.open)dialog.current.showModal()},[selected])
  function close(){dialog.current.close();setSelected(null)}
  return <section aria-labelledby={`${id}-title`} className="surface -mx-2 p-2">
    <div className="flex items-center justify-between gap-2 px-2 pb-3 pt-2"><div><p className="pilot-eyebrow">Tu constancia</p><h2 id={`${id}-title`} className="mt-1 text-base font-extrabold">Racha de hábitos</h2></div><p className="text-right text-xs text-sub"><strong className="block font-display text-2xl text-fire-light">{data?.streak ?? '—'}</strong>{data?.streak===1?'día seguido':'días seguidos'}</p></div>
    <div className="grid grid-cols-7">{days.map(d=>{
      const active=d.habits.length>0,current=d.date===date,gradient=`${id}-${d.date}`
      return <button key={d.date} type="button" aria-label={`${fmtLong(d.date)}: ${active?'hábitos completados':'sin hábitos registrados'}`} aria-current={current?'date':undefined} aria-expanded={selected===d.date} aria-controls={`${id}-detail`} onClick={()=>setSelected(d.date)} className={`flex min-h-[76px] min-w-0 flex-col items-center justify-center rounded-small border py-1 transition duration-ui active:scale-press ${current?'border-pu bg-pu/10':'border-transparent hover:bg-white/5'}`}><span className={`mb-1 text-xs font-bold ${current?'text-pu-light':'text-sub'}`}>{d.initial}</span><svg aria-hidden="true" viewBox="0 0 40 48" className={`h-12 w-10 ${active?'drop-shadow-fire':''}`}><defs><linearGradient id={gradient} x2="0" y2="1"><stop stopColor={palette.fire.light}/><stop offset="1" stopColor={palette.fire.warm}/></linearGradient></defs><path d="M21 2C24 12 34 13 35 25C39 40 29 46 20 46C8 46 3 38 5 29C6 23 10 20 12 16C11 23 16 24 17 20C21 15 17 9 21 2Z" fill={active?`url(#${gradient})`:palette.surface.raised} stroke={active?palette.fire.warm:palette.fire.idle} strokeWidth="1.5"/><text x="20" y="35" textAnchor="middle" fill={active?palette.fire.ink:palette.text.secondary} className="font-display text-xs font-extrabold">{Number(d.date.slice(-2))}</text></svg></button>
    })}</div>
    <p role="status" className="px-2 pb-2 pt-3 text-xs text-sub">{error || (preview?'Vista previa sin datos personales.':!data?'Consultando tus hábitos…':'Toca un día para ver tus hábitos.')}</p>
    {error && <button onClick={reload} className="pilot-secondary mx-2 mb-2">Intentar de nuevo</button>}
    <dialog ref={dialog} id={`${id}-detail`} aria-labelledby={`${id}-date`} onCancel={()=>setSelected(null)} onClick={e=>{if(e.target===dialog.current)close()}} className="w-[calc(100%-32px)] max-w-sm rounded-card border border-stroke bg-card p-5 text-ink backdrop:bg-app/80"><div className="flex items-start justify-between gap-2"><h3 id={`${id}-date`} className="pt-2 font-bold">{selected && fmtLong(selected)}</h3><button onClick={close} aria-label="Cerrar detalle del día" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-small border border-stroke">✕</button></div>{day?.habits.length?<ul className="mt-3 space-y-3">{day.habits.map(h=><li key={`${h.pillar}-${h.habit}`} className="rounded-button bg-panel-inset p-3 text-sm">{h.habit}{h.count>1 && <span className="text-sub"> · {h.count} registros</span>}</li>)}</ul>:<p className="my-4 text-sm text-sub">{preview?'Esta vista no consulta datos personales.':error?'No pudimos consultar los hábitos de este día.':!data?'Consultando tus hábitos…':selected>date?'Este día todavía no llega.':'No registraste hábitos este día.'}</p>}{!preview && selected===date && <Link to="/pilares/habitos" className="pilot-secondary mt-4 w-full" onClick={close}>Registrar un hábito</Link>}</dialog>
  </section>
}
