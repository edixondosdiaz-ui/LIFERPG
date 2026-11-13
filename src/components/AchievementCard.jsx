import { useId } from 'react'

export function AchievementPresentation({state,pct,name,description,icon,progressLabel,rewardLabel,dateLabel,dateTime}){
  const id=useId()
  const done=state==='done',locked=state==='lock'
  return <article className={`rounded-button border bg-panel p-3.5 shadow-card ${done?'border-gold':locked?'border-stroke-glass':'border-pu/60'}`} aria-labelledby={`${id}-name`}>
    <div className="flex items-start gap-3">
      <span aria-hidden="true" className={`grid h-12 w-12 shrink-0 place-items-center rounded-button border bg-panel-inset text-2xl ${done?'border-gold shadow-selected':locked?'border-stroke-glass grayscale':'border-pu/40'}`}>{icon}</span>
      <div className="min-w-0 flex-1"><h3 id={`${id}-name`} className={`break-words text-sm font-extrabold ${locked?'text-sub':'text-ink'}`}>{name}</h3><p className="mt-1 break-words text-[12px] leading-relaxed text-sub">{description}</p><p className={`mt-2 text-[12px] font-bold ${done?'text-gold':locked?'text-sub':'text-pu-light'}`}>{done?'✓ Completado':locked?'Bloqueado':'En curso'}</p>{rewardLabel && <p className="mt-1 text-[12px] text-sub">{rewardLabel}</p>}{done && <p className="mt-1 text-[12px] text-sub">{dateTime?<time dateTime={dateTime}>Obtenido el {dateLabel}</time>:dateLabel || 'Fecha de obtención no disponible'}</p>}</div>
    </div>
    <div className="mt-3 flex items-center gap-3"><div role="progressbar" aria-labelledby={`${id}-name`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={progressLabel} className="h-achievement-bar min-w-0 flex-1 overflow-hidden rounded-full bg-panel-inset"><div className={`h-full origin-left animate-achievement-fill rounded-full ${done?'bg-gold':locked?'bg-sub':'bg-pu-light'}`} style={{width:`${pct}%`}}/></div><span className={`shrink-0 text-[12px] font-bold tabular-nums ${done?'text-gold':locked?'text-sub':'text-pu-light'}`}>{progressLabel}</span></div>
  </article>
}

export default function AchievementCard({a}){
  // Se conserva el cálculo y la clasificación existentes; aquí solo se presentan.
  const pct=a.unlocked?100:Math.min(100,Math.round((a.progress/a.target)*100))
  const state=a.unlocked?'done':a.progress>0?'prog':'lock'
  const date=a.unlocked_at?new Date(a.unlocked_at):null
  const validDate=date && !Number.isNaN(date.getTime())
  return <AchievementPresentation state={state} pct={pct} name={a.name} description={a.description} icon={a.icon} progressLabel={`${a.unlocked?a.target:a.progress}/${a.target}`} rewardLabel={a.reward_coins!=null?`+${a.reward_coins} monedas`:null} dateLabel={validDate?date.toLocaleDateString('es-CO',{timeZone:'America/Bogota',day:'numeric',month:'short',year:'numeric'}):null} dateTime={validDate?date.toISOString():null}/>
}
