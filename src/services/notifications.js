import { supabase } from './supabase'
export const NOTIFICATION_DEFAULTS={purchases:true,friends:true,study:true,habits:false,streak:false,habit_time:'19:00',streak_time:'21:00'}
const result=({data,error})=>{if(error)throw new Error('No pudimos consultar tus notificaciones. Intenta de nuevo.');return data}
export async function inbox(){const [rows,count]=await Promise.all([supabase.from('app_notifications').select('*').order('created_at',{ascending:false}).limit(50),supabase.from('app_notifications').select('id',{count:'exact',head:true}).is('read_at',null)]);if(count.error)throw Error('No pudimos consultar los avisos.');return {rows:result(rows),unread:count.count || 0}}
export const syncReminders=()=>supabase.rpc('sync_my_reminders').then(result)
export const markRead=id=>supabase.rpc('read_my_notifications',{p_id:id || null}).then(result)
export const notificationSettings=async()=>({...NOTIFICATION_DEFAULTS,...result(await supabase.from('notification_settings').select('*').maybeSingle())})
export const saveNotificationSettings=(userId,settings)=>supabase.from('notification_settings').upsert({user_id:userId,...Object.fromEntries(Object.keys(NOTIFICATION_DEFAULTS).map(k=>[k,settings[k]]))}).then(result)
