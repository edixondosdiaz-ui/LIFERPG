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
  const [messageType, setMessageType] = useState('success')
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
    e.preventDefault()
    if (busy) return
    setMessage(''); setMessageType('success')
    if (reset && (password.length < 8 || password !== confirm)) {
      setMessageType('error')
      return setMessage('Las contraseñas deben coincidir y tener mínimo 8 caracteres.')
    }
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
        if (error && (!error.status || error.status >= 500)) throw error
        if (error?.status === 429) {
          setMessageType('error'); setMessage('Has solicitado varios enlaces. Espera un minuto antes de intentarlo de nuevo.')
          setSeconds(60)
          return
        }
        setMessage('Si el correo está registrado, te enviamos un enlace. Revisa tu bandeja de entrada y también la carpeta de spam.')
        setSeconds(60)
      }
    } catch {
      setMessageType('error')
      setMessage(reset ? 'No pudimos guardar tu contraseña. Intenta de nuevo; si el enlace venció, solicita uno nuevo.' : 'No pudimos enviar la solicitud. Revisa tu conexión e intenta de nuevo en un momento.')
    } finally { setBusy(false) }
  }
  const backButton = <Link to="/" className="inline-flex min-h-[44px] w-full min-w-0 items-center justify-center gap-2 rounded-2xl border border-pu/40 bg-transparent px-4 py-3 text-center text-sm font-bold text-white transition hover:border-pu/70 hover:bg-pu/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pu-light focus-visible:ring-offset-2 focus-visible:ring-offset-app active:scale-[.98] active:bg-pu/20">
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m12 5-7 7 7 7M5 12h14" /></svg>
    <span className="min-w-0">Volver al inicio de sesión</span>
  </Link>
  const feedback = message && <p role={messageType === 'error' ? 'alert' : 'status'} className={`rounded-2xl border p-3 text-sm leading-relaxed ${messageType === 'error' ? 'border-red-400/25 bg-red-400/5 text-red-200' : 'border-pu/25 bg-pu/5 text-pu-light'}`}>{message}</p>
  const showForm = !checking && !(reset && !valid && !done) && !done
  return <main className="mx-auto flex min-h-screen w-full min-w-0 max-w-md flex-col justify-center space-y-5 px-5 py-8 text-ink">
    <h1 className="text-2xl font-extrabold">{reset ? 'Restablecer contraseña' : 'Recuperar contraseña'}</h1>
    {checking ? <p className="text-sub">Verificando enlace…</p> : reset && !valid && !done ? <section className="surface space-y-4 p-5"><p>El enlace venció o no es válido.</p><Link className="text-pu-light" to="/recuperar">Pedir otro enlace</Link></section> : !done && <form onSubmit={submit} aria-busy={busy} className="surface min-w-0 space-y-4 p-5">
      {reset ? <><label className="block text-sm">Nueva contraseña<input className="field mt-2" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} /></label><label className="block text-sm">Confirmar contraseña<input className="field mt-2" type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} /></label></> : <label className="block text-sm">Correo<input className="field mt-2" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>}
      <button className="btn min-h-[44px] w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pu-light focus-visible:ring-offset-2 focus-visible:ring-offset-app" disabled={busy || seconds > 0}>{busy ? reset ? 'Guardando…' : 'Enviando enlace…' : seconds ? `Reenviar en ${seconds} s` : reset ? 'Guardar contraseña' : 'Enviar enlace'}</button>
      {feedback}
      <div className="pt-2">{backButton}</div>
    </form>}
    {!showForm && <>{feedback}{backButton}</>}
  </main>
}
