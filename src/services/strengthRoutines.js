import { supabase } from './supabase'

function result(response){
  if(response.error){const error=new Error('No pudimos completar la solicitud. Intenta de nuevo en un momento.');error.uncertain=!response.error.code;throw error}
  return response.data
}
export const scheduledRoutines=async()=>result(await supabase.from('routines').select('id,name,days:routine_days(weekday)').order('created_at'))
export const routineExercises=async id=>result(await supabase.from('routine_exercises').select('exercise:exercises(id,name)').eq('routine_id',id).order('created_at')).map(r=>r.exercise).filter(Boolean)
export const routineState=async id=>result(await supabase.rpc('routine_workout_state',{p_routine:id}))
export const createRoutine=async(name,days,names)=>result(await supabase.rpc('create_scheduled_routine',{p_name:name,p_days:days,p_names:names}))
export const addToRoutine=async(routine,weekday,exercise=null,name=null)=>result(await supabase.rpc('add_routine_exercise',{p_routine:routine,p_weekday:weekday,p_exercise:exercise,p_name:name}))
export const searchExercises=async query=>result(await supabase.from('exercises').select('id,name').ilike('name',`%${query.replace(/[%_\\]/g,'')}%`).order('name').limit(20))
export const unlinkExercise=async(routine,exercise)=>result(await supabase.from('routine_exercises').delete().eq('routine_id',routine).eq('exercise_id',exercise))
export const saveExercise=async(routine,exercise,rows,request)=>result(await supabase.rpc('log_routine_exercise',{p_routine:routine,p_exercise:exercise,p_rows:rows,p_request:request}))
