export const emptyTemplate=()=>({name:'',weight:'',sets:'',reps:''})
export function routineErrors(name,days,exercises){
 const errors={}
 if(!name.trim())errors.name='Falta el nombre de la rutina'
 if(!days.length)errors.days='Elige al menos un día'
 if(!exercises.length)errors.exercises='Agrega al menos un ejercicio'
 for(const [i,e] of exercises.entries()){
  if(!e.name.trim())errors['name-'+i]='Falta el nombre del ejercicio'
  if(e.weight==='' || !Number.isFinite(Number(e.weight)) || Number(e.weight)<0 || Number(e.weight)>1000)errors['weight-'+i]='Indica el peso (0 a 1000 kg)'
  if(e.sets==='' || !Number.isInteger(Number(e.sets)) || Number(e.sets)<1 || Number(e.sets)>30)errors['sets-'+i]='Indica de 1 a 30 series'
  if(e.reps==='' || !Number.isInteger(Number(e.reps)) || Number(e.reps)<1 || Number(e.reps)>200)errors['reps-'+i]='Indica de 1 a 200 repeticiones'
 }
 return errors
}
export const validStudyMinutes=value=>value!=='' && Number.isInteger(Number(value)) && Number(value)>=1 && Number(value)<=180
export function templateSets(e){return Array.from({length:e.default_sets || 1},()=>({weight:e.default_weight_kg==null?'':String(e.default_weight_kg),reps:e.default_reps==null?'':String(e.default_reps),sets:'1',rest:'',rir:''}))}
