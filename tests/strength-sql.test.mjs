import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql=readFileSync(new URL('../supabase/15_fuerza_registro_diario.sql',import.meta.url),'utf8')

test('migración 15 delimita todos los cuerpos de funciones y bloques DO',()=>{
  assert.doesNotMatch(sql,/(?<!\$)\$(?!\$)/)
  const functions=[...sql.matchAll(/create or replace function\b/gi)].length
  const blocks=[...sql.matchAll(/\bdo \$\$/gi)].length
  const bodies=[...sql.matchAll(/\$\$[\s\S]*?\$\$;/g)]
  assert.equal(bodies.length,functions+blocks)
  assert.equal((sql.match(/\$\$/g)||[]).length,2*bodies.length)
  for(const name of ['add_routine_exercise','log_routine_exercise']){
    assert.match(sql,new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?as \\$\\$[\\s\\S]*?end \\$\\$;`))
  }
  assert.match(sql,/^begin;/m)
  assert.match(sql,/commit;\s*$/)
})
