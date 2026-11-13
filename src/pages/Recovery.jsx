import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, recoveryState } from '../services/supabase'

export default function Recovery({ reset = false }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [valid, setValid] = useState(recoveryState.valid)
  const [checking, setChecking] = useState(reset)
  const [seconds, setSeconds] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!seconds) return
    const id = setTimeout(() => setSeconds(seconds - 1), 1000)
    return () => clearTimeout(id)
  }, [seconds])
  useEffect(() => {
    if (!reset) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) { setValid(true); setChecking(false) }
      if (event === 'SIGNED_OUT') setValid(false)
    })
    supabase.auth.getSession().then(({ data, error }) => {
      setValid(!error && !!data.session && recoveryState.valid)
      setChecking(false)
    })
    return () => subscription.unsubscribe()
  }, [reset])
  async function submit(e) {
    e.preventDefault(); setMessage('')
    if (reset && (password.length < 8 || password !== confirm)) return setMessage('Las contraseñas deben coincidir y tener mínimo 8 caracteres.')
    setBusy(true)
    try {
      if (reset) {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        recoveryState.valid = false
        await supabase.auth.signOut()
        setDone(true); setMessage('Contraseña actualizada. Ya puedes iniciar sesión.')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/restablecer` })
        if (error && !error.status) throw new Error('No pudimos conectar. Intenta de nuevo.')
        setMessage('Si el correo está registrado, te enviamos un enlace')
        setSeconds(60)
      }
    } catch (err) { setMessage(err.message) } finally { setBusy(false) }
  }
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center space-y-5 px-5 text-ink">
    <h1 className="text-2xl font-extrabold">{reset ? 'Restablecer contraseña' : 'Recuperar contraseña'}</h1>
    {checking ? <p className="text-sub">Verificando enlace…</p> : reset && !valid && !done ? <section className="surface space-y-4 p-5"><p>El enlace venció o no es válido.</p><Link className="text-pu-light" to="/recuperar">Pedir otro enlace</Link></section> : !done && <form onSubmit={submit} className="surface space-y-4 p-5">
      {reset ? <><label className="block text-sm">Nueva contraseña<input className="field mt-2" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} /></label><label className="block text-sm">Confirmar contraseña<input className="field mt-2" type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} /></label></> : <label className="block text-sm">Correo<input className="field mt-2" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>}
      <button className="btn w-full" disabled={busy || seconds > 0}>{busy ? 'Procesando…' : seconds ? `Reenviar en ${seconds} s` : reset ? 'Guardar contraseña' : 'Enviar enlace'}</button>
    </form>}
    {message && <p role="status" className="text-sm text-pu-light">{message}</p>}
    <Link to="/" className="text-sm text-sub">Volver al inicio de sesión</Link>
  </main>
}
