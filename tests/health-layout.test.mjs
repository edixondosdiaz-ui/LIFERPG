import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HEALTH_ORDER, healthOrder, validHealthOrder, moveHealthSection, healthFailure } from '../src/lib/healthLayout.js'
test('Salud valida cuatro módulos distintos y recupera el orden predeterminado',()=>{
  for(const invalid of [null,[],['water','sleep','food'],['water','water','sleep','food'],['running','water','sleep','other']]){
    assert.equal(validHealthOrder(invalid),false);assert.deepEqual(healthOrder(invalid),HEALTH_ORDER)
  }
  assert.equal(validHealthOrder(['food','sleep','running','water']),true)
})
test('mover una tarjeta conserva todos los módulos y no muta el orden anterior',()=>{
  const original=healthOrder()
  const moved=moveHealthSection(original,'food','running')
  assert.deepEqual(moved,['food','running','water','sleep'])
  assert.deepEqual(original,HEALTH_ORDER)
  assert.deepEqual(moveHealthSection(moved,'unknown','water'),moved)
  assert.deepEqual(healthOrder(moved),moved)
})
test('los detalles técnicos solo se envían a consola',()=>{
  const error=new Error('Supabase PGRST202: missing RPC'),logs=[]
  const original=console.error;console.error=(...args)=>logs.push(args)
  try{const message=healthFailure(error);assert.ok(!message.includes('Supabase'));assert.ok(!message.includes('PGRST'));assert.equal(logs[0][1],error)}finally{console.error=original}
})
