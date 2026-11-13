import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Avatar from './Avatar'
import { TodayIdentity, XPAvatar } from './TodayHeader'
import { levelProgress } from '../lib/xp'

const Icon = ({ children }) => (
  <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
)

const tabs = [
  { to: '/', label: 'Hoy', icon: <Icon><path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" /></Icon> },
  { to: '/progreso', label: 'Progreso', icon: <Icon><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" /></Icon> },
  { to: '/ranking', label: 'Ranking', icon: <Icon><path d="M5 20v-8M12 20V4M19 20v-6" /></Icon> },
  { to: '/tienda', label: 'Tienda', icon: <Icon><path d="M5 7h14l1 14H4L5 7zM9 7V5a3 3 0 016 0v2" /></Icon> },
]

export default function Layout() {
  const { profile, equipped, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const menu = useRef(null)
  const location = useLocation()
  const isToday=location.pathname==='/'
  const progress=levelProgress(profile?.xp ?? 0)
  useEffect(() => { setOpen(false) }, [location])
  useEffect(() => {
    function close(e) { if (e.key === 'Escape' || (e.type === 'pointerdown' && !menu.current?.contains(e.target))) setOpen(false) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close) }
  }, [])
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-transparent text-ink">
      <header className={`sticky top-0 z-40 flex shrink-0 items-center justify-between gap-2 border-b border-stroke-glass px-4 backdrop-blur-glass ${isToday ? 'h-header bg-header' : 'h-20 bg-app/95'}`}>
        <Link to="/" className="min-w-0 rounded-small">{isToday?<TodayIdentity username={profile?.username}/>:<span className="text-lg font-extrabold">LIFE<span className="text-pu">RPG</span></span>}</Link>
        <div ref={menu} className="relative flex items-center gap-3">
          <Link to="/tienda" className="text-sm font-bold text-gold" aria-label="Monedas y tienda">{(profile?.coins ?? 0).toLocaleString('es-CO',isToday?{notation:'compact',maximumFractionDigits:1}:{})}{!isToday && ' monedas'}</Link>
          <button aria-label={isToday?`Menú de usuario, nivel ${progress.level}, ${progress.current} de ${progress.needed} XP`:"Menú de usuario"} aria-expanded={open} aria-controls="user-menu" onClick={() => setOpen(!open)} className="shrink-0 rounded-full border border-pu/40 transition active:scale-press">{isToday?<XPAvatar profile={profile} equipped={equipped}/>:<Avatar avatar={profile?.avatar} equipped={equipped} view="head" size={44}/>}</button>
          {open && <nav id="user-menu" aria-label="Cuenta" className="absolute right-0 top-14 w-56 rounded-2xl border border-white/10 bg-card p-2 shadow-card">
            { [['/perfil','Mi perfil'],['/perfil?editar=avatar','Editar avatar'],['/amigos','Amigos'],['/premium','Premium'],['/configuracion','Configuración']].map(([to,label]) => <Link key={to} to={to} className="block rounded-xl px-4 py-3 text-sm hover:bg-white/5">{label}</Link>) }
            <button className="mt-2 w-full border-t border-white/10 px-4 py-3 text-left text-sm text-error" onClick={async () => { try { await signOut() } catch (e) { setError(e.message) } }}>Cerrar sesión</button>
            {error && <p role="alert" className="p-2 text-xs text-error">{error}</p>}
          </nav>}
        </div>
      </header>
      <main className="flex-1 animate-fade-up px-4 pb-28 pt-5">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-md -translate-x-1/2 px-3 pb-[max(env(safe-area-inset-bottom),12px)]">
        <div className="flex rounded-3xl border border-white/[.08] bg-card/80 p-1.5 shadow-nav backdrop-blur-xl">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.to === '/'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-semibold transition active:scale-press ${
                  isActive ? 'bg-gradient-to-b from-pu/25 to-pu-dark/10 text-pu-light shadow-selected' : 'text-sub hover:text-ink'
                }`}>
              {t.icon}{t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
