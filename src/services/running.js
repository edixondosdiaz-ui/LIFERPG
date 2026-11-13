import { supabase } from './supabase'
import { unwrap } from './api'
export const getRules=async()=>unwrap(await supabase.from('running_rules').select('*').single())
export const activeRun=async()=>unwrap(await supabase.rpc('active_run'))
export const startRun=async activity=>unwrap(await supabase.rpc('start_run',{p_activity:activity}))
export const saveRun=async(id,seq,points,action,writer)=>unwrap(await supabase.rpc('save_run',{p_id:id,p_seq:seq,p_points:points,p_action:action,p_writer:writer}))
export const manualRun=async(activity,meters,seconds,id)=>unwrap(await supabase.rpc('log_manual_run',{p_activity:activity,p_meters:meters,p_seconds:seconds,p_request_id:id}))
export const discardRun=async id=>unwrap(await supabase.rpc('discard_run',{p_id:id}))
export const deleteRoute=async id=>unwrap(await supabase.rpc('delete_run_route',{p_id:id}))
export const overview=async()=>unwrap(await supabase.rpc('running_overview'))
export const history=async()=>unwrap(await supabase.from('running_sessions').select('id,activity,mode,status,meters,active_seconds,xp_awarded,suspicious,completed_on,route_deleted').eq('status','completed').order('finished_at',{ascending:false}).limit(50))
export async function route(id) {
  const points=[]
  for(let start=0;;start+=1000){const rows=unwrap(await supabase.from('running_points').select('latitude,longitude,recorded_at,accuracy,segment').eq('session_id',id).order('id').range(start,start+999));points.push(...rows.map(p=>({lat:p.latitude,lng:p.longitude,t:Date.parse(p.recorded_at),accuracy:Number(p.accuracy),segment:p.segment})));if(rows.length<1000)break}
  return points
}
