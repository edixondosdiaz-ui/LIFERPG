import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rankNumber,rankScore } from '../src/lib/ranking.js'

test('ranking usa separadores colombianos y no inventa números ausentes',()=>{
  assert.equal(rankNumber(1234567),'1.234.567')
  assert.equal(rankNumber(null),'—')
  assert.equal(rankNumber(undefined),'—')
  assert.equal(rankNumber(NaN),'—')
  assert.equal(rankNumber(0),'0')
})
test('la presentación respeta perfiles privados y la métrica del ámbito',()=>{
  const row={private:false,xp:20000,week_xp:500}
  assert.equal(rankScore(row,'global'),20000)
  assert.equal(rankScore(row,'friends'),20000)
  assert.equal(rankScore(row,'league'),500)
  assert.equal(rankScore({...row,private:true},'global'),null)
  assert.equal(rankScore({...row,private:true},'league'),null)
  assert.equal(rankScore({...row,week_xp:null},'league'),null)
})
