import { supabase } from './supabase'
import { unwrap } from './api'

export const activity = async () => unwrap(await supabase.rpc('my_activity'))
export const summary = async () => unwrap(await supabase.rpc('my_profile_summary'))
export const rename = async (username) => unwrap(await supabase.rpc('change_my_username', { p_username: username }))
export const deleteAccount = async (confirmation) => unwrap(await supabase.rpc('delete_my_account', { p_confirmation: confirmation }))
export const getPreferences = async () => unwrap(await supabase.from('app_preferences').select('*').maybeSingle())
export async function savePreferences(patch) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Vuelve a iniciar sesión')
  return unwrap(await supabase.from('app_preferences').upsert({ user_id: user.id, ...patch }))
}
export const getTimer = async (kind) => unwrap(await supabase.from('active_timers').select('*').eq('kind', kind).maybeSingle())
export const timerAction = async (kind, action, config = {}) => unwrap(await supabase.rpc('timer_action', { p_kind: kind, p_action: action, p_config: config }))
export const timerSeconds = (timer) => !timer ? 0 : timer.elapsed_seconds + (timer.running_since ? Math.max(0, (Date.now() - Date.parse(timer.running_since)) / 1000) : 0)
export const wellbeing = async (since) => unwrap(await supabase.from('wellbeing_logs').select('logged_on,energy,stress,fatigue').gte('logged_on', since).order('logged_on'))
export async function saveWellbeing(values) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Vuelve a iniciar sesión')
  return unwrap(await supabase.from('wellbeing_logs').upsert({ user_id: user.id, ...values }))
}
