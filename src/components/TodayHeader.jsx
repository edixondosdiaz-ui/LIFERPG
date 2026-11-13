import Avatar from './Avatar'
import { levelProgress } from '../lib/xp'

export function TodayIdentity({ username }) {
  return <div className="flex min-w-0 items-center gap-2.5"><span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-button border border-pu/40 bg-pu/10 font-display text-lg font-extrabold text-pu-light">LR</span><div className="min-w-0"><h1 className="font-display text-base font-extrabold">Life<span className="text-pu-light">RPG</span></h1><p className="max-w-[125px] truncate text-xs text-sub">{username ? `Hola, ${username}` : 'Cada día cuenta'}</p></div></div>
}

export function XPAvatar({ profile, equipped }) {
  const progress=profile ? levelProgress(profile.xp ?? 0) : null
  return <span className="relative flex h-[60px] w-[60px] items-center justify-center"><svg aria-hidden="true" viewBox="0 0 60 60" className="absolute inset-0 h-full w-full -rotate-90" fill="none"><circle cx="30" cy="30" r="27" className="stroke-pu/25" strokeWidth="3"/><circle cx="30" cy="30" r="27" className="stroke-pu-light transition-all duration-ui" strokeWidth="3" strokeLinecap="round" pathLength="100" strokeDasharray={`${progress?.pct ?? 0} 100`}/></svg><span className="overflow-hidden rounded-full border border-pu"><Avatar avatar={profile?.avatar} equipped={equipped} view="head" size={44}/></span><span className="absolute -bottom-1 rounded-full border border-pu/50 bg-panel-inset px-1.5 py-0.5 font-display text-[10px] font-bold text-ink">Nv. {progress?.level ?? '—'}</span></span>
}
