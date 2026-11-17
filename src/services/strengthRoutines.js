import { supabase } from './supabase'

function result(response){
  if(response.error){const error=new Error('No pudimos completar la solicitud. Intenta de nuevo en un momento.');error.uncertain=!response.error.code;throw error}
  return response.data
}
export const scheduledRoutines=async()=>result(await supabase.from('routines').select('id,name,days:routine_days(weekday)').is('deleted_at',null).order('created_at'))
export const routineExercises=async id=>result(await supabase.from('routine_exercises').select('default_weight_kg,default_reps,default_sets,exercise:exercises(id,name)').eq('routine_id',id).order('created_at')).filter(r=>r.exercise).map(r=>({...r.exercise,default_weight_kg:r.default_weight_kg,default_reps:r.default_reps,default_sets:r.default_sets}))
export const routineState=async id=>result(await supabase.rpc('routine_workout_state',{p_routine:id}))
export const createRoutine=async(name,days,exercises,request)=>result(await supabase.rpc('create_training_routine',{p_name:name,p_days:days,p_exercises:exercises,p_request:request}))
export const addToRoutine=async(routine,weekday,exercise=null,name=null)=>result(await supabase.rpc('add_routine_exercise',{p_routine:routine,p_weekday:weekday,p_exercise:exercise,p_name:name}))
export const searchExercises=async query=>result(await supabase.from('exercises').select('id,name').ilike('name',`%${query.replace(/[%_\\]/g,'')}%`).order('name').limit(20))
export const unlinkExercise=async(routine,exercise)=>result(await supabase.rpc('remove_daily_exercise',{p_routine:routine,p_exercise:exercise}))
export const saveExercise=async(routine,exercise,rows,request)=>result(await supabase.rpc('save_daily_exercise',{p_routine:routine,p_exercise:exercise,p_rows:rows,p_request:request}))

export const todayRoutines=async()=>result(await supabase.rpc('my_today_routines'))
export const archiveRoutine=async id=>result(await supabase.rpc('archive_routine',{p_routine:id}))
export const setRoutineDays=async(id,days)=>result(await supabase.rpc('set_routine_days',{p_routine:id,p_days:days}))
