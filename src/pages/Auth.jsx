import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Auth() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [terms, setTerms] = useState(false)
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setMsg({ type: '', text: '' })
    if (mode === 'register') {
      if (password.length < 6) return setMsg({ type: 'err', text: 'La contraseña debe tener mínimo 6 caracteres' })
      if (!terms) return setMsg({ type: 'err', text: 'Debes aceptar los Términos y el tratamiento de datos (Ley 1581 de 2012).' })
    }
    setBusy(true)
    try {
      if (mode === 'login') {
        await signIn({ email, password })
      } else {
        const user = await signUp({ email, password })
        if (!user) setMsg({ type: 'ok', text: 'Revisa tu correo para confirmar la cuenta.' })
      }
    } catch (err) {
      setMsg({ type: 'err', text: err.message })
    }
    setBusy(false)
  }

  const label = 'mb-1.5 mt-3.5 block text-[11px] font-semibold uppercase tracking-wider text-sub'
  const input = 'w-full rounded-[10px] border border-line bg-card2 px-3.5 py-3 text-sm outline-none focus:border-pu'
  const tab = (m) =>
    `rounded-[10px] py-2.5 font-semibold ${mode === m ? 'bg-pu text-white shadow-[0_4px_14px_#a855f755]' : 'text-sub'}`

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center bg-app px-5 py-8 text-ink">
      <div className="relative mb-3.5 grid h-14 w-14 place-items-center self-center rounded-full border-2 border-pu text-2xl">
        ⚔️
        <i className="absolute -bottom-1 -right-2 grid h-5 w-5 place-items-center rounded-full bg-[#ff4d4f] text-sm not-italic text-white">+</i>
      </div>
      <h1 className="text-center text-[28px] font-extrabold tracking-[.08em]">
        LIFE<span className="text-pu">RPG</span>
      </h1>
      <p className="mb-6 mt-1 text-center text-[11px] tracking-[.12em] text-sub">SUBE DE NIVEL EN LA VIDA REAL</p>

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl border border-line bg-card2 p-1">
        <button type="button" className={tab('login')} onClick={() => setMode('login')}>Iniciar sesión</button>
        <button type="button" className={tab('register')} onClick={() => setMode('register')}>Registrarse</button>
      </div>

      <form onSubmit={submit} className="rounded-2xl border border-line bg-card p-[18px]">
        <label className={label}>Correo</label>
        <input className={input} type="email" required placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className={label}>Contraseña</label>
        <input className={input} type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
        {mode === 'login' && <Link to="/recuperar" className="mt-3 block text-xs font-bold text-pu-light">¿Olvidaste tu contraseña?</Link>}
        {mode === 'register' && (
          <label className="mt-3.5 flex items-start gap-2 text-xs leading-snug text-sub">
            <input type="checkbox" className="mt-0.5" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
            Acepto los Términos y Condiciones y autorizo el tratamiento de mis datos.
          </label>
        )}
        {msg.text && (
          <p className={`mt-2.5 text-xs ${msg.type === 'ok' ? 'text-[#2fbf4a]' : 'text-[#ff4d4f]'}`}>{msg.text}</p>
        )}
        <button
          disabled={busy}
          className="mt-[18px] w-full rounded-xl bg-gradient-to-b from-pu to-pu-dark px-4 py-3.5 font-bold text-white shadow-[0_6px_20px_#7c3aed55] disabled:opacity-45 disabled:shadow-none"
        >
          {busy ? '...' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
        </button>
      </form>
    </div>
  )
}
