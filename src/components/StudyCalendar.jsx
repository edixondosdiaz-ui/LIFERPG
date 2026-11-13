import { useEffect, useId, useRef, useState } from 'react'
import { today, fmtLong } from '../lib/dates'
import { studyMonthSessions } from '../services/studyCalendar'
import { STUDY_WEEKDAYS, STUDY_LEVEL_LABELS, shiftStudyMonth, studyMonthDays, studyMonthLabel, studyDate, studyLevel, studyDaySummary, studyMonthSummary } from '../lib/studyCalendar'

const COLORS=['bg-study-0','bg-study-1','bg-study-2','bg-study-3','bg-study-4']
export default function StudyCalendar({revision,preview=false}){
  const [month,setMonth]=useState(()=>today().slice(0,7)),[rows,setRows]=useState(null),[error,setError]=useState(''),[selected,setSelected]=useState(null),[retry,setRetry]=useState(0)
  const dialog=useRef(null),id=useId()
  const [todayDate,setTodayDate]=useState(today)
  useEffect(()=>{const refresh=()=>setTodayDate(today());const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh)}},[])
  useEffect(()=>{
    let live=true;setRows(null);setError('')
    if(preview)return()=>{live=false}
    studyMonthSessions(month).then(data=>{if(live)setRows(data)}).catch(e=>{console.error('[Calendario de estudio]',e);if(live)setError('No pudimos cargar este mes. Intenta de nuevo.')})
    return()=>{live=false}
  },[month,revision,retry,preview])
  useEffect(()=>{if(selected && !dialog.current.open)dialog.current.showModal()},[selected])
  const daily=new Map()
  for(const row of rows || []){const date=studyDate(row);if(!daily.has(date))daily.set(date,[]);daily.get(date).push(row)}
  const summary=rows?studyMonthSummary(rows):null,selectedRows=daily.get(selected) || [],detail=studyDaySummary(selectedRows)
  function close(){dialog.current.close();setSelected(null)}
  function changeMonth(next){setMonth(next);setSelected(null)}
  function selectMonth(value){if(/^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value.slice(0,4)!=='0000')changeMonth(value)}
  const loaded=rows!==null
  return <section className="surface -mx-2 space-y-3 p-2" aria-labelledby={`${id}-title`} aria-busy={!preview && !loaded && !error}>
    <h2 id={`${id}-title`} className="px-2 pt-2 font-bold">Calendario de actividad</h2>
    <div className="flex items-center justify-between gap-1"><button type="button" className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-small border border-stroke text-pu-light" aria-label="Mes anterior" disabled={month==='0001-01'} onClick={()=>changeMonth(shiftStudyMonth(month,-1))}>←</button><h3 aria-live="polite" className="min-w-0 text-center font-display text-[16px] font-bold capitalize">{studyMonthLabel(month)}</h3><button type="button" className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-small border border-stroke text-pu-light" aria-label="Mes siguiente" disabled={month==='9999-12'} onClick={()=>changeMonth(shiftStudyMonth(month,1))}>→</button></div>
    <div className="flex items-end justify-between gap-2 px-1"><button type="button" className="pilot-secondary !px-3 !py-2 text-[12px]" onClick={()=>changeMonth(today().slice(0,7))}>Hoy</button><label className="block min-w-0 flex-1 text-[12px] text-sub"><span className="block">Mes y año</span><input aria-label="Ir a mes y año" className="field mt-1 !min-h-[44px] !px-2 !py-2 !text-[16px]" type="month" min="0001-01" max="9999-12" value={month} onInput={e=>selectMonth(e.currentTarget.value)} onChange={e=>selectMonth(e.target.value)}/></label></div>
    <div className="grid grid-cols-3 gap-1 px-1">{[['Días activos',summary?.activeDays],['Minutos',summary?.minutes],['Mejor racha',summary?.bestStreak]].map(([label,value])=><p key={label} className="rounded-small bg-panel-inset p-2 text-[11px] text-sub"><b className="block font-display text-[18px] tabular-nums text-ink">{value?.toLocaleString('es-CO') ?? '—'}</b>{label}</p>)}</div>
    <div aria-label={studyMonthLabel(month)}><div className="grid grid-cols-7 text-center text-[12px] font-bold text-sub">{STUDY_WEEKDAYS.map((letter,i)=><span key={i} className="py-2" aria-label={['lunes','martes','miércoles','jueves','viernes','sábado','domingo'][i]}>{letter}</span>)}</div><div className="grid grid-cols-7">{studyMonthDays(month).map((date,index)=>{
      if(!date)return <span key={`blank-${index}`} aria-hidden="true"/>
      const total=studyDaySummary(daily.get(date) || []).minutes,current=date===todayDate
      return <button key={date} type="button" onClick={()=>setSelected(date)} aria-current={current?'date':undefined} aria-expanded={selected===date} aria-controls={`${id}-detail`} aria-label={`${fmtLong(date)}, ${date.slice(0,4)}: ${loaded?`${total} minutos`:'actividad no consultada'}`} className={`flex min-h-[44px] min-w-0 items-center justify-center rounded-small border font-display text-[14px] font-semibold tabular-nums transition duration-ui active:scale-press ${COLORS[studyLevel(total)]} ${current?'border-2 border-pu-light':'border-panel'} ${total>0?'text-ink':'text-sub'}`}>{Number(date.slice(-2))}</button>
    })}</div></div>
    <ul aria-label="Intensidad de estudio" className="flex flex-wrap gap-x-3 gap-y-2 px-1 text-[10px] text-sub">{STUDY_LEVEL_LABELS.map((label,i)=><li key={label} className="flex items-center gap-1"><span aria-hidden="true" className={`h-3 w-3 rounded-sm border border-stroke-glass ${COLORS[i]}`}/>{label}</li>)}</ul>
    <p role="status" className="px-1 pb-1 text-[12px] text-sub">{preview?'Vista de calendario sin datos personales.':error || (!loaded?'Consultando sesiones…':'Toca una fecha para revisar tus sesiones.')}</p>{error && <button type="button" className="pilot-secondary" onClick={()=>setRetry(v=>v+1)}>Intentar de nuevo</button>}
    <dialog ref={dialog} id={`${id}-detail`} onCancel={()=>setSelected(null)} onClick={e=>{if(e.target===dialog.current)close()}} aria-labelledby={`${id}-date`} className="m-auto max-h-[85dvh] w-[calc(100%-24px)] max-w-sm overflow-y-auto rounded-card border border-stroke bg-card p-4 text-ink backdrop:bg-app/80"><div className="flex items-start justify-between gap-2"><h3 id={`${id}-date`} className="pt-2 font-bold">{selected && `${fmtLong(selected)} de ${selected.slice(0,4)}`}</h3><button type="button" className="h-[44px] w-[44px] shrink-0 rounded-small border border-stroke" aria-label="Cerrar sesiones del día" onClick={close}>✕</button></div>{preview?<p className="mt-3 text-sm text-sub">Esta vista no consulta sesiones de una cuenta.</p>:!loaded?<p className="mt-3 text-sm text-sub">{error || 'Consultando sesiones…'}</p>:<><div className="my-4 grid grid-cols-2 gap-2 text-[12px] text-sub"><p>Pomodoros completados<b className="block text-lg text-ink">{detail.pomodoros}</b></p><p>Minutos totales<b className="block text-lg text-ink">{detail.minutes}</b></p><p>XP registrado<b className="block text-lg text-pu-light">{detail.unknownXp && !detail.xp?'—':detail.xp}{detail.unknownXp && detail.xp?' + no disponible':''}</b></p></div>{detail.unknownXp>0 && <p className="mb-3 text-[12px] text-sub">El XP de {detail.unknownXp} {detail.unknownXp===1?'sesión antigua no quedó registrado':'sesiones antiguas no quedó registrado'}. No lo estimamos.</p>}{!selectedRows.length?<p className="text-sm text-sub">No hay sesiones guardadas este día.</p>:<ul className="space-y-2">{selectedRows.map(s=><li key={s.id} className="rounded-button bg-panel-inset p-3"><p className="break-words text-sm font-bold">{s.topic}</p><p className="mt-1 break-words text-[12px] text-sub">{s.mode==='pomodoro'?'Pomodoro':'Sesión libre'} · {s.category} · {s.minutes} min · {s.xp_awarded==null?'XP no disponible':`${s.xp_awarded} XP`}</p></li>)}</ul>}<p className="mt-3 text-[11px] text-sub">Se cuentan solo Pomodoros guardados. Las fechas corresponden a Colombia.</p></>}</dialog>
  </section>
}
