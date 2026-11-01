import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import * as api from '../../services/api'

export default function Ajustes() {
  const { user, profile, signOut, refreshProfile } = useAuth()
  const [display, setDisplay] = useState(profile?.display_name ?? '')
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [confirming, setConfirming] = useState(false)

  async function save(e) {
    e.preventDefault()
    try {
      await api.updateDisplayName(display)
      await refreshProfile()
      setMsg({ type: 'ok', text: 'Guardado' })
    } catch (err) { setMsg({ type: 'err', text: err.message }) }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold tracking-tight">Configuración</h1>

      <form onSubmit={save} className="surface space-y-3 p-4">
        <div className="flex justify-between text-sm"><span className="text-sub">Usuario</span><b>@{profile?.username}</b></div>
        <div className="flex justify-between text-sm"><span className="text-sub">Correo</span><span className="truncate pl-4 font-semibold">{user?.email}</span></div>
        <div>
          <label htmlFor="dn" className="mb-1.5 block text-xs font-bold text-sub">Nombre visible</label>
          <input id="dn" className="field" maxLength={40} value={display} onChange={(e) => { setDisplay(e.target.value); setMsg({ type: '', text: '' }) }} placeholder="Opcional" />
        </div>
        {msg.text && <p className={`text-xs font-semibold ${msg.type === 'ok' ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</p>}
        <button className="btn w-full">Guardar</button>
      </form>

      <section className="surface p-4">
        {!confirming
          ? <button onClick={() => setConfirming(true)} className="w-full rounded-2xl bg-white/5 py-3 text-sm font-bold text-red-300 transition hover:bg-red-400/10 active:scale-95">Cerrar sesión</button>
          : <div className="space-y-2.5">
              <p className="text-center text-sm font-semibold">¿Seguro que quieres cerrar sesión?</p>
              <div className="flex gap-2.5">
                <button onClick={() => setConfirming(false)} className="flex-1 rounded-2xl bg-white/5 py-3 text-sm font-bold active:scale-95">Cancelar</button>
                <button onClick={signOut} className="flex-1 rounded-2xl bg-red-500/20 py-3 text-sm font-bold text-red-300 active:scale-95">Sí, cerrar</button>
              </div>
            </div>}
      </section>
    </div>
  )
}
