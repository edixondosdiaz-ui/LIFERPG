import { addDays, weekStart, streakOf } from './dates.js'

export const WEEK_INITIALS = ['L','M','M','J','V','S','D']
export function habitWeekDays(date) {
  const start=weekStart(date)
  return WEEK_INITIALS.map((initial,index)=>({date:addDays(start,index),initial,habits:[]}))
}
export function habitStreak(dates, date) {
  return streakOf(new Set(dates.filter(d=>d<=date)),date)
}
export function habitWeekRows(summary, date) {
  const today=summary?.today || date
  return habitWeekDays(today).map(day=>({...day,habits:day.date<=today ? summary?.days?.find(d=>d.date===day.date)?.habits || [] : []}))
}
