import { Link } from 'react-router-dom'

// Navegación principal de las pantallas internas: grande, con área táctil de 44px
export default function BackButton({ to, label }) {
  return (
    <Link to={to} aria-label={`Volver a ${label}`}
      className="group inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-white/[.1] bg-white/[.06] py-2 pl-2.5 pr-4 text-[15px] font-bold text-ink shadow-card transition hover:bg-white/10 active:scale-press">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-pu/20 text-pu-light transition group-hover:bg-pu/30">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
      </span>
      {label}
    </Link>
  )
}
