import { test } from 'node:test'
import assert from 'node:assert/strict'
import { palette, tokens } from '../src/design/tokens.js'

function luminance(hex) {
  const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4)
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722
}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
test('texto y acentos AA sobre las superficies de lectura',()=>{
  const backgrounds=[palette.background.violet,palette.background.midnight,palette.surface.DEFAULT,palette.surface.raised,palette.surface.inset]
  const foregrounds=[palette.text.primary,palette.text.secondary,palette.brand.light,palette.strength,palette.health,palette.education,palette.finance,palette.success,palette.warning,palette.error]
  for(const fg of foregrounds)for(const bg of backgrounds)assert.ok(contrast(fg,bg)>=4.5,`${fg} sobre ${bg}: ${contrast(fg,bg).toFixed(2)}`)
})
test('texto blanco AA en los extremos del botón principal y botón de peligro',()=>{
  for(const bg of [palette.brand.dark,palette.brand.pressed,palette.errorStrong])assert.ok(contrast(palette.text.primary,bg)>=4.5)
})
test('chips con acento claro usan texto oscuro legible',()=>{
  for(const bg of [palette.brand.DEFAULT,palette.health,palette.hydration,palette.sleep,palette.nutrition])assert.ok(contrast(palette.background.violet,bg)>=4.5)
})
test('microinteracciones acotadas sin animaciones continuas',()=>{
  assert.ok(parseInt(tokens.motion.duration)>=150 && parseInt(tokens.motion.duration)<=250)
  assert.ok(parseInt(tokens.motion.enter)<=250)
  assert.equal(tokens.motion.press,'.98')
})
test('los bordes funcionales se distinguen de la superficie',()=>{
  assert.ok(contrast(palette.border.DEFAULT,palette.surface.inset)>=3)
  assert.ok(contrast(palette.border.DEFAULT,palette.surface.DEFAULT)>=3)
})
test('las fechas de la racha mantienen contraste AA',()=>{
  for(const bg of [palette.fire.light,palette.fire.warm])assert.ok(contrast(palette.fire.ink,bg)>=4.5)
  assert.ok(contrast(palette.text.secondary,palette.surface.raised)>=4.5)
})
