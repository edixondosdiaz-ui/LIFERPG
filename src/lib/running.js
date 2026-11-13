export const METERS_PER_MILE = 1609.344
export function haversine(a,b) {
  const rad=n=>n*Math.PI/180
  const h=Math.sin(rad(b.lat-a.lat)/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lng-a.lng)/2)**2
  return 6371000*2*Math.asin(Math.sqrt(Math.min(1,h)))
}
export function filterPoint(previous,point,activity,rules) {
  if(![point.lat,point.lng,point.t,point.accuracy].every(Number.isFinite) || Math.abs(point.lat)>90 || Math.abs(point.lng)>180 || point.accuracy<0 || point.accuracy>Math.min(30,Number(rules.accuracy_m)))return {accepted:false,reason:'Señal GPS imprecisa'}
  if(!previous)return {accepted:true,meters:0,break:true}
  const seconds=(point.t-previous.t)/1000
  if(seconds<Number(rules.sample_seconds))return {accepted:false,reason:'interval'}
  if(seconds>Number(rules.gap_seconds))return {accepted:true,meters:0,break:true}
  const meters=haversine(previous,point)
  if(meters>Number(rules.jump_m) || meters/seconds>Number(activity==='walk'?rules.walk_max_mps:rules.run_max_mps))return {accepted:false,reason:'Salto o velocidad fuera del límite'}
  if(meters<Math.max(3,Math.min(point.accuracy,15)/2))return {accepted:false,reason:'interval'}
  return {accepted:true,meters,break:false}
}
export function routePaths(points) {
  if(!points.length)return []
  const origin=points[0],cos=Math.max(.001,Math.cos(origin.lat*Math.PI/180))
  const projected=points.map(p=>({x:(((p.lng-origin.lng+540)%360)-180)*cos,y:origin.lat-p.lat,segment:p.segment}))
  const xs=projected.map(p=>p.x),ys=projected.map(p=>p.y)
  const minX=Math.min(...xs),minY=Math.min(...ys),spanX=Math.max(...xs)-minX,spanY=Math.max(...ys)-minY
  const scale=260/Math.max(spanX,spanY,.00001),offsetX=20+(260-spanX*scale)/2,offsetY=20+(260-spanY*scale)/2
  const paths=[]
  for(const p of projected){const coordinate=`${(offsetX+(p.x-minX)*scale).toFixed(2)},${(offsetY+(p.y-minY)*scale).toFixed(2)}`;if(!paths.length || paths[paths.length-1].segment!==p.segment)paths.push({segment:p.segment,d:`M${coordinate}`});else paths[paths.length-1].d+=` L${coordinate}`}
  return paths.map(p=>p.d)
}
export const paceText=seconds=>!Number.isFinite(seconds)||seconds<=0?'–':`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`
