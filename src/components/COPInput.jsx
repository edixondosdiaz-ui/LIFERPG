import { useState } from 'react'
import { formatCOPInput, parseCOPInput } from '../lib/copInput'

export default function COPInput({ value, onChange, label, required=false }) {
  const [focused,setFocused]=useState(false)
  return <label className="block min-w-0"><span className="mb-1 block text-[12px] font-semibold text-sub">{label}</span><input className="field" type="text" inputMode="numeric" required={required} pattern="[0-9.]+(,[0-9]+)?" placeholder="0" value={focused?String(value).replace('.',','):formatCOPInput(value)} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} onChange={e=>{const next=parseCOPInput(e.target.value);if(next!==null){e.target.setCustomValidity(next && Number(next)<1?'Ingresa al menos 1 peso.':'');onChange(next)}}}/></label>
}
