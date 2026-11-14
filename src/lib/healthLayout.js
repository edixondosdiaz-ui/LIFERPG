export const HEALTH_ORDER=['running','water','sleep']
export const HEALTH_TITLES={running:'Running o caminata',water:'Hidratación',sleep:'Sueño'}
export function validHealthOrder(order){return Array.isArray(order) && order.length===3 && new Set(order).size===3 && HEALTH_ORDER.every(id=>order.includes(id))}
export function healthOrder(order){
  const visible=Array.isArray(order)?order.filter(id=>id!=='food'):null
  return validHealthOrder(visible)?[...visible]:[...HEALTH_ORDER]
}
// Compatibilidad con la restricción de la migración 11; nunca se renderiza food.
export function storedHealthOrder(order){return [...healthOrder(order),'food']}
export function moveHealthSection(order,from,to){
  const next=healthOrder(order),a=next.indexOf(from),b=next.indexOf(to)
  if(a<0 || b<0)return next
  next.splice(b,0,next.splice(a,1)[0]);return next
}
export function healthFailure(error,message='No pudimos completar la solicitud. Intenta de nuevo en un momento.'){
  console.error('[Salud]',error)
  return message
}
