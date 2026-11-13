export const HEALTH_ORDER=['running','water','sleep','food']
export const HEALTH_TITLES={running:'Running o caminata',water:'Hidratación',sleep:'Sueño',food:'Registro de alimentos'}
export function validHealthOrder(order){return Array.isArray(order) && order.length===4 && new Set(order).size===4 && HEALTH_ORDER.every(id=>order.includes(id))}
export function healthOrder(order){return validHealthOrder(order)?[...order]:[...HEALTH_ORDER]}
export function moveHealthSection(order,from,to){
  const next=healthOrder(order),a=next.indexOf(from),b=next.indexOf(to)
  if(a<0 || b<0)return next
  next.splice(b,0,next.splice(a,1)[0]);return next
}
export function healthFailure(error,message='No pudimos completar la solicitud. Intenta de nuevo en un momento.'){
  console.error('[Salud]',error)
  return message
}
