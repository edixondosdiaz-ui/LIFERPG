import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { palette } from '../src/design/tokens.js'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const variants={
  ascenso:{name:'Ascenso',description:'Un emblema de progreso con escalones y un destello: hábitos que se convierten en niveles.',
    mark:`<path d="M128 48 196 78v58c0 38-29 62-68 78-39-16-68-40-68-78V78Z" fill="url(#brand)"/>
      <path d="M88 161v-25h26v-27h27V83" fill="none" stroke="${palette.text.primary}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="m153 146 7 15 16 7-16 7-7 15-7-15-15-7 15-7Z" fill="${palette.text.primary}"/>`,
    small:`<path d="m128 44 72 32v60c0 38-31 64-72 81-41-17-72-43-72-81V76Z" fill="${palette.brand.DEFAULT}"/>
      <path d="M88 161v-29h29v-29h29V79" fill="none" stroke="${palette.text.primary}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>`},
  orbita:{name:'Órbita',description:'Un ciclo abierto de experiencia y una estrella de objetivo. Constancia que sigue creciendo.',
    mark:`<path d="M189 113a65 65 0 1 1-55-49" fill="none" stroke="url(#brand)" stroke-width="23" stroke-linecap="round"/>
      <path d="m93 127 25 25 30-38" fill="none" stroke="${palette.text.primary}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="m180 45 10 23 24 10-24 10-10 24-10-24-24-10 24-10Z" fill="${palette.brand.DEFAULT}"/>
      <path d="m180 62 5 11 12 5-12 5-5 12-5-12-11-5 11-5Z" fill="${palette.text.primary}"/>`,
    small:`<path d="M190 113a66 66 0 1 1-56-50" fill="none" stroke="${palette.brand.DEFAULT}" stroke-width="26" stroke-linecap="round"/>
      <path d="m94 128 24 24 28-37" fill="none" stroke="${palette.brand.DEFAULT}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="m181 47 10 22 22 10-22 10-10 23-10-23-22-10 22-10Z" fill="${palette.brand.DEFAULT}"/>`},
  ruta:{name:'Ruta',description:'Una L convertida en un recorrido ascendente. Un camino propio, una acción a la vez.',
    mark:`<path d="M76 65v111h50v-39h48V91" fill="none" stroke="url(#brand)" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M76 65v111h50v-39h48V91" fill="none" stroke="${palette.text.primary}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="m174 43 19 19-19 19-19-19Z" fill="${palette.brand.DEFAULT}"/>
      <path d="m174 53 9 9-9 9-9-9Z" fill="${palette.text.primary}"/>`,
    small:`<path d="M76 64v112h50v-39h48V93" fill="none" stroke="${palette.brand.DEFAULT}" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="m174 41 20 20-20 20-20-20Z" fill="${palette.brand.DEFAULT}"/>`},
}
const definitions=`<defs><linearGradient id="brand" x1="55" y1="48" x2="200" y2="214" gradientUnits="userSpaceOnUse"><stop stop-color="${palette.brand.light}"/><stop offset=".45" stop-color="${palette.brand.DEFAULT}"/><stop offset="1" stop-color="${palette.brand.dark}"/></linearGradient></defs>`
// Rotulación geométrica propia, trazada en SVG: no depende de fuentes externas.
function wordmark(light=false){return `<g transform="translate(184 45) scale(1.25)" fill="none" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
  <g stroke="${light?palette.background.violet:palette.text.primary}"><path d="M0 0v56h30M46 0v56M66 56V0h32M66 25h25M116 0v56h32M116 0h32M116 26h25"/></g>
  <g stroke="${light?palette.brand.dark:palette.brand.DEFAULT}"><path d="M174 56V0h21q18 0 18 16t-18 16h-21m20 0 24 24M237 56V0h21q18 0 18 16t-18 16h-21M324 5q-8-6-19-5-23 1-23 28t23 28h20V31h-18"/></g>
</g>`}
function svg(body,title,description,viewBox='0 0 256 256'){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-labelledby="title desc"><title id="title">${title}</title><desc id="desc">${description}</desc>${definitions}${body}</svg>\n`}
for(const [key,variant] of Object.entries(variants)){
  const dir=path.join(root,'public','brand','proposals',key);await fs.mkdir(dir,{recursive:true})
  const title=`LifeRPG · ${variant.name}`
  const lightMark=key==='orbita'?variant.mark.replace(`stroke="${palette.text.primary}"`,`stroke="${palette.brand.dark}"`):variant.mark
  await fs.writeFile(path.join(dir,'symbol.svg'),svg(variant.mark,title,variant.description))
  await fs.writeFile(path.join(dir,'symbol-light.svg'),svg(lightMark,title,variant.description))
  await fs.writeFile(path.join(dir,'logo.svg'),svg(`<g transform="translate(8 16) scale(.5)">${variant.mark}</g>${wordmark()}`,title,variant.description,'0 0 620 160'))
  await fs.writeFile(path.join(dir,'logo-light.svg'),svg(`<g transform="translate(8 16) scale(.5)">${lightMark}</g>${wordmark(true)}`,title,variant.description,'0 0 620 160'))
  await fs.writeFile(path.join(dir,'pwa.svg'),svg(`<rect width="256" height="256" fill="${palette.background.violet}"/><g transform="translate(16 16) scale(.875)">${variant.mark}</g>`,title,'Versión cuadrada con fondo y margen de seguridad para adaptación a ícono PWA.'))
  await fs.writeFile(path.join(dir,'favicon.svg'),svg(variant.small,title,'Símbolo simplificado para tamaños pequeños.','36 40 184 184'))
}
console.log('Generadas tres propuestas, cada una con logo oscuro/claro, símbolo, PWA y favicon SVG.')
