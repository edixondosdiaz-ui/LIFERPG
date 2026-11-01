import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import * as api from '../services/api'
import Avatar from '../components/Avatar'
import AvatarEditor from '../components/AvatarEditor'
import { DEFAULT_AVATAR } from '../lib/avatar'
import { haptic } from '../lib/ui'

const USER_RE = /^[a-z0-9_]{3,20}$/
const STEPS = ['Identidad', 'Tu versión futura', 'Listo']

// Paso 2 y 3 del registro. El paso 1 (correo y contraseña) vive en Auth.jsx.
export default function Onboarding() {
  const { user, profile, refreshProfile, signOut } = useAuth()
  const [step, setStep] = useState(0)
  const [username, setUsername] = useState(profile?.username ?? '')
  const [display, setDisplay] = useState(profile?.display_name && !profile.display_name.includes('@') ? profile.display_name : '')
  const [avatar, setAvatar] = useState({ ...DEFAULT_AVATAR, ...(profile?.avatar || {}) })
  const [avail, setAvail] = useState('idle') // idle | checking | ok | taken | invalid
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const u = username.toLowerCase()

  // Disponibilidad en vivo (con espera para no consultar en cada tecla)
  useEffect(() => {
    if (!u) return setAvail('idle')
    if (!USER_RE.test(u)) return setAvail('invalid')
    setAvail('checking')
    const t = setTimeout(async () => {
      try { setAvail((await api.usernameAvailable(u)) ? 'ok' : 'taken') }
      catch (e) { setAvail('idle'); setErr(e.message) }
    }, 400)
    return () => clearTimeout(t)
  }, [u])

  const hint = {
    idle: 'Letras minúsculas, números y guion bajo (3 a 20).',
    invalid: 'Usa 3 a 20 caracteres: letras sin tildes, números o _',
    checking: 'Comprobando…',
    ok: 'Disponible',
    taken: 'Ese nombre ya está en uso',
  }[avail]
  const hintColor = avail === 'ok' ? 'text-emerald-300' : avail === 'taken' || avail === 'invalid' ? 'text-red-300' : 'text-sub'

  async function finish() {
    setBusy(true); setErr('')
    try {
      await api.completeOnboarding({ username: u, displayName: display, avatar })
      haptic([20, 40, 20])
      await refreshProfile() // el Gate de App.jsx pasa a la app al ver onboarding_completed
    } catch (e) {
      setErr(e.message)
      if (/usuario/i.test(e.message)) setStep(0)
    }
    setBusy(false)
  }

  const go = (n) => { haptic(); setErr(''); setStep(n) }

  return (
    <div className="mx-auto min-h-screen max-w-md bg-app px-4 pb-10 pt-6 text-ink">
      <header className="mb-6">
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-pu-dark to-pu-light transition-all duration-500" style={{ width: i <= step ? '100%' : '0%' }} />
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs font-semibold text-sub">Paso {step + 2} de 4 · {STEPS[step]}</p>
          <button onClick={signOut} className="text-xs font-semibold text-sub underline-offset-2 hover:underline">Cancelar</button>
        </div>
      </header>

      {step === 0 && (
        <div key="s0" className="animate-fade-up space-y-6">
          <div>
            <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">¿Cómo te van a conocer?</h1>
            <p className="mt-2 text-sm text-sub">Tu nombre de usuario es lo que verán tus amigos, los rankings y las ligas.</p>
          </div>

          <div className="surface flex items-center gap-4 p-4">
            <Avatar avatar={avatar} view="head" size={64} />
            <div className="min-w-0">
              <p className="truncate text-lg font-extrabold">@{u || 'tu_usuario'}</p>
              <p className="truncate text-xs text-sub">{display || 'Nombre visible (opcional)'}</p>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-sub" htmlFor="username">Nombre de usuario</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-bold text-sub">@</span>
              <input id="username" className="field !pl-9" autoCapitalize="none" autoCorrect="off" spellCheck="false" maxLength={20}
                placeholder="tu_usuario" value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))} />
            </div>
            <p className={`mt-1.5 text-xs font-semibold ${hintColor}`}>{hint}</p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-sub" htmlFor="display">Nombre visible <span className="font-medium">(opcional)</span></label>
            <input id="display" className="field" maxLength={40} placeholder="Como quieres que te llamemos" value={display} onChange={(e) => setDisplay(e.target.value)} />
          </div>

          {err && <p className="text-xs font-semibold text-red-300">{err}</p>}
          <button disabled={avail !== 'ok'} onClick={() => go(1)} className="btn w-full !py-4 text-base">Continuar</button>
        </div>
      )}

      {step === 1 && (
        <div key="s1" className="animate-fade-up space-y-5">
          <div>
            <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">Crea tu versión futura</h1>
            <p className="mt-2 text-sm text-sub">Así te verás cuando mantengas tus hábitos. Puedes cambiarlo cuando quieras.</p>
          </div>
          <AvatarEditor value={avatar} onChange={setAvatar} />
          <div className="flex gap-2.5">
            <button onClick={() => go(0)} className="rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-bold text-sub active:scale-95">Atrás</button>
            <button onClick={() => go(2)} className="btn flex-1 !py-4 text-base">Continuar</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div key="s2" className="animate-pop space-y-6 text-center">
          <div className="relative overflow-hidden rounded-[28px] border border-white/[.08] bg-gradient-to-br from-pu-dark/45 via-card to-card px-5 pb-6 pt-8 shadow-[0_24px_60px_-24px_rgba(168,85,247,.65)]">
            <div className="pointer-events-none absolute -top-16 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-pu/30 blur-3xl" />
            <div className="relative mx-auto w-fit"><Avatar avatar={avatar} view="bust" size={170} /></div>
            <p className="relative mt-4 text-2xl font-extrabold tracking-tight">@{u}</p>
            {display && <p className="relative text-sm text-sub">{display}</p>}
            <div className="relative mt-5 grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-white/[.08] bg-white/5 py-3"><p className="text-xl font-extrabold">1</p><p className="text-[11px] text-sub">Nivel inicial</p></div>
              <div className="rounded-2xl border border-white/[.08] bg-white/5 py-3"><p className="text-xl font-extrabold text-gold">150</p><p className="text-[11px] text-sub">Monedas de bienvenida</p></div>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Tu versión futura está lista</h1>
            <p className="mt-2 text-sm text-sub">Cada hábito que registres la acerca un poco más a ti.</p>
          </div>
          {err && <p className="text-xs font-semibold text-red-300">{err}</p>}
          <div className="flex gap-2.5">
            <button onClick={() => go(1)} className="rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-bold text-sub active:scale-95">Editar</button>
            <button disabled={busy} onClick={finish} className="btn flex-1 !py-4 text-base">{busy ? 'Guardando…' : 'Iniciar mi evolución'}</button>
          </div>
          <p className="text-[11px] text-sub">Sesión: {user?.email}</p>
        </div>
      )}
    </div>
  )
}
