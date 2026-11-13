// El estado conserva el número sin separadores para las RPC existentes.
export function parseCOPInput(value) {
  const clean=value.replace(/\s/g,'')
  if(!/^[\d.]*(,\d*)?$/.test(clean))return null
  return clean.replaceAll('.','').replace(',','.')
}
export function formatCOPInput(value) {
  if(!value)return ''
  const [integer,fraction]=String(value).split('.')
  const grouped=integer.replace(/\B(?=(\d{3})+(?!\d))/g,'.')
  return grouped+(fraction!==undefined?`,`+fraction:'')
}
