import { test } from 'node:test'
import assert from 'node:assert/strict'
import { haversine,filterPoint,routePaths,paceText,METERS_PER_MILE } from '../src/lib/running.js'
const rules={accuracy_m:30,sample_seconds:5,gap_seconds:120,jump_m:200,walk_max_mps:3,run_max_mps:8}
const start={lat:0,lng:0,t:1000000,accuracy:5,segment:0}
test('Haversine: distancia nula, grado ecuatorial y cruce del antimeridiano',()=>{
 assert.equal(haversine(start,start),0)
 assert.ok(Math.abs(haversine(start,{lat:0,lng:1})-111194.927)<1)
 assert.ok(haversine({lat:0,lng:179.99},{lat:0,lng:-179.99})<2300)
})
test('se aceptan pasos plausibles y se rechazan errores, ruido y puntos repetidos',()=>{
 const next={...start,lng:.0001,t:start.t+10000}
 assert.equal(filterPoint(start,next,'walk',rules).accepted,true)
 assert.equal(filterPoint(start,{...next,accuracy:31},'walk',rules).accepted,false)
 assert.equal(filterPoint(start,{...next,lat:91},'walk',rules).accepted,false)
 assert.equal(filterPoint(start,{...next,t:start.t},'walk',rules).accepted,false)
 assert.equal(filterPoint(start,{...next,lng:.000001},'walk',rules).accepted,false)
 assert.equal(filterPoint(start,{...next,lng:NaN},'walk',rules).accepted,false)
})
test('los saltos y velocidades de vehículo no aumentan distancia',()=>{
 const result=filterPoint(start,{...start,lng:.002,t:start.t+5000},'run',rules)
 assert.equal(result.accepted,false)
 assert.equal(result.meters,undefined)
 assert.equal(filterPoint(start,{...start,lng:.0005,t:start.t+5000},'walk',rules).accepted,false)
})
test('una interrupción larga abre un segmento sin inventar el trayecto perdido',()=>{
 const result=filterPoint(start,{...start,lng:.02,t:start.t+300000},'walk',rules)
 assert.deepEqual(result,{accepted:true,meters:0,break:true})
})
test('el SVG mantiene separados los segmentos de pausa y se ajusta al lienzo',()=>{
 const paths=routePaths([start,{...start,lng:.0001},{...start,lat:.01,segment:1},{...start,lat:.011,segment:1}])
 assert.equal(paths.length,2)
 assert.ok(paths.every(p=>p.startsWith('M') && p.includes(' L')))
 for(const path of paths)for(const m of path.matchAll(/(-?\d+\.\d+)/g))assert.ok(Number(m[1])>=20 && Number(m[1])<=280)
 assert.deepEqual(routePaths([]),[])
})
test('ritmo vacío no muestra infinito y las unidades conservan conversión exacta',()=>{
 assert.equal(paceText(Infinity),'–');assert.equal(paceText(null),'–');assert.equal(paceText(305),'5:05')
 assert.equal(METERS_PER_MILE,1609.344)
})
