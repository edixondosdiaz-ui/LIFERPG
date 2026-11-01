import { useState } from 'react';
import * as auth from '../services/auth';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [terms, setTerms] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    if (mode === 'register' && !terms) return setMsg({ type: 'err', text: 'Debes aceptar los Términos y la política de datos (Ley 1581 de 2012).' });
    setBusy(true);
    try {
      const r = mode === 'login' ? await auth.signIn(email, pass) : await auth.signUp(email, pass);
      if (r) setMsg({ type: 'ok', text: r });
    } catch (err) { setMsg({ type: 'err', text: err.message }); }
    setBusy(false);
  };

  const forgot = async () => {
    try { setMsg({ type: 'ok', text: await auth.resetPassword(email) }); }
    catch (err) { setMsg({ type: 'err', text: err.message }); }
  };

  return (
    <div className="auth">
      <div className="logo-badge">⚔️<i>+</i></div>
      <h1 className="brand"><span>LIFE</span><b>RPG</b></h1>
      <p className="tag">SUBE DE NIVEL EN LA VIDA REAL</p>

      <div className="seg">
        <button className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>Iniciar Sesión</button>
        <button className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>Registrarse</button>
      </div>

      <form className="card" onSubmit={submit}>
        <label>CORREO</label>
        <input type="email" required placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label>CONTRASEÑA</label>
        <input type="password" required placeholder="••••••••" value={pass} onChange={(e) => setPass(e.target.value)} />
        {mode === 'register' && (
          <label className="terms">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
            Acepto los Términos y Condiciones y autorizo el tratamiento de mis datos y fotos de evidencia.
          </label>
        )}
        {msg.text && <p className={`msg ${msg.type}`}>{msg.text}</p>}
        <button className="btn primary" disabled={busy}>{busy ? '...' : mode === 'login' ? 'Iniciar Sesión' : 'Crear cuenta'}</button>
        {mode === 'login' && <button type="button" className="link" onClick={forgot}>¿Olvidaste tu contraseña?</button>}
      </form>
    </div>
  );
}
