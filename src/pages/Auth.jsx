import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PasswordInput from '../components/PasswordInput'
import { supabase } from '../services/supabase'
import { LEGAL_VERSION, MINIMUM_AGE, USERNAME_PATTERN, normalizeUsername, isMinor, registrationErrors } from '../lib/registration'
import { today } from '../lib/dates'

export default function Auth() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [terms, setTerms] = useState(false)
  const [username,setUsername]=useState(''),[displayName,setDisplayName]=useState(''),[birthDate,setBirthDate]=useState(''),[guardianAccepted,setGuardianAccepted]=useState(false)
  const [errors,setErrors]=useState({}),[touched,setTouched]=useState({}),[availability,setAvailability]=useState({username:'',state:'idle',message:''})
  const [availabilityRetry,setAvailabilityRetry]=useState(0)
  const normalized=normalizeUsername(username),minor=isMinor(birthDate)
  useEffect(()=>{
    if(mode!=='register' || !USERNAME_PATTERN.test(normalized)){setAvailability({username:normalized,state:'idle',message:''});return}
    let live=true;setAvailability({username:normalized,state:'checking',message:'Comprobando disponibilidad…'})
    const timer=setTimeout(async()=>{try{
      const {data,error}=await supabase.rpc('registration_username_status',{p_username:normalized})
      if(error)throw error
      if(live)setAvailability({username:normalized,state:data.available?'ok':'taken',message:data.message})
    }catch{if(live)setAvailability({username:normalized,state:'error',message:'No pudimos comprobarlo. Intenta de nuevo.'})}},400)
    return()=>{live=false;clearTimeout(timer)}
  },[normalized,mode,availabilityRetry])
  useEffect(()=>{setGuardianAccepted(false)},[birthDate])
  const fields={email,password,username,displayName,birthDate,guardianAccepted,terms}
  const currentErrors=mode==='register'?registrationErrors(fields):{}
  const available=availability.username===normalized && availability.state==='ok'
  function fieldError(name){return (touched[name]?currentErrors[name]:null) || errors[name]}
  function feedback(name){return fieldError(name)?<p id={`auth-${name}-error`} role="alert" className="mt-1.5 text-xs text-error">{fieldError(name)}</p>:null}
  function changeMode(next){setMode(next);setMsg({type:'',text:''});setErrors({});setTouched({})}
  function touch(name){setTouched(v=>({...v,[name]:true}))}
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setMsg({ type: '', text: '' })
    if(busy)return
    if(mode==='register'){
      const invalid=registrationErrors(fields)
      setErrors(invalid)
      if(Object.keys(invalid).length || !available)return
    }
    if(mode==='login' && (!email.trim() || !password)){
      setErrors({email:!email.trim()?'Escribe tu correo.':null,password:!password?'Escribe tu contraseña.':null})
      return
    }
    setBusy(true)
    try {
      if (mode === 'login') {
        await signIn({ email:email.trim(), password })
      } else {
        const user = await signUp({ email:email.trim(), password, username:normalized, displayName:displayName.trim(), birthDate, guardianAccepted:minor && guardianAccepted, terms, legalVersion:LEGAL_VERSION })
        if (!user) setMsg({ type: 'ok', text: 'Revisa tu correo para confirmar la cuenta.' })
      }
    } catch (err) {
      console.error('[Acceso]',{code:err.code || 'auth_error'})
      if(mode==='register'){setAvailabilityRetry(v=>v+1)}
      setMsg({ type: 'err', text: mode==='login'?'No pudimos iniciar sesión. Revisa tu correo, contraseña y conexión.':'No pudimos crear la cuenta. Revisa la disponibilidad del usuario e intenta de nuevo. Si ya tienes cuenta, inicia sesión.' })
    }
    setBusy(false)
  }

  const label = 'mb-1.5 mt-3.5 block text-[11px] font-semibold uppercase tracking-wider text-sub'
  const input = 'w-full rounded-small border border-line bg-card2 px-3.5 py-3 text-sm outline-none focus:border-pu'
  const tab = (m) =>
    `rounded-small py-2.5 font-semibold ${mode === m ? 'bg-pu-dark text-white shadow-card' : 'text-sub'}`

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center bg-transparent px-5 py-8 text-ink">
      <div className="relative mb-3.5 grid h-14 w-14 place-items-center self-center rounded-full border-2 border-pu text-2xl">
        ⚔️
        <i className="absolute -bottom-1 -right-2 grid h-5 w-5 place-items-center rounded-full bg-error-strong text-sm not-italic text-white">+</i>
      </div>
      <h1 className="text-center text-[28px] font-extrabold tracking-[.08em]">
        LIFE<span className="text-pu">RPG</span>
      </h1>
      <p className="mb-6 mt-1 text-center text-[11px] tracking-[.12em] text-sub">SUBE DE NIVEL EN LA VIDA REAL</p>

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl border border-line bg-card2 p-1">
        <button type="button" disabled={busy} className={tab('login')} onClick={() => changeMode('login')}>Iniciar sesión</button>
        <button type="button" disabled={busy} className={tab('register')} onClick={() => changeMode('register')}>Registrarse</button>
      </div>

      <form noValidate onSubmit={submit} aria-busy={busy} className="rounded-2xl border border-line bg-card p-[18px]">
        <label className={label} htmlFor="auth-email">Correo</label>
        <input id="auth-email" name="email" className={input} type="email" autoComplete="email" required placeholder="tu@email.com" value={email} disabled={busy} aria-invalid={Boolean(fieldError('email'))} aria-describedby={fieldError('email')?'auth-email-error':undefined} onBlur={()=>touch('email')} onChange={e=>{setEmail(e.target.value);setErrors(v=>({...v,email:null}))}}/>
        {feedback('email')}
        <label className={label} htmlFor="auth-password">Contraseña</label>
        <PasswordInput key={mode} id="auth-password" name="password" className={input} autoComplete={mode==='login'?'current-password':'new-password'} required minLength={mode==='register'?8:undefined} placeholder="••••••••" value={password} disabled={busy} aria-invalid={Boolean(fieldError('password'))} aria-describedby={fieldError('password')?'auth-password-error':undefined} onBlur={()=>touch('password')} onChange={e=>{setPassword(e.target.value);setErrors(v=>({...v,password:null}))}}/>
        {feedback('password')}
        {mode==='login' && <Link to="/recuperar" className="mt-3 block text-xs font-bold text-pu-light">¿Olvidaste tu contraseña?</Link>}
        {mode==='register' && <>
          <label className={label} htmlFor="auth-username">Nombre de usuario</label>
          <input id="auth-username" name="username" className={input} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={20} required value={username} disabled={busy} aria-invalid={Boolean(fieldError('username')) || availability.state==='taken'} aria-describedby="auth-username-help" onBlur={()=>touch('username')} onChange={e=>{setUsername(e.target.value.toLowerCase().replace(/\s/g,''));setErrors(v=>({...v,username:null}))}}/>
          <p id="auth-username-help" role="status" className={`mt-1.5 text-xs ${fieldError('username') || ['taken','error'].includes(availability.state)?'text-error':availability.state==='ok'?'text-success':'text-sub'}`}>{fieldError('username') || (availability.username===normalized && availability.message) || 'Letras sin tildes, números y guion bajo (3 a 20).'}</p>
          {availability.state==='error' && <button type="button" disabled={busy} className="min-h-[44px] text-xs text-pu-light underline" onClick={()=>setAvailabilityRetry(v=>v+1)}>Reintentar comprobación</button>}
          <label className={label} htmlFor="auth-displayName">Nombre para mostrar</label>
          <input id="auth-displayName" name="nickname" className={input} autoComplete="nickname" maxLength={40} required value={displayName} disabled={busy} aria-invalid={Boolean(fieldError('displayName'))} aria-describedby={fieldError('displayName')?'auth-displayName-error':'auth-display-help'} onBlur={()=>touch('displayName')} onChange={e=>{setDisplayName(e.target.value);setErrors(v=>({...v,displayName:null}))}}/>
          <p id="auth-display-help" className="mt-1.5 text-xs text-sub">No tiene que ser tu nombre legal. Lo usamos en tu perfil.</p>{feedback('displayName')}
          <label className={label} htmlFor="auth-birthDate">Fecha de nacimiento</label>
          <input id="auth-birthDate" name="bday" className={input} type="date" autoComplete="bday" max={today()} required value={birthDate} disabled={busy} aria-invalid={Boolean(fieldError('birthDate'))} aria-describedby={fieldError('birthDate')?'auth-birthDate-error':'auth-birth-help'} onBlur={()=>touch('birthDate')} onChange={e=>{setBirthDate(e.target.value);setErrors(v=>({...v,birthDate:null,guardianAccepted:null}))}}/>
          <p id="auth-birth-help" className="mt-1.5 text-xs text-sub">Para comprobar que tienes al menos {MINIMUM_AGE} años. Esta fecha no es pública.</p>{feedback('birthDate')}
          <p className="mt-3.5 text-xs leading-snug text-sub">Tu perfil empieza público: otras personas pueden ver tu usuario, avatar, nivel, XP, posición, racha y logros. Puedes volverlo privado en Configuración. Tu correo y fecha de nacimiento no se publican.</p>
          {minor && <><label className="mt-3.5 flex min-h-[44px] items-start gap-2 text-xs leading-snug text-sub"><input type="checkbox" className="mt-0.5" checked={guardianAccepted} disabled={busy} aria-describedby={fieldError('guardianAccepted')?'auth-guardianAccepted-error':undefined} onChange={e=>{setGuardianAccepted(e.target.checked);setErrors(v=>({...v,guardianAccepted:null}))}}/><span>Mi representante legal autoriza mi registro y el tratamiento de mis datos según la Política de privacidad, incluida la información visible de mi perfil público.</span></label>{feedback('guardianAccepted')}</>}
          <label className="mt-3.5 flex min-h-[44px] items-start gap-2 text-xs leading-snug text-sub"><input type="checkbox" className="mt-0.5" checked={terms} disabled={busy} aria-describedby={fieldError('terms')?'auth-terms-error':undefined} onChange={e=>{setTerms(e.target.checked);setErrors(v=>({...v,terms:null}))}}/><span>Leí y acepto los <Link to="/terminos" target="_blank" rel="noopener noreferrer" className="font-semibold text-pu-light underline">Términos y condiciones</Link> y autorizo el tratamiento de mis datos descrito en la <Link to="/privacidad" target="_blank" rel="noopener noreferrer" className="font-semibold text-pu-light underline">Política de privacidad</Link> (se abren en otra pestaña).</span></label>
          {feedback('terms')}
        </>}
        {msg.text && (
          <p role={msg.type==='err'?'alert':'status'} className={`mt-2.5 text-xs ${msg.type === 'ok' ? 'text-health' : 'text-strength'}`}>{msg.text}</p>
        )}
        <button
          disabled={busy || (mode==='register' && (!terms || (minor && !guardianAccepted) || !available))}
          className="mt-[18px] w-full rounded-xl bg-gradient-to-b from-pu-dark to-pu-pressed px-4 py-3.5 font-bold text-white shadow-card disabled:opacity-45 disabled:shadow-none"
        >
          {busy ? (mode==='login'?'Ingresando…':'Creando cuenta…') : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
        </button>
      </form>
    </div>
  )
}
