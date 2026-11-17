import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ageOn, birthDateValid, isMinor, registrationErrors, LEGAL_VERSION, MINIMUM_AGE } from '../src/lib/registration.js'
import { today } from '../src/lib/dates.js'

const day='2026-11-16'
const fields={email:'cuenta@example.com',password:'clave-prueba',username:'mi_usuario',displayName:'Mi nombre',birthDate:'2000-11-16',terms:true,guardianAccepted:false}
test('registro permite 15 años cumplidos, rechaza 14 y exige declaración solo hasta los 17',()=>{
  assert.equal(MINIMUM_AGE,15)
  assert.equal(ageOn('2011-11-16',day),15)
  assert.ok(registrationErrors({...fields,birthDate:'2011-11-17',guardianAccepted:true},day).birthDate)
  assert.ok(registrationErrors({...fields,birthDate:'2011-11-16'},day).guardianAccepted)
  assert.deepEqual(registrationErrors({...fields,birthDate:'2011-11-16',guardianAccepted:true},day),{})
  assert.equal(isMinor('2008-11-17',day),true)
  assert.equal(isMinor('2008-11-16',day),false)
  assert.deepEqual(registrationErrors({...fields,birthDate:'2008-11-16'},day),{})
})
test('edad usa la fecha colombiana y valida fechas imposibles o futuras',()=>{
  const before=today(new Date('2026-11-16T04:59:59Z')),after=today(new Date('2026-11-16T05:00:00Z'))
  assert.equal(ageOn('2011-11-16',before),14)
  assert.equal(ageOn('2011-11-16',after),15)
  for(const value of ['','0000-01-01','2026-02-30','2026-11-17','2001-02-29','16/11/2011'])assert.equal(birthDateValid(value,day),false)
  assert.equal(birthDateValid('2012-02-29',day),true)
})
test('cada campo tiene validación y ninguna casilla viene implícitamente aceptada',()=>{
  for(const [key,value] of Object.entries({email:'malo',password:'123',username:'no válido',displayName:' ',birthDate:'',terms:false})){
    assert.ok(registrationErrors({...fields,[key]:value},day)[key],key)
  }
  assert.equal(registrationErrors({...fields,username:'  MI_USUARIO  '},day).username,undefined)
})
test('SQL 16 conserva los delimitadores, versión y guardas del alta sin retroactividad',()=>{
  const sql=readFileSync(new URL('../supabase/16_registro_terminos.sql',import.meta.url),'utf8')
  const code=sql.replace(/'(?:''|[^'])*'/g,"''").replace(/--[^\n]*/g,'')
  assert.doesNotMatch(code,/(?<!\$)\$(?!\$)/)
  const count=[...sql.matchAll(/create or replace function\b|\bdo \$\$/gi)].length
  assert.equal([...sql.matchAll(/\$\$[\s\S]*?\$\$;/g)].length,count)
  assert.ok(sql.includes(`version_value constant text:='${LEGAL_VERSION}'`))
  assert.match(sql,/age_years<15/)
  assert.match(sql,/age_years<18 and not guardian_ok/)
  assert.match(sql,/id is distinct from p_exclude/)
  assert.doesNotMatch(sql,/update public\.profiles set|drop table|delete from/i)
  assert.match(sql,/commit;\s*$/)
})
