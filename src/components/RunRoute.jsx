import { routePaths } from '../lib/running'
export default function RunRoute({ points }) {
  if(points.length<2)return <p className="text-xs text-sub">No hay suficientes puntos para dibujar la ruta.</p>
  return <svg viewBox="0 0 300 300" className="w-full rounded-2xl bg-black/25" role="img" aria-label="Trazado privado de tu recorrido">{routePaths(points).map((d,i)=><path key={i} d={d} fill="none" stroke="#a855f7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>)}</svg>
}
