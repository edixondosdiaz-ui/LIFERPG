import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { activateTrial, premiumStatus } from '../services/economy'
import AdvancedTrends from '../components/AdvancedTrends'

const date = value => new Date(value).toLocaleString('es-CO', { timeZone:'America/Bogota', dateStyle:'long', timeStyle:'short' })

export default function Premium() {
  const { refreshProfile } = useAuth()
  const [status,setStatus] = useState(null)
  const [confirming,setConfirming] = useState(false)
  const [busy,setBusy] = useState(false)
  const working = useRef(false)
  const [error,setError] = useState('')
  const load = useCallback(async()=>setStatus(await premiumStatus()),[])
  useEffect(()=>{ load().catch(e=>setError(e.message)) },[load])
  useEffect(()=>{
    if(!status?.active)return
    const id=setInterval(()=>load().catch(e=>setError(e.message)),60000)
    return ()=>clearInterval(id)
  },[status?.active,load])
  async function activate() {
    if(working.current)return
    working.current=true;setBusy(true);setError('')
    try { setStatus(await activateTrial());setConfirming(false);await refreshProfile() }
    catch(e){setError(e.message)}finally{working.current=false;setBusy(false)}
  }
  return <div className="space-y-5">
    <section className="surface space-y-4 border-pu/30 bg-gradient-to-br from-pu-dark/25 to-card p-6">
      <h1 className="text-2xl font-extrabold text-pu-light">LifeRPG Premium</h1>
      {!status && !error && <p className="text-sm text-sub">Consultando tu cuenta…</p>}
      {status && <>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-white/10"><th className="py-3">Beneficio</th><th>Gratis</th><th className="text-pu-light">Premium</th></tr></thead><tbody>{[
          ['Tienda','Precio normal',`${status.discount}% de descuento`],
          ['Cambios de usuario','Uno inicial + tarjetas',`Uno extra cada ${status.rename_days} días`],
          ['Rutinas',`${status.free_routines ?? '—'}`, 'Ilimitadas'],
          ['Estadísticas','Resumen básico',`${status.trend_months ?? 12} meses`],
          ['Marco e insignia exclusivos','No incluidos','Incluidos mientras esté activo'],
          ['Protectores de racha','Máximo 2','Máximo 2'],
          ['XP y ranking','Mismas reglas','Mismas reglas'],
        ].map(row=><tr key={row[0]} className="border-b border-white/5">{row.map((cell,i)=>i===0?<th key={i} className="py-3 pr-3 font-medium">{cell}</th>:<td key={i} className="pr-2">{cell}</td>)}</tr>)}</tbody></table></div>
        <p className="text-sm text-sub">Desbloquea un {status.discount}% de descuento en la tienda, cosméticos exclusivos y un cambio adicional de usuario cada {status.rename_days} días mientras Premium esté activo.</p>
        <p className="text-sm font-bold">Prueba gratuita de {status.duration_days} días</p>
        <p className="text-xs text-sub">Sin tarjeta ni datos bancarios. No hay cobros ni renovación automática. Al terminar, Premium se desactiva y tus objetos comprados se conservan.</p>
        {status.active ? <div role="status" className="space-y-2 rounded-2xl bg-pu/15 p-4"><p className="font-extrabold text-pu-light">Premium activo</p><p className="text-sm">Vigente hasta {date(status.ends_at)}.</p><Link to="/tienda" className="btn mt-3 block text-center">Usar beneficios en la tienda</Link><Link to="/perfil" className="block text-center text-sm text-pu-light">Ver cambios de usuario disponibles →</Link></div>
          : status.trial_available ? <button className="btn w-full" disabled={busy || confirming} onClick={()=>{setConfirming(true);setError('')}}>Adquirir prueba gratuita</button>
          : <p className="rounded-2xl bg-white/5 p-4 text-sm text-sub">{status.trial_used ? `Ya usaste tu prueba gratuita${status.trial_ends_at ? `; terminó el ${date(status.trial_ends_at)}` : ''}.` : 'La prueba gratuita no está disponible para esta cuenta en este momento.'}</p>}
        <p className="text-xs text-sub">Una prueba por cuenta. Suscripción de pago: Disponible pronto.</p>
      </>}
    </section>
    {confirming && !status?.active && <section role="alertdialog" aria-label="Confirmar prueba gratuita" className="surface space-y-4 border-pu/40 p-5"><h2 className="font-extrabold">Confirma tu prueba</h2><p className="text-sm text-sub">Activarás Premium durante {status?.duration_days} días desde ahora. No se te cobrará nada ni tendrás que cancelar una suscripción.</p><div className="grid grid-cols-2 gap-2"><button disabled={busy} className="rounded-2xl bg-white/10 py-3 text-sm font-bold" onClick={()=>setConfirming(false)}>Cancelar</button><button disabled={busy} className="btn" onClick={activate}>{busy?'Activando…':'Confirmar prueba gratuita'}</button></div></section>}
    {error && <div role="alert" className="space-y-2 rounded-2xl border border-error/30 p-4 text-sm text-error"><p>{error}</p><button disabled={busy} className="text-xs underline" onClick={()=>{setError('');load().catch(e=>setError(e.message))}}>Volver a consultar estado</button></div>}
    {status?.active && <AdvancedTrends />}
  </div>
}
