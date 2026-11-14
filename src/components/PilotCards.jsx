import { Link } from 'react-router-dom'
import { pillarThemes } from '../design/tokens'
import { Ring } from './charts'
import { palette } from '../design/tokens'

export function PillarTile({ pillar, title, path, level, days, action, busy, onQuick, preview=false, wholeLink=false, children }) {
  const content=<><div className="flex items-center justify-between gap-2"><h2 className="text-lg font-extrabold">{title}</h2><span className="pillar-ink text-xs font-bold">Nivel {level ?? '—'}</span></div><p className="mb-3 mt-2 text-xs text-sub">{days===null ? 'Tu actividad semanal aparecerá aquí' : `${days} de 7 días activos esta semana`}</p><div className="pilot-bar"><div className="pillar-fill h-full rounded-full transition-all duration-ui" style={{width:`${(days ?? 0)/7*100}%`}}/></div></>
  if(wholeLink && !preview)return <Link to={path} className={`pilot-pillar block ${pillarThemes[pillar].classes}`} aria-label={`Entrar a ${title}`}>{content}<span className="pillar-action"><span>{action}</span><span aria-hidden="true" className="pillar-ink">↗</span></span></Link>
  return <section className={`pilot-pillar ${pillarThemes[pillar].classes}`}>
    {preview ? <div>{content}</div> : <Link to={path} className="block rounded-small" aria-label={`Abrir ${title}`}>{content}</Link>}
    <button disabled={busy || preview} onClick={onQuick} className="pillar-action"><span>{action}</span><span aria-hidden="true" className="pillar-ink">↗</span></button>
    {children}
  </section>
}

export function HydrationPanel({ total, goal, pct, onAdd, children, preview=false }) {
  const liters=n=>(n/1000).toLocaleString('es-CO',{maximumFractionDigits:2})
  return <><div className="flex items-center justify-between"><div><p className="pilot-eyebrow">Bienestar diario</p><h2 className="mt-1 text-xl font-extrabold">Agua</h2></div><svg aria-hidden="true" className="h-7 w-7 text-hydration" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3S5 11 5 15a7 7 0 0014 0c0-4-7-12-7-12Z"/><path d="M8 15a4 4 0 004 4"/></svg></div>
    <div className="flex items-center justify-center gap-6 py-2"><Ring pct={pct ?? 0} color={palette.hydration} size={120} stroke={8}><div><p className="font-display text-3xl font-extrabold tabular-nums">{pct===null?'—':`${Math.min(pct,999)}%`}</p><p className="mt-1 text-[10px] text-sub">de tu meta</p></div></Ring><div className="min-w-0"><p className="font-display text-[26px] font-extrabold tabular-nums">{total===null?'—':liters(total)} <span className="text-sm font-medium text-sub">L</span></p><p className="mt-1 text-xs text-sub">Meta de {liters(goal)} L</p><p className="mt-3 max-w-[130px] text-xs leading-relaxed text-sub">{total===null?'Tu registro se mostrará aquí.':total>=goal?'Meta cumplida. Bien hecho.':`Te faltan ${liters(goal-total)} L hoy.`}</p></div></div>
    <div className="grid grid-cols-3 gap-2">{[250,500,750].map(ml=><button type="button" key={ml} disabled={preview} onClick={()=>onAdd(ml)} className="pilot-secondary !px-1 text-hydration disabled:opacity-70">+{ml} ml</button>)}</div>
    {children}
  </>
}
