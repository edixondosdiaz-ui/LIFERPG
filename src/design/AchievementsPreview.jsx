import { AchievementPresentation } from '../components/AchievementCard'

export default function AchievementsPreview(){
  const badge=<svg viewBox="0 0 24 24" className="h-7 w-7 text-gold" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 3h8v7a4 4 0 01-8 0V3ZM8 5H4v3a4 4 0 004 4m8-7h4v3a4 4 0 01-4 4M12 14v6m-4 1h8"/></svg>
  return <div className="space-y-4"><h1 className="text-xl font-extrabold">Logros · sistema visual</h1><p className="text-[12px] leading-relaxed text-sub">Estados del componente, sin consultar ni guardar logros. La barra intermedia ilustra el diseño; los guiones no representan avance de una cuenta.</p>{[['prog','En curso',50],['done','Completado',100],['lock','Bloqueado',0]].map(([state,label,pct])=><AchievementPresentation key={state} state={state} pct={pct} name={`${label} · vista de diseño`} description="El nombre y los detalles quedan sobre una superficie sólida. El color del avance ocupa su propia fila." icon={badge} progressLabel="—/—" dateLabel="Fecha de obtención · —"/>)}</div>
}
