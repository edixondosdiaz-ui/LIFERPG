// Verificación de integración OPCIONAL y no ejecutada por el agente.
// Usar clave anon/publishable y JWT de un usuario distinto del perfil privado.
// No escribe datos ni usa claves service_role.
import assert from 'node:assert/strict'
const {SUPABASE_URL,SUPABASE_ANON_KEY,PRIVACY_VIEWER_JWT,PRIVACY_PRIVATE_OWNER_JWT,PRIVATE_USERNAME,PUBLIC_USERNAME}=process.env
assert.ok(SUPABASE_URL && SUPABASE_ANON_KEY && PRIVACY_VIEWER_JWT && PRIVACY_PRIVATE_OWNER_JWT && PRIVATE_USERNAME && PUBLIC_USERNAME,'Faltan variables de configuración; consulta docs/perfiles-publicos-ranking.md')
const origin=new URL(SUPABASE_URL).origin
async function request(path,body,authenticated=true){
  const response=await fetch(`${origin}${path}`,{method:body?'POST':'GET',headers:{apikey:SUPABASE_ANON_KEY,...(authenticated?{Authorization:`Bearer ${authenticated===true?PRIVACY_VIEWER_JWT:authenticated}`} : {}),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined})
  const data=await response.json()
  assert.ok(response.ok,`La consulta de verificación falló (${response.status}); revisar sesión y migración`)
  return data
}
const me=await request('/auth/v1/user')
assert.ok(me.id,'El JWT de verificación no identifica un usuario')
const direct=await request(`/rest/v1/profiles?select=*&id=neq.${encodeURIComponent(me.id)}`)
assert.equal(direct.length,0,'La tabla base permite leer perfiles ajenos')
const owner=await request('/auth/v1/user',null,PRIVACY_PRIVATE_OWNER_JWT)
assert.notEqual(owner.id,me.id,'Usa dos cuentas distintas')
const ownerProfile=await request(`/rest/v1/profiles?select=username,is_public&id=eq.${encodeURIComponent(owner.id)}`,null,PRIVACY_PRIVATE_OWNER_JWT)
assert.equal(ownerProfile[0]?.username,PRIVATE_USERNAME)
assert.equal(ownerProfile[0]?.is_public,false)
const otherPublicProfiles=await request(`/rest/v1/profiles?select=*&id=neq.${encodeURIComponent(owner.id)}`,null,PRIVACY_PRIVATE_OWNER_JWT)
assert.equal(otherPublicProfiles.length,0,'La tabla base expone campos internos de perfiles públicos ajenos')
for(const authenticated of [true,false]){
  const visible=await request(`/rest/v1/public_profile_cards?select=*&username=eq.${encodeURIComponent(PUBLIC_USERNAME)}`,null,authenticated)
  assert.equal(visible.length,1,'El perfil de prueba público no aparece en la proyección')
  assert.deepEqual(Object.keys(visible[0]).sort(),['avatar','level','username','xp'])
  const hidden=await request(`/rest/v1/public_profile_cards?select=*&username=eq.${encodeURIComponent(PRIVATE_USERNAME)}`,null,authenticated)
  assert.equal(hidden.length,0,'El perfil privado aparece en la proyección pública')
  const privateSummary=await request('/rest/v1/rpc/public_profile_summary',{p_username:PRIVATE_USERNAME},authenticated)
  assert.equal(privateSummary.private,true,'Usa un perfil privado distinto del usuario del JWT')
  assert.deepEqual(Object.keys(privateSummary).sort(),['avatar','private','username'],'El resumen privado incluye campos adicionales')
}
for(const name of ['ranking_user_summary','visible_profile','get_friend_profile']){
  const data=await request(`/rest/v1/rpc/${name}`,{p_username:PRIVATE_USERNAME})
  assert.equal(data.private,true)
  assert.deepEqual(Object.keys(data).sort(),['avatar','private','username'],`La función ${name} filtra incorrectamente un perfil privado`)
}
const legacy=await request(`/rest/v1/leaderboard?select=username,xp&username=eq.${encodeURIComponent(PRIVATE_USERNAME)}`)
assert.equal(legacy.length,1)
assert.equal(legacy[0].xp,null,'La vista antigua expone XP privado')
const search=await request('/rest/v1/rpc/search_users',{p_query:PRIVATE_USERNAME})
const target=search.find(p=>p.username===PRIVATE_USERNAME)
assert.ok(target,'El usuario privado no aparece en la búsqueda de identidad')
assert.equal(target.xp,null)
assert.equal(target.display_name,null)
console.log('Verificación de privacidad completada: proyección pública, tabla base y accesos antiguos. No se imprimieron datos de perfiles.')
