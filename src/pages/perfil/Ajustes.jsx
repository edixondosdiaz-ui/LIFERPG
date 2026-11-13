import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import * as ex from '../../services/experience'
import { supabase } from '../../services/supabase'

export default function Ajustes() {
  const { user, profile, signOut, refreshProfile } = useAuth()
  const [prefs, setPrefs] = useState(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [deletion, setDeletion] = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { ex.getPreferences().then(p => setPrefs({ units: 'km', profile_visibility: 'friends', notifications: typeof Notification !== 'undefined' && Notification.permission === 'granted', ...p })).catch(e => setMsg(e.message)) }, [])
  async function run(work, message) {
    setBusy(true); setMsg('')
    try { await work(); setMsg(message) } catch (e) { setMsg(e.message) } finally { setBusy(false) }
  }
  async function save(e) {
    e.preventDefault()
    await run(async () => { await ex.savePreferences({ units: prefs.units, profile_visibility: prefs.profile_visibility, notifications: prefs.notifications }); await refreshProfile() }, 'Configuración guardada')
  }
  async function changePassword(e) {
    e.preventDefault()
    if (password.length < 8 || password !== confirm) return setMsg('Las contraseñas deben coincidir y tener mínimo 8 caracteres.')
    await run(async () => { const { error } = await supabase.auth.updateUser({ password }); if (error) throw error; setPassword(''); setConfirm('') }, 'Contraseña actualizada')
  }
  async function remove(e) {
    e.preventDefault()
    await run(async () => { await ex.deleteAccount(deletion); await signOut() }, 'Cuenta eliminada')
  }
  return <div className="space-y-5">
    <h1 className="text-2xl font-extrabold">Configuración</h1>
    {msg && <p role="status" className="text-sm text-pu-light">{msg}</p>}
    <form onSubmit={save} className="surface space-y-4 p-4">
      <p className="text-xs text-sub">Correo (solo lectura)</p><p className="break-all text-sm">{user?.email}</p>
      <p className="text-sm">Nombre visible: <b>@{profile?.username}</b></p><Link to="/perfil" className="block text-xs font-bold text-pu-light">Cambiar usuario desde Mi perfil →</Link>
      {prefs && <>
        <label className="block text-sm">Unidades<select className="field mt-2" value={prefs.units} onChange={e => setPrefs({...prefs, units:e.target.value})}><option value="km">Kilómetros (km)</option><option value="mi">Millas (mi)</option></select></label>
        <label className="block text-sm">Privacidad del perfil<select className="field mt-2" value={prefs.profile_visibility} onChange={e => setPrefs({...prefs,profile_visibility:e.target.value})}><option value="friends">Solo amigos</option><option value="public">Público</option></select></label>
        <p className="text-xs text-sub">El ranking conserva tu usuario y XP. El perfil nunca muestra tu correo ni ubicación.</p>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={prefs.notifications} onChange={async e => { const enabled=e.target.checked; if (enabled) { if (typeof Notification === 'undefined') return setMsg('Tu navegador no admite notificaciones.'); if (await Notification.requestPermission() !== 'granted') return setMsg('Activa el permiso de notificaciones en el navegador.'); } setPrefs({...prefs, notifications:enabled}) }} />Permitir recordatorios con la app abierta</label>
        <p className="text-xs text-sub">Notificaciones con la app cerrada: Disponible pronto.</p>
      </>}
      <button className="btn w-full" disabled={busy || !prefs}>Guardar configuración</button>
    </form>
    <form onSubmit={changePassword} className="surface space-y-3 p-4"><h2 className="font-bold">Cambiar contraseña</h2><input className="field" aria-label="Nueva contraseña" placeholder="Nueva contraseña (mínimo 8 caracteres)" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} /><input className="field" aria-label="Confirmar contraseña" placeholder="Confirmar contraseña" type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} /><button className="btn w-full" disabled={busy}>Actualizar contraseña</button></form>
    <section className="surface space-y-3 p-4"><h2 className="font-bold">Información legal</h2><p className="text-sm text-sub">Términos y condiciones: Disponible pronto.</p><p className="text-sm text-sub">Política de privacidad: Disponible pronto.</p></section>
    <section className="surface space-y-3 p-4"><button className="w-full py-2 text-sm font-bold" disabled={busy} onClick={() => run(signOut,'Sesión cerrada')}>Cerrar sesión</button><button className="w-full border-t border-white/10 pt-4 text-sm text-error" onClick={() => setShowDelete(!showDelete)}>Eliminar cuenta</button>{showDelete && <form onSubmit={remove} className="space-y-3"><p className="text-sm text-error">Esta acción elimina tu cuenta y sus datos de forma permanente. Escribe ELIMINAR para confirmar.</p><input className="field" aria-label="Confirmación de eliminación" value={deletion} onChange={e => setDeletion(e.target.value)} /><button className="btn w-full !bg-error-strong !bg-none" disabled={busy || deletion !== 'ELIMINAR'}>Eliminar mi cuenta definitivamente</button></form>}</section>
  </div>
}
