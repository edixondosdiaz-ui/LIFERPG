import { test } from 'node:test'
import assert from 'node:assert/strict'
import { healthFailure } from '../src/lib/healthLayout.js'
import { PILLAR_MENUS, firstPillarPath } from '../src/lib/pillarNavigation.js'
test('cada menú tiene rutas distintas y primera opción estable sin alimentos',()=>{for(const [pillar,items] of Object.entries(PILLAR_MENUS)){assert.equal(new Set(items.map(i=>i.path)).size,items.length);assert.equal(firstPillarPath(pillar),'/pilares/'+pillar+'/'+items[0].path)}assert.deepEqual(PILLAR_MENUS.salud.map(i=>i.path),['correr','hidratacion','sueno'])})
test('Salud no muestra detalles técnicos',()=>{const original=console.error;console.error=()=>{};try{assert.ok(!healthFailure(new Error('Supabase')).includes('Supabase'))}finally{console.error=original}})
