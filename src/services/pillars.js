import { supabase } from './supabase'
import { unwrap, today } from './api'
import { PRODUCT } from '../lib/product'

/* ---------- Ajustes y objetivos ---------- */

export const DEFAULT_SETTINGS = {
  water_goal_ml: PRODUCT.waterGoalMl, water_reminder_min: null, sleep_goal_h: 8,
  study_goal_min_week: 600,
}

export async function getSettings() {
  const row = unwrap(await supabase.from('pillar_settings').select('*').maybeSingle())
  return { ...DEFAULT_SETTINGS, ...(row || {}) }
}

export async function saveSettings(patch) {
  const { data: { user } } = await supabase.auth.getUser()
  return unwrap(await supabase.from('pillar_settings')
    .upsert({ user_id: user.id, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }))
}

/* ---------- Fuerza ---------- */

export async function logEntry({ exerciseId, weightKg, reps, sets, rpe = null, restSeconds = null, notes = null }) {
  return unwrap(await supabase.rpc('log_workout_entry', {
    p_exercise_id: exerciseId, p_weight_kg: weightKg, p_reps: reps, p_sets: sets,
    p_rpe: rpe, p_rest_seconds: restSeconds, p_notes: notes,
  }))
}

export async function deleteSet(id) {
  return unwrap(await supabase.rpc('delete_workout_set', { p_id: id }))
}

// Historial completo de un ejercicio, del más reciente al más antiguo
export async function listExerciseHistory(exerciseId) {
  return unwrap(await supabase.from('workout_sets')
    .select('id, weight_kg, reps, rpe, rest_seconds, notes, performed_at, created_at')
    .eq('exercise_id', exerciseId)
    .order('performed_at', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(800))
}

export async function listSetsSince(since) {
  return unwrap(await supabase.from('workout_sets')
    .select('exercise_id, weight_kg, reps, performed_at').gte('performed_at', since).limit(3000))
}

export async function listWorkoutSessions(since) {
  return unwrap(await supabase.from('workout_sessions')
    .select('id, duration_seconds, performed_at').gte('performed_at', since).order('performed_at', { ascending: true }))
}

export async function saveWorkoutSession(seconds) {
  return unwrap(await supabase.rpc('save_workout_session', { p_seconds: Math.round(seconds) }))
}

/* ---------- Salud ---------- */

export async function listWater(since) {
  return unwrap(await supabase.from('water_logs').select('id, ml, logged_on, created_at')
    .gte('logged_on', since).order('created_at', { ascending: true }).limit(3000))
}
export const logWater = async (ml) => unwrap(await supabase.rpc('log_water_quick', { p_ml: ml }))
export const deleteWater = async (id) => unwrap(await supabase.from('water_logs').delete().eq('id', id))

export async function listSleep(since) {
  return unwrap(await supabase.from('sleep_logs').select('id, slept_on, bed_time, wake_time, hours, quality')
    .gte('slept_on', since).order('slept_on', { ascending: true }))
}
export const logSleep = async ({ date, bed = null, wake = null, hours = null, quality = null }) =>
  unwrap(await supabase.rpc('log_sleep', { p_slept_on: date, p_bed: bed, p_wake: wake, p_hours: hours, p_quality: quality }))
export const deleteSleep = async (id) => unwrap(await supabase.from('sleep_logs').delete().eq('id', id))

/* ---------- Educación ---------- */

export async function listStudy(since) {
  return unwrap(await supabase.from('edu_sessions').select('id, topic, category, mode, minutes, studied_on, created_at')
    .gte('studied_on', since).order('created_at', { ascending: false }).limit(3000))
}
export const logStudy = async ({ topic, category, mode, minutes }) =>
  unwrap(await supabase.rpc('log_study_session', { p_topic: topic, p_category: category, p_mode: mode, p_minutes: minutes }))
export const deleteStudy = async (id) => unwrap(await supabase.from('edu_sessions').delete().eq('id', id))

export async function listTasks() {
  return unwrap(await supabase.from('edu_tasks').select('id, title, priority, due_on, done, done_at')
    .order('done', { ascending: true }).order('due_on', { ascending: true, nullsFirst: false }).limit(300))
}
export const addTask = async ({ title, priority, dueOn }) =>
  unwrap(await supabase.from('edu_tasks').insert({ title: title.trim(), priority, due_on: dueOn || null }))
export const setTaskDone = async (id, done) => unwrap(await supabase.rpc('set_task_done', { p_id: id, p_done: done }))
export const deleteTask = async (id) => unwrap(await supabase.from('edu_tasks').delete().eq('id', id))

/* ---------- Finanzas ---------- */

export const applyRecurring = async () => unwrap(await supabase.rpc('apply_recurring'))

export async function listTransactions(since = null) {
  let q = supabase.from('fin_transactions')
    .select('id, kind, amount, category, description, goal_id, occurred_on, from_recurring, created_at')
    .order('occurred_on', { ascending: false }).order('created_at', { ascending: false }).limit(5000)
  if (since) q = q.gte('occurred_on', since)
  return unwrap(await q)
}
export const logFin = async ({ kind, amount, category, description, goalId = null, date = null }) =>
  unwrap(await supabase.rpc('log_fin', {
    p_kind: kind, p_amount: amount, p_category: category, p_description: description || null,
    p_goal_id: goalId, p_date: date || today(),
  }))
export const deleteTransaction = async (id) => unwrap(await supabase.from('fin_transactions').delete().eq('id', id))

export async function listGoals() {
  return unwrap(await supabase.from('fin_goals').select('id, name, icon, target_amount, deadline').order('created_at', { ascending: true }))
}
export const addGoal = async ({ name, icon, target, deadline }) =>
  unwrap(await supabase.from('fin_goals').insert({ name: name.trim(), icon, target_amount: target, deadline: deadline || null }))
export const deleteGoal = async (id) => unwrap(await supabase.from('fin_goals').delete().eq('id', id))

export async function listRecurring() {
  return unwrap(await supabase.from('fin_recurring').select('*').order('created_at', { ascending: true }))
}
export const addRecurring = async ({ kind, amount, category, description, every, nextOn }) =>
  unwrap(await supabase.from('fin_recurring').insert({ kind, amount, category, description: description || null, every, next_on: nextOn }))
export const deleteRecurring = async (id) => unwrap(await supabase.from('fin_recurring').delete().eq('id', id))
