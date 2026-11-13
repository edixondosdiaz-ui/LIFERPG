import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../services/supabase'
import { unwrap } from '../services/api'
import { subscribeHabitChanges } from '../lib/habitEvents'

export default function useHabitWeek(userId) {
  const [data,setData]=useState(null),[error,setError]=useState('')
  const mounted=useRef(false),pending=useRef(false),again=useRef(false)
  const load=useCallback(async()=>{
    if(!userId)return
    if(pending.current){again.current=true;return}
    pending.current=true
    try {
      do {
        again.current=false
        const result=unwrap(await supabase.rpc('my_habit_week'))
        if(mounted.current){setData(result);setError('')}
      } while(again.current && mounted.current)
    } catch {
      if(mounted.current)setError('No pudimos cargar tu semana. Intenta de nuevo en un momento.')
    } finally {pending.current=false}
  },[userId])
  useEffect(()=>{
    if(!userId){setData(null);return}
    mounted.current=true;setData(null);load()
    const unsubscribe=subscribeHabitChanges(load)
    const refreshVisible=()=>{if(document.visibilityState==='visible')load()}
    window.addEventListener('focus',refreshVisible)
    document.addEventListener('visibilitychange',refreshVisible)
    // También cubre cambios de día, de semana y escrituras desde otra pestaña
    // cuando Realtime no está habilitado para esta tabla.
    const timer=setInterval(refreshVisible,30000)
    const channel=supabase.channel(`today-habits-${userId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'habit_logs',filter:`user_id=eq.${userId}`},load)
      .subscribe()
    return()=>{mounted.current=false;again.current=false;unsubscribe();clearInterval(timer);window.removeEventListener('focus',refreshVisible);document.removeEventListener('visibilitychange',refreshVisible);supabase.removeChannel(channel)}
  },[load,userId])
  return {data,error,reload:load}
}
