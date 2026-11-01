export default function VolumeChart({ data }) {
  if (data.length < 2) {
    return <p className="rounded-2xl border border-dashed border-line px-3 py-4 text-center text-xs text-sub">La gráfica aparece cuando tengas 2 días con registros.</p>
  }
  const last = data.slice(-7)
  const max = Math.max(...last.map((d) => d.volume))

  return (
    <div className="flex h-28 items-end gap-2">
      {last.map((d, i) => {
        const isLast = i === last.length - 1
        return (
          <div key={d.performed_at} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${d.volume} kg de volumen`}>
            <div className={`w-full rounded-lg transition-all duration-700 ${isLast ? 'bg-gradient-to-t from-pu-dark to-pu-light shadow-[0_0_16px_#a855f766]' : 'bg-white/10'}`}
              style={{ height: `${Math.max(8, (d.volume / max) * 100)}%` }} />
            <span className={`text-[10px] ${isLast ? 'font-bold text-ink' : 'text-sub'}`}>{d.performed_at.slice(8)}</span>
          </div>
        )
      })}
    </div>
  )
}
