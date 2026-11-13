import { supabase } from './supabase'
import { unwrap } from './api'
export const loadHealthLayout=async()=>unwrap(await supabase.from('health_layout_preferences').select('section_order').maybeSingle())
export const saveHealthLayout=async(userId,order)=>unwrap(await supabase.from('health_layout_preferences').upsert({user_id:userId,section_order:order}))
