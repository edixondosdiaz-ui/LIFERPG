import { NavLink, Outlet } from 'react-router-dom'

const Icon = ({ children }) => (
  <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
)

const tabs = [
  { to: '/', label: 'Inicio', icon: <Icon><path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" /></Icon> },
  { to: '/pilares', label: 'Pilares', icon: <Icon><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" /></Icon> },
  { to: '/ranking', label: 'Ranking', icon: <Icon><path d="M5 20v-8M12 20V4M19 20v-6" /></Icon> },
  { to: '/perfil', label: 'Perfil', icon: <Icon><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></Icon> },
]

export default function Layout() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-app text-ink">
      <main className="flex-1 animate-fade-up px-4 pb-28 pt-6">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-md -translate-x-1/2 px-3 pb-[max(env(safe-area-inset-bottom),12px)]">
        <div className="flex rounded-3xl border border-white/[.08] bg-card/80 p-1.5 shadow-[0_20px_50px_-10px_rgba(0,0,0,.8)] backdrop-blur-xl">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.to === '/'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-semibold transition active:scale-95 ${
                  isActive ? 'bg-gradient-to-b from-pu/25 to-pu-dark/10 text-pu-light shadow-[inset_0_0_0_1px_#a855f733]' : 'text-sub hover:text-ink'
                }`}>
              {t.icon}{t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
