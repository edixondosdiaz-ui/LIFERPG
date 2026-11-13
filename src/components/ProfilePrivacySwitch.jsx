import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'

export default function ProfilePrivacySwitch(){
  const {profile,refreshProfile}=useAuth()
  const [isPublic,setIsPublic]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
  const working=useRef(false)
  useEffect(()=>{setIsPublic(typeof profile?.is_public==='boolean'?profile.is_public:null)},[profile?.is_public])
  async function toggle(){
    if(working.current || isPublic===null)return
    const previous=isPublic,next=!previous
    working.current=true;setBusy(true);setIsPublic(next);setMessage('Guardando privacidad…')
    try{
      const {data,error}=await supabase.rpc('set_profile_public',{p_is_public:next})
      if(error)throw error
      setIsPublic(data);setMessage(data?'Tu perfil ahora es público.':'Tu perfil ahora es privado.')
      await refreshProfile().catch(e=>console.error('[Privacidad] Actualizar perfil',e))
    }catch(e){console.error('[Privacidad]',e);setIsPublic(previous);setMessage('No pudimos confirmar el cambio. Vuelve a consultar tu perfil antes de reintentar.');await refreshProfile().catch(()=>{})}
    finally{working.current=false;setBusy(false)}
  }
  return <div className="space-y-2"><div className="flex items-center justify-between gap-3"><div><p id="privacy-title" className="text-sm font-bold">Perfil privado</p><p id="privacy-description" className="mt-1 text-[12px] text-sub">Activado: otras personas solo ven tu avatar y usuario.</p></div><button type="button" role="switch" aria-labelledby="privacy-title" aria-describedby="privacy-description" aria-checked={isPublic===false} disabled={busy || isPublic===null} onClick={toggle} className={`flex min-h-[44px] min-w-[64px] shrink-0 items-center rounded-full border p-1 transition duration-ui disabled:opacity-60 ${isPublic===false?'justify-end border-pu-light bg-pu-dark':'justify-start border-stroke bg-panel-inset'}`}><span className="h-7 w-7 rounded-full bg-ink"/></button></div><p role="status" className="text-[12px] text-sub">{message || (isPublic===null?'No pudimos consultar tu privacidad. Vuelve a cargar tu perfil.':isPublic?'Público: tu nivel, XP, racha y logros son visibles.':'Privado: tus estadísticas y logros están ocultos, incluso para amigos.')}</p></div>
}
