import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatCOPInput, parseCOPInput } from '../src/lib/copInput.js'

test('COP agrupa miles y conserva decimales sin cambiar el valor enviado',()=>{
  for(const raw of ['1000','123456789','1234.50','1.25'])assert.equal(parseCOPInput(formatCOPInput(raw)),raw)
  assert.equal(formatCOPInput('1234567'),'1.234.567')
  assert.equal(formatCOPInput('1234.50'),'1.234,50')
})
test('COP permite borrar y pegar valores colombianos sin aceptar texto ni negativos',()=>{
  assert.equal(parseCOPInput(''),'')
  assert.equal(parseCOPInput('1.234.567,89'),'1234567.89')
  assert.equal(parseCOPInput('-100'),null)
  assert.equal(parseCOPInput('abc'),null)
  assert.equal(parseCOPInput('1,2,3'),null)
})
