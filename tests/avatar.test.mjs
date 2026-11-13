import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SKINS, HAIRS, HAIR_COLORS, EYE_COLORS, BEARDS, FACES, SHIRT_COLORS, randomAvatar, normalizeAvatar } from '../src/lib/avatar.js'

const options = {
  skin: SKINS, hair: HAIRS.map(x=>x.id), hairColor: HAIR_COLORS,
  eyes: EYE_COLORS, beard: BEARDS.map(x=>x.id), face: FACES.map(x=>x.id), shirtColor: SHIRT_COLORS,
}
test('el conjunto base cumple los tamaños de producto y no repite opciones',()=>{
  assert.deepEqual(Object.values(options).map(x=>x.length),[8,8,8,6,4,3,4])
  for(const values of Object.values(options)) assert.equal(new Set(values).size,values.length)
})
test('todos los rasgos ofrecidos también son aceptados por la validación SQL',()=>{
  const sql=readFileSync(new URL('../supabase/05_economia_avatar.sql',import.meta.url),'utf8')
  for(const [key,values] of Object.entries(options)) {
    const match=sql.match(new RegExp(`when '${key}' then array\\[([^\\]]+)\\]`))
    assert.ok(match,`Falta validación para ${key}`)
    const server=[...match[1].matchAll(/'([^']+)'/g)].map(m=>m[1])
    assert.deepEqual(server,[...values],`Cliente y servidor difieren en ${key}`)
  }
})
test('Aleatorio produce solo rasgos base y no equipa cosméticos de tienda',()=>{
  for(let i=0;i<500;i++) {
    const avatar=randomAvatar()
    for(const [key,values] of Object.entries(options)) assert.ok(values.includes(avatar[key]),key)
    assert.equal(avatar.accessory,'ninguno')
    assert.ok(!('equipped' in avatar))
  }
})
test('normalizar conserva rasgos antiguos y el color de su estética',()=>{
  const legacy={face:'alargado',accessory:'audifonos',aesthetic:'solar'}
  const normalized=normalizeAvatar(legacy)
  assert.equal(normalized.face,legacy.face)
  assert.equal(normalized.accessory,legacy.accessory)
  assert.equal(normalized.shirtColor,'#7c4a1d')
  assert.equal(normalizeAvatar({...legacy,shirtColor:'#111827'}).shirtColor,'#111827')
})
