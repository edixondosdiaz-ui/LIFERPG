import { supabase } from '../lib/supabase';

// Modo local (sin Supabase): SOLO para desarrollo/demo, las claves no se cifran.
const USERS = 'liferpg_users';
const SESSION = 'liferpg_session';
const listeners = new Set();
const read = (k) => JSON.parse(localStorage.getItem(k) || 'null');
const emit = (u) => listeners.forEach((f) => f(u));
const mapUser = (u) => (u ? { id: u.id, email: u.email } : null);

export async function getSession() {
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    return mapUser(data.session?.user);
  }
  return read(SESSION);
}

export function onChange(cb) {
  if (supabase) {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => cb(mapUser(s?.user)));
    return () => data.subscription.unsubscribe();
  }
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function signIn(email, password) {
  if (supabase) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error('Correo o contraseña incorrectos');
    return;
  }
  const u = (read(USERS) || {})[email.toLowerCase()];
  if (!u || u.password !== password) throw new Error('Correo o contraseña incorrectos');
  const s = { id: u.id, email: email.toLowerCase() };
  localStorage.setItem(SESSION, JSON.stringify(s));
  emit(s);
}

export async function signUp(email, password) {
  if (password.length < 6) throw new Error('La contraseña debe tener mínimo 6 caracteres');
  if (supabase) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    if (!data.session) return 'Revisa tu correo para confirmar la cuenta.';
    return;
  }
  const users = read(USERS) || {};
  const k = email.toLowerCase();
  if (users[k]) throw new Error('Ese correo ya está registrado');
  users[k] = { id: crypto.randomUUID(), password };
  localStorage.setItem(USERS, JSON.stringify(users));
  const s = { id: users[k].id, email: k };
  localStorage.setItem(SESSION, JSON.stringify(s));
  emit(s);
}

export async function signOut() {
  if (supabase) return supabase.auth.signOut();
  localStorage.removeItem(SESSION);
  emit(null);
}

export async function resetPassword(email) {
  if (!email) throw new Error('Escribe tu correo primero');
  if (supabase) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw new Error(error.message);
  }
  return 'Si el correo existe, recibirás instrucciones para recuperar tu contraseña.';
}
