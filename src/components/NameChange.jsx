import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import * as economy from '../services/economy'
import { rename } from '../services/experience'

export default function NameChange({ onChanged }) {
  const { profile, refreshProfile } = useAuth()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(profile?.username || '')
  const [wallet, setWallet] = useState(null)
  const [status, setStatus] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const candidate = value.trim().toLowerCase()
  useEffect(() => { economy.wallet().then(setWallet).catch(e=>setError(e.message)) }, [profile?.username, profile?.coins])
  useEffect(() => {
    setStatus(null); setConfirming(false)
    if (!open) return
    if (!/^[a-z0-9_]{3,20}$/.test(candidate)) { setStatus({available:false,message:'Usa de 3 a 20 letras, números o guion bajo'}); return }
    if (candidate===profile?.username) { setStatus({available:false,message:'Elige un usuario diferente'}); return }
    let active=true
    const id=setTimeout(()=>economy.usernameStatus(candidate).then(s=>{if(active)setStatus(s)}).catch(e=>{if(active)setError(e.message)}),350)
    return ()=>{active=false;clearTimeout(id)}
  }, [candidate,open,profile?.username])
  async function save() {
    if(busy || !status?.available) return
    setBusy(true);setError('')
    try { await rename(candidate); await refreshProfile(); setWallet(await economy.wallet()); await onChanged?.(); setOpen(false);setConfirming(false) }
    catch(e){setError(e.message);setConfirming(false);setWallet(await economy.wallet().catch(()=>null))}
    finally{setBusy(false)}
  }
  return <div className="relative mt-3 space-y-2">
    <button aria-label="Cambiar nombre de usuario" aria-expanded={open} className="rounded-full border border-pu/30 px-4 py-2 text-xs font-bold text-pu-light" onClick={()=>{setOpen(!open);setError('')}}>✎ Cambiar usuario</button>
    <p className="text-xs text-sub">{wallet ? `${wallet.name_changes} cambios disponibles` : 'Consultando cambios…'}</p>
    {open && (wallet?.name_changes>0 ? <form className="space-y-3 rounded-2xl bg-black/20 p-3" onSubmit={e=>{e.preventDefault();if(status?.available)setConfirming(true)}}>
      <label className="block text-left text-xs">Nuevo @usuario<input className="field mt-2" disabled={busy} autoCapitalize="none" autoCorrect="off" spellCheck={false} required minLength={3} maxLength={20} value={value} onChange={e=>setValue(e.target.value)} /></label>
      <p role="status" className={`text-xs ${status?.available?'text-emerald-300':'text-sub'}`}>{status?.message || 'Comprobando disponibilidad…'}</p>
      <p className="text-xs text-sub">Tu nombre anterior quedará reservado para ti durante {wallet.reservation_days} días.</p>
      {confirming ? <div role="alertdialog" aria-label="Confirmar cambio de usuario" className="space-y-3"><p className="text-sm">Vas a usar @{candidate}. Te quedan {wallet.name_changes} cambios; se consumirá uno y quedarán {wallet.name_changes-1}.</p><div className="flex gap-2"><button type="button" disabled={busy} className="flex-1 rounded-xl bg-white/10 py-3 text-xs" onClick={()=>setConfirming(false)}>Cancelar</button><button type="button" disabled={busy} className="btn flex-1" onClick={save}>{busy?'Guardando…':'Confirmar cambio'}</button></div></div> : <button className="btn w-full" disabled={!status?.available || busy}>Revisar cambio</button>}
    </form> : <p className="text-sm text-sub">{wallet ? <>No tienes cambios disponibles. <Link to="/tienda?categoria=utilities" className="font-bold text-pu-light">Conseguir una tarjeta →</Link></> : 'Consultando saldo de cambios…'}</p>)}
    {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
  </div>
}
