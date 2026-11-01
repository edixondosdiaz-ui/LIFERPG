import { NavLink, Navigate, useParams } from 'react-router-dom'
import Resumen from './perfil/Resumen'
import Logros from './perfil/Logros'
import Tienda from './perfil/Tienda'
import Ajustes from './perfil/Ajustes'

const TABS = [
  { id: 'resumen', label: 'Resumen', el: <Resumen /> },
  { id: 'logros', label: 'Logros', el: <Logros /> },
  { id: 'tienda', label: 'Tienda', el: <Tienda /> },
  { id: 'ajustes', label: 'Configuración', el: <Ajustes /> },
]

export default function Perfil() {
  const { tab = 'resumen' } = useParams()
  const current = TABS.find((t) => t.id === tab)
  if (!current) return <Navigate to="/perfil" replace />

  return (
    <div className="space-y-5">
      <nav className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]" aria-label="Secciones del perfil">
        {TABS.map((t) => (
          <NavLink key={t.id} to={t.id === 'resumen' ? '/perfil' : `/perfil/${t.id}`} end
            className={() => `flex-none rounded-full px-4 py-2.5 text-[13px] font-bold transition active:scale-95 ${t.id === tab ? 'bg-gradient-to-b from-pu-light to-pu-dark text-white shadow-[0_6px_18px_-6px_#a855f7]' : 'bg-white/[.05] text-sub hover:text-ink'}`}>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <div key={tab} className="animate-fade-up">{current.el}</div>
    </div>
  )
}
