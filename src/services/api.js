import { supabase } from './supabase'
import { notifyHabitChanges } from '../lib/habitEvents'

const TZ = 'America/Bogota'
// Fecha de hoy en Colombia, formato AAAA-MM-DD
export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ })

export function unwrap({ data, error }) {
  if (error) {
    // PGRST202 = PostgREST no ve la función (migración sin correr o caché de esquema desactualizada)
    if (error.code === 'PGRST202' || error.code === 'PGRST205') {
      throw new Error(`Supabase no encuentra esta función (${error.code}). Ejecuta las migraciones de supabase/ (la última es 08_correr_caminar.sql) y luego: notify pgrst, 'reload schema';`)
    }
    // Cualquier otro error se muestra tal cual para poder diagnosticarlo
    throw new Error(`${error.message} [${error.code ?? 'sin código'}]`)
  }
  return data
}

/* ---------- Autenticación ---------- */

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session?.user ?? null
}

// Devuelve el usuario, o null si Supabase pide confirmar el correo antes de entrar
export async function signUp({ email, password }) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw new Error(error.message)
  return data.session ? data.user : null
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error('Correo o contraseña incorrectos')
  return data.user
}

export async function signOut() {
  await supabase.auth.signOut()
}

/* ---------- Perfil ---------- */

export async function getProfile() {
  return unwrap(await supabase.from('profiles').select('*').maybeSingle())
}

/* ---------- Hábitos ---------- */

export async function listHabitsToday() {
  return unwrap(
    await supabase.from('habit_logs').select('id, pillar, habit').eq('performed_at', today())
  )
}

export async function logHabit({ pillar, habit }) {
  const result = unwrap(await supabase.rpc('log_habit', { p_pillar: pillar, p_habit: habit }))
  notifyHabitChanges()
  return result
}

/* ---------- Fuerza ---------- */

export async function listExercises(weekday, routineId = null) {
  return unwrap(
    await supabase
      .from('exercises')
      .select('id, name, weekday')
      .eq('weekday', weekday)
      .match(routineId ? { routine_id: routineId } : {})
      .order('created_at', { ascending: true })
  )
}

export async function addExercise({ weekday, name, routineId = null }) {
  return unwrap(await supabase.from('exercises').insert({ weekday, name: name.trim(), routine_id: routineId }))
}

export async function deleteExercise(id) {
  return unwrap(await supabase.from('exercises').delete().eq('id', id))
}
export async function renameExercise(id, name) {
  return unwrap(await supabase.from('exercises').update({ name: name.trim().slice(0,80) }).eq('id',id))
}

export async function listSetsToday(exerciseId) {
  return unwrap(
    await supabase
      .from('workout_sets')
      .select('id, weight_kg, reps')
      .eq('exercise_id', exerciseId)
      .eq('performed_at', today())
      .order('created_at', { ascending: true })
  )
}

// Series de la sesión anterior más reciente (cualquier día antes de hoy)
export async function getLastSession(exerciseId) {
  const rows = unwrap(
    await supabase
      .from('workout_sets')
      .select('id, weight_kg, reps, performed_at')
      .eq('exercise_id', exerciseId)
      .lt('performed_at', today())
      .order('performed_at', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(50)
  )
  if (!rows.length) return []
  return rows.filter((r) => r.performed_at === rows[0].performed_at)
}

// Volumen (kg × reps) por día, de más antiguo a más reciente
export async function getVolume(exerciseId) {
  const rows = unwrap(
    await supabase
      .from('workout_sets')
      .select('weight_kg, reps, performed_at')
      .eq('exercise_id', exerciseId)
      .order('performed_at', { ascending: false })
      .limit(300)
  )
  const byDay = new Map()
  for (const r of rows) {
    byDay.set(r.performed_at, (byDay.get(r.performed_at) || 0) + Number(r.weight_kg) * r.reps)
  }
  return [...byDay.entries()]
    .map(([performed_at, volume]) => ({ performed_at, volume: Math.round(volume) }))
    .sort((a, b) => a.performed_at.localeCompare(b.performed_at))
}

export async function logSet({ exerciseId, weightKg, reps, rpe = null, restSeconds = null, notes = null }) {
  const r = await supabase.rpc('log_workout_set', {
    p_exercise_id: exerciseId, p_weight_kg: weightKg, p_reps: reps,
    p_rpe: rpe, p_rest_seconds: restSeconds, p_notes: notes,
  })
  // Si aún no corriste el script SQL nuevo, sigue funcionando con la función anterior
  if (r.error && r.error.code === 'PGRST202') {
    return unwrap(await supabase.rpc('log_set', { p_exercise_id: exerciseId, p_weight_kg: weightKg, p_reps: reps }))
  }
  return unwrap(r)
}

/* ---------- Ranking ---------- */

// Solo usuarios con nombre de usuario real (la vista ya filtra los que no completaron el onboarding)
export async function getLeaderboard() {
  return unwrap(await supabase.from('leaderboard').select('id, username, xp, avatar').order('xp', { ascending: false }).limit(50))
}

/* ---------- Identidad / onboarding ---------- */

export async function usernameAvailable(username) {
  return unwrap(await supabase.rpc('username_available', { p_username: username }))
}

export async function completeOnboarding({ username, displayName, avatar }) {
  return unwrap(await supabase.rpc('complete_onboarding', { p_username: username, p_display: displayName || '', p_avatar: avatar }))
}

export async function updateAvatar(avatar) {
  return unwrap(await supabase.rpc('update_avatar', { p_avatar: avatar }))
}

export async function updateDisplayName(displayName) {
  return unwrap(await supabase.rpc('update_display_name', { p_display: displayName || '' }))
}

export async function getStreak() {
  return unwrap(await supabase.rpc('my_current_streak')) ?? 0
}

export async function getMyEquipped() {
  return unwrap(await supabase.rpc('my_equipped')) ?? []
}

/* ---------- Logros ---------- */

// Calcula progreso y desbloquea en el servidor; devuelve todos los logros
export async function getAchievements() {
  return unwrap(await supabase.rpc('my_achievements'))
}

/* ---------- Tienda e inventario ---------- */

export async function listShopItems() {
  return unwrap(await supabase.from('shop_items').select('*').order('sort', { ascending: true }))
}

export async function listInventory() {
  return unwrap(await supabase.from('inventory').select('item_id, equipped'))
}

export async function buyItem(itemId) {
  return unwrap(await supabase.rpc('buy_item', { p_item_id: itemId }))
}

export async function equipItem(itemId, equip) {
  return unwrap(await supabase.rpc('equip_item', { p_item_id: itemId, p_equip: equip }))
}

/* ---------- Amigos ---------- */

export async function searchUsers(query) {
  return unwrap(await supabase.rpc('search_users', { p_query: query }))
}

export async function sendFriendRequest(username) {
  return unwrap(await supabase.rpc('send_friend_request', { p_username: username }))
}

export async function respondFriendRequest(friendshipId, accept) {
  return unwrap(await supabase.rpc('respond_friend_request', { p_friendship_id: friendshipId, p_accept: accept }))
}

// Elimina una amistad o cancela una solicitud enviada
export async function removeFriendship(friendshipId) {
  return unwrap(await supabase.rpc('remove_friendship', { p_friendship_id: friendshipId }))
}

export async function listFriendships() {
  return unwrap(await supabase.rpc('list_friendships'))
}

export async function getFriendProfile(username) {
  return unwrap(await supabase.rpc('visible_profile', { p_username: username }))
}
