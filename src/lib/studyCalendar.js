import { addDays, today } from './dates.js'
export const STUDY_WEEKDAYS=['L','M','M','J','V','S','D']
export const STUDY_LEVEL_LABELS=['Sin actividad','1–29 min','30–59 min','60–119 min','120+ min']
export const studyLevel=minutes=>minutes<=0?0:minutes<30?1:minutes<60?2:minutes<120?3:4
export function shiftStudyMonth(month,delta){
  const date=new Date(`${month}-01T12:00:00Z`);date.setUTCMonth(date.getUTCMonth()+delta)
  return `${String(date.getUTCFullYear()).padStart(4,'0')}-${String(date.getUTCMonth()+1).padStart(2,'0')}`
}
export function studyMonthDays(month){
  const first=`${month}-01`
  const leading=(new Date(`${first}T12:00:00Z`).getUTCDay()+6)%7
  const end=new Date(`${first}T12:00:00Z`);end.setUTCMonth(end.getUTCMonth()+1,0)
  const last=end.getUTCDate()
  const length=Math.ceil((leading+last)/7)*7
  return Array.from({length},(_,i)=>i<leading || i>=leading+last?null:addDays(first,i-leading))
}
export const studyMonthLabel=month=>new Date(`${month}-01T12:00:00Z`).toLocaleDateString('es-CO',{month:'long',year:'numeric',timeZone:'UTC'})
export function studyDate(session){
  // studied_on ya es DATE calculado en Bogotá por app_today(): no volver a desplazarlo.
  return session.studied_on || today(new Date(session.created_at))
}
export function studyDaySummary(rows){
  return {minutes:rows.reduce((n,s)=>n+Number(s.minutes),0),pomodoros:rows.filter(s=>s.mode==='pomodoro').length,
    xp:rows.reduce((n,s)=>n+(s.xp_awarded==null?0:Number(s.xp_awarded)),0),unknownXp:rows.filter(s=>s.xp_awarded==null).length}
}
export function studyMonthSummary(rows){
  const days=new Set(rows.filter(s=>Number(s.minutes)>0).map(studyDate)),sorted=[...days].sort()
  let best=0,current=0,previous=null
  for(const date of sorted){current=previous && addDays(previous,1)===date?current+1:1;best=Math.max(best,current);previous=date}
  return {...studyDaySummary(rows),activeDays:days.size,bestStreak:best}
}
