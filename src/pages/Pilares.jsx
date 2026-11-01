import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { levelProgress } from '../lib/xp'

const MODULES = [
  { key: 'fuerza', label: 'Fuerza', icon: '⚔️', desc: 'Rutinas, series y sobrecarga progresiva', color: '#ff4d4f', to: '/pilares/fuerza' },
  { key: 'vitalidad', label: 'Salud', icon: '❤️', desc: 'Agua, sueño y alimentación', color: '#2fbf4a', to: '/pilares/salud' },
  { key: 'intelecto', label: 'Educación', icon: '🧠', desc: 'Pomodoro, tareas y aprendizaje', color: '#38bdf8', to: '/pilares/educacion' },
  { key: 'finanzas', label: 'Finanzas', icon: '💰', desc: 'Ingresos, gastos, ahorro y metas', color: '#e6b43c', to: '/pilares/finanzas' },
]

export default function Pilares() {
  const { profile } = useAuth()
  const pillarXp = profile?.pillar_xp ?? {}
  const total = levelProgress(profile?.xp ?? 0)

  return (
    <div className="space-y-5">
      {/* Cabecera: el elemento principal de la pantalla (más grande que cualquier tarjeta de pilar) */}
      <section className="relative overflow-hidden rounded-[28px] border border-pu/35 bg-gradient-to-br from-pu-dark/50 via-card to-card p-6 shadow-[0_24px_60px_-24px_rgba(168,85,247,.7)]">
        <div className="pointer-events-none absolute -right-14 -top-16 h-52 w-52 rounded-full bg-pu/30 blur-3xl" />
        <div className="relative flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[34px] font-extrabold leading-none tracking-tight">Pilares</h1>
            <p className="mt-2 text-sm text-ink/70">Cada pilar que subes te sube a ti.</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold text-sub">Nivel global</p>
            <p className="text-4xl font-black leading-none text-pu-light">{total.level}</p>
          </div>
        </div>
        <div className="relative mt-5 flex gap-1.5">
          {MODULES.map((m) => (
            <div key={m.key} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full" style={{ width: `${levelProgress(pillarXp[m.key] ?? 0).pct}%`, background: m.color }} />
            </div>
          ))}
        </div>
      </section>

      <div className="space-y-3">
        {MODULES.map((m) => {
          const px = pillarXp[m.key] ?? 0
          const lp = levelProgress(px)
          const ready = !!m.to
          const body = (
            <>
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-3xl" style={{ background: m.color + '33' }} />
              <div className="relative flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl text-xl" style={{ background: m.color + '26' }}>{m.icon}</span>
                  <div><p className="text-base font-extrabold leading-tight">{m.label}</p><p className="text-[11px] text-sub">{m.desc}</p></div>
                </div>
                <div className="text-right"><p className="text-[10px] font-bold text-sub">Nivel</p><p className="text-2xl font-black leading-none" style={{ color: m.color }}>{lp.level}</p></div>
              </div>
              <div className="relative mt-4 flex items-center justify-between text-xs">
                <span className="text-sub">{px.toLocaleString('es-CO')} XP</span>
                {ready
                  ? <span className="rounded-full px-2.5 py-1 font-bold" style={{ background: m.color + '26', color: m.color }}>Abrir módulo →</span>
                  : <span className="rounded-full bg-white/10 px-2.5 py-1 font-bold text-sub">En construcción</span>}
              </div>
              <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${lp.pct}%`, background: `linear-gradient(90deg, ${m.color}99, ${m.color})` }} />
              </div>
            </>
          )
          const cls = 'relative block overflow-hidden rounded-2xl border p-4 text-left transition duration-200'
          const style = { borderColor: m.color + '40', background: `linear-gradient(135deg, ${m.color}26, #15161c 65%)`, boxShadow: `0 18px 40px -26px ${m.color}` }
          return ready
            ? <Link key={m.key} to={m.to} className={`${cls} hover:-translate-y-0.5 active:scale-[.98]`} style={style}>{body}</Link>
            : <div key={m.key} className={`${cls} opacity-60`} style={style}>{body}</div>
        })}
      </div>

      <Link to="/pilares/habitos" className="surface flex items-center justify-between p-4 text-sm font-bold transition active:scale-[.98]">
        Registro rápido de hábitos <span className="text-pu-light">→</span>
      </Link>
    </div>
  )
}
