import { palette } from '../design/tokens'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { premiumStatus } from '../services/economy'
import { trends } from '../services/social'
import { LineChart } from './charts'
import { Card } from './ui'
import { money } from '../lib/dates'
export default function AdvancedTrends() {
  const [rows,setRows]=useState(null),[active,setActive]=useState(null),[error,setError]=useState('')
  useEffect(()=>{premiumStatus().then(async s=>{setActive(s.active);if(s.active)setRows(await trends())}).catch(e=>setError(e.message))},[])
  return <Card title="Estadísticas avanzadas">
    {error && <p className="text-xs text-error">{error}</p>}
    {active===false && <p className="text-sm text-sub">Tendencias largas con Premium. <Link to="/premium" className="text-pu-light">Ver prueba gratuita →</Link></p>}
    {active!==false && !rows && !error && <p className="text-xs text-sub">Cargando tendencias…</p>}
    {rows && <><p className="text-xs text-sub">Últimos {rows.length} meses · datos reales de tus registros.</p>{[['volume','Volumen de Fuerza',palette.strength,v=>`${Math.round(v)} kg`],['study_minutes','Tiempo de estudio',palette.education,v=>`${(v/60).toFixed(1)} h`],['savings','Ahorros',palette.finance,money],['sleep_hours','Sueño promedio',palette.health,v=>`${v} h`]].map(([key,title,color,format])=><div key={key}><h3 className="mb-2 text-xs font-bold">{title}</h3><LineChart color={color} format={format} points={rows.filter(r=>r[key]!==null).map(r=>({label:r.month.slice(0,7),value:Number(r[key])}))}/></div>)}</>}
  </Card>
}
