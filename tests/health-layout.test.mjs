import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HEALTH_ORDER, healthOrder, validHealthOrder, moveHealthSection, storedHealthOrder, healthFailure } from '../src/lib/healthLayout.js'
test('Salud valida tres módulos distintos y recupera el orden predeterminado',()=>{
  for(const invalid of [null,[],['water','sleep'],['water','water','sleep','food'],['running','water','sleep','other']]){
    assert.equal(validHealthOrder(invalid),false);assert.deepEqual(healthOrder(invalid),HEALTH_ORDER)
  }
  assert.equal(validHealthOrder(['sleep','running','water']),true)
  assert.deepEqual(healthOrder(['food','sleep','running','water']),['sleep','running','water'])
})
test('mover una tarjeta conserva todos los módulos y no muta el orden anterior',()=>{
  const original=healthOrder()
  const moved=moveHealthSection(original,'sleep','running')
  assert.deepEqual(moved,['sleep','running','water'])
  assert.deepEqual(original,HEALTH_ORDER)
  assert.deepEqual(moveHealthSection(moved,'unknown','water'),moved)
  assert.deepEqual(healthOrder(moved),moved)
})
test('los detalles técnicos solo se envían a consola',()=>{
  const error=new Error('Supabase PGRST202: missing RPC'),logs=[]
  const original=console.error;console.error=(...args)=>logs.push(args)
  try{const message=healthFailure(error);assert.ok(!message.includes('Supabase'));assert.ok(!message.includes('PGRST'));assert.equal(logs[0][1],error)}finally{console.error=original}
})

test('órdenes heredados y guardados conservan los tres módulos visibles',()=>{
  for(const legacy of [['food','sleep','water','running'],['sleep','food','running','water'],['running','water','sleep','food']]){
    const visible=healthOrder(legacy),saved=storedHealthOrder(visible)
    assert.deepEqual(visible,legacy.filter(id=>id!=='food'))
    assert.equal(saved.length,4);assert.equal(new Set(saved).size,4)
    assert.deepEqual(healthOrder(saved),visible)
    assert.deepEqual(healthOrder(storedHealthOrder(moveHealthSection(visible,'water','sleep'))),moveHealthSection(visible,'water','sleep'))
  }
})
