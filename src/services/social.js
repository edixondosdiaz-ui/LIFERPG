import { supabase } from './supabase'
import { unwrap } from './api'
export const LEAGUES = ['Bronce','Plata','Oro','Platino','Diamante','Maestro']
export const ranking = async scope => unwrap(await supabase.rpc('ranking_rows',{p_scope:scope}))
export const userSummary = async (username,scope='global') => unwrap(await supabase.rpc('ranking_user_summary',{p_username:username,p_scope:scope}))
export const trends = async () => unwrap(await supabase.rpc('premium_trends'))
export const syncPremium = async () => unwrap(await supabase.rpc('sync_premium_benefits'))
export const routineQuota = async () => unwrap(await supabase.rpc('routine_quota'))
export const listRoutines = async () => unwrap(await supabase.from('routines').select('id,name').order('created_at'))
export const addRoutine = async name => unwrap(await supabase.from('routines').insert({name:name.trim()}).select('id').single())
export const renameRoutine = async (id,name) => unwrap(await supabase.from('routines').update({name:name.trim()}).eq('id',id))
export const deleteRoutine = async id => unwrap(await supabase.from('routines').delete().eq('id',id))
