import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const visited=new Set(),errors=[]
function visit(file) {
  if(visited.has(file))return
  visited.add(file)
  const source=fs.readFileSync(file,'utf8')
  if(!file.endsWith(path.normalize('design/tokens.js'))) {
    // Excluye referencias SVG url(#id) y colores calculados de avatares.
    if(/#[\da-f]{3,8}(?=['"\],;)\s]|$)|\brgba?\(\s*\d|\bhsla?\(\s*\d/i.test(source))errors.push(`${path.relative(root,file)}: color literal fuera de los tokens`)
  }
  for(const match of source.matchAll(/(?:from\s+|import\s*\(|import\s*)['"](\.[^'"]+)['"]/g)) {
    const base=path.resolve(path.dirname(file),match[1])
    const target=['','.js','.jsx','.css'].map(ext=>base+ext).find(p=>fs.existsSync(p)&&fs.statSync(p).isFile())
    if(!target)errors.push(`${path.relative(root,file)}: no existe ${match[1]}`)
    else visit(target)
  }
}
visit(path.join(root,'src/main.jsx'))
const html=fs.readFileSync(path.join(root,'index.html'),'utf8')
if(/fonts\.googleapis|fonts\.gstatic/.test(html))errors.push('Las fuentes deben cargarse localmente')
if(errors.length){console.error(errors.join('\n'));process.exitCode=1}
else console.log(`Tokens e importaciones correctos en ${visited.size} archivos activos. Fuentes sin CDN.`)
