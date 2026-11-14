export const DAY_INITIALS=['L','M','M','J','V','S','D']
export const DAY_NAMES=['lunes','martes','miércoles','jueves','viernes','sábado','domingo']
export const weekdayInBogota=(date=new Date())=>{
  const day=new Intl.DateTimeFormat('en-US',{timeZone:'America/Bogota',weekday:'short'}).format(date)
  return ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(day)+1
}
export const defaultRoutine=(routines,day)=>routines.find(r=>r.days.some(d=>d.weekday===day))?.id || ''
export const emptySet=()=>({weight:'',reps:'',sets:'1',rest:'',rir:''})
export const copySet=rows=>({...rows.at(-1),sets:'1'})
export function initialSet(previous){
  const row=previous.at(-1)
  return row?{weight:String(row.weight_kg),reps:String(row.reps),sets:'1',rest:row.rest_seconds==null?'':String(row.rest_seconds),rir:row.rir==null?'':String(row.rir)}:emptySet()
}
export function validSet(row){
  const int=(v,min,max)=>v!=='' && Number.isInteger(Number(v)) && Number(v)>=min && Number(v)<=max
  return row.weight!=='' && Number.isFinite(Number(row.weight)) && Number(row.weight)>=0 && Number(row.weight)<=1000
    && int(row.reps,1,200) && int(row.sets,1,30) && (row.rir==='' || int(row.rir,0,10)) && (row.rest==='' || int(row.rest,0,86400))
}
export function workoutStats(rows,previous=[]){
  const volume=a=>a.reduce((n,r)=>n+Number(r.weight_kg)*r.reps,0)
  const total=volume(rows),before=volume(previous)
  const best=new Map()
  for(const row of rows){const old=best.get(row.exercise_id);if(!old || Number(row.weight_kg)>Number(old.weight_kg) || (Number(row.weight_kg)===Number(old.weight_kg) && row.reps>old.reps))best.set(row.exercise_id,row)}
  return {volume:total,sets:rows.length,delta:before?(total-before)/before*100:null,best:[...best.values()]}
}
export function previousMarks(rows){
  const groups=[]
  for(const row of rows){const old=groups.find(g=>g.exercise_id===row.exercise_id && Number(g.weight_kg)===Number(row.weight_kg) && g.reps===row.reps && (g.rir??null)===(row.rir??null))
    if(old)old.count++;else groups.push({...row,count:1})}
  return groups
}

export function seriesRows(sets){return sets.map(s=>({weight:String(s.weight_kg),reps:String(s.reps),sets:'1',rest:s.rest_seconds==null?'':String(s.rest_seconds),rir:s.rir==null?'':String(s.rir)}))}
export function compactMarks(rows){
 const groups=new Map()
 for(const row of rows){const id=row.exercise_id;if(!groups.has(id))groups.set(id,{id,name:row.name,rows:[]});groups.get(id).rows.push(row)}
 return [...groups.values()].map(g=>{
  const sameWeight=g.rows.every(r=>Number(r.weight_kg)===Number(g.rows[0].weight_kg)),sameReps=g.rows.every(r=>r.reps===g.rows[0].reps)
  return {...g,sameWeight,sameReps}
 })
}
