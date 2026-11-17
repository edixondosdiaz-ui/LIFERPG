import { useEffect, useState } from 'react'

export default function PasswordInput({className='field',wrapperClassName='',value,...props}){
  const [visible,setVisible]=useState(false)
  useEffect(()=>{if(!value)setVisible(false)},[value])
  return <div className={`relative min-w-0 ${wrapperClassName}`}>
    <input {...props} value={value} type={visible?'text':'password'} className={`${className} !pr-12`}/>
    <button type="button" disabled={props.disabled} aria-label={visible?'Ocultar contraseña':'Mostrar contraseña'} aria-pressed={visible} onClick={()=>setVisible(v=>!v)} className="absolute inset-y-0 right-0 flex min-h-[44px] w-[44px] items-center justify-center rounded-small text-sub transition duration-ui hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pu-light disabled:opacity-45">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{visible && <path d="m3 3 18 18"/>}</svg>
    </button>
  </div>
}
