import { test } from 'node:test'
import assert from 'node:assert/strict'
import { weekdayInBogota, defaultRoutine, emptySet, initialSet, copySet, validSet, workoutStats, previousMarks } from '../src/lib/strengthRoutine.js'

test('selección usa día de Bogotá y deja vacío un día sin rutina',()=>{
  assert.equal(weekdayInBogota(new Date('2026-11-17T04:59:59Z')),1)
  assert.equal(weekdayInBogota(new Date('2026-11-17T05:00:00Z')),2)
  const routines=[{id:'a',days:[{weekday:1},{weekday:4}]},{id:'b',days:[{weekday:2}]}]
  assert.equal(defaultRoutine(routines,1),'a')
  assert.equal(defaultRoutine(routines,4),'a')
  assert.equal(defaultRoutine(routines,3),'')
  assert.equal(defaultRoutine([],1),'')
})
test('cuatro filas se copian sin compartir el objeto y conservan opcionales',()=>{
  const first={weight:'60',reps:'8',sets:'1',rest:'90',rir:'0'}
  const rows=[first]
  for(let i=0;i<3;i++)rows.push(copySet(rows))
  assert.equal(rows.length,4)
  assert.ok(rows.every(validSet))
  rows[3].weight='65'
  assert.equal(first.weight,'60')
  assert.equal(rows[3].rir,'0')
})
test('campos obligatorios incluyen series y peso cero explícito es válido',()=>{
  assert.equal(validSet(emptySet()),false)
  const row={...emptySet(),weight:'0',reps:'8'}
  assert.equal(validSet(row),true)
  for(const patch of [{weight:''},{reps:''},{sets:''},{sets:'0'},{reps:'2.5'},{rir:'11'},{rest:'-1'},{weight:'1001'}])assert.equal(validSet({...row,...patch}),false)
})
test('prefill conserva RIR 0 y no interpreta el RPE anterior como RIR',()=>{
  assert.deepEqual(initialSet([]),emptySet())
  assert.equal(initialSet([{weight_kg:60,reps:8,rpe:8,rir:null}]).rir,'')
  assert.equal(initialSet([{weight_kg:60,reps:8,rir:0}]).rir,'0')
})
test('resumen cuenta filas reales y compara volumen de la misma rutina',()=>{
  const old=[{exercise_id:'e',name:'Press',weight_kg:50,reps:8}]
  const today=[{exercise_id:'e',name:'Press',weight_kg:60,reps:8},{exercise_id:'e',name:'Press',weight_kg:60,reps:10}]
  const stats=workoutStats(today,old)
  assert.equal(stats.volume,1080)
  assert.equal(stats.sets,2)
  assert.equal(stats.delta,170)
  assert.equal(stats.best[0].reps,10)
  assert.equal(workoutStats([],[]).delta,null)
})
test('marcas cortas agrupan series iguales sin mezclar ejercicios ni RIR',()=>{
  const row={exercise_id:'a',weight_kg:60,reps:8,rir:2}
  const groups=previousMarks([row,{...row},{...row,rir:0},{...row,exercise_id:'b'}])
  assert.equal(groups.length,3)
  assert.equal(groups[0].count,2)
})
