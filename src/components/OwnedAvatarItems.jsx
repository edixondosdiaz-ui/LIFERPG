import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { cosmetics } from '../services/economy'
import { equipItem } from '../services/api'

export default function OwnedAvatarItems() {
  const { equipped, refreshProfile } = useAuth()
  const [items, setItems] = useState(null)
  const [busy, setBusy] = useState(false)
  const working = useRef(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active=true
    cosmetics().then(rows=>{if(active)setItems(rows)}).catch(e=>{if(active)setError(e.message)})
    return ()=>{active=false}
  }, [equipped])
  async function toggle(item) {
    if(working.current)return
    working.current=true;setBusy(true);setError('')
    try {await equipItem(item.id,!item.equipped);await refreshProfile();setItems(await cosmetics())}
    catch(e){setError(e.message)}finally{working.current=false;setBusy(false)}
  }
  return <section className="surface space-y-3 p-4"><h2 className="text-sm font-bold">Tus objetos comprados</h2>
    {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    {!items && !error && <p className="text-xs text-sub">Cargando inventario…</p>}
    {items?.length===0 && <p className="text-xs text-sub">Todavía no tienes cosméticos comprados.</p>}
    <div className="max-h-64 space-y-2 overflow-y-auto">{items?.map(item=><div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 p-3"><span className="text-xs font-bold">{item.name}</span><button type="button" disabled={busy} className="shrink-0 rounded-xl bg-pu/15 px-3 py-2 text-xs font-bold text-pu-light" onClick={()=>toggle(item)}>{item.equipped?'Equipado · Quitar':'Equipar'}</button></div>)}</div>
    <Link to="/tienda" className="block text-xs font-bold text-pu-light">Conseguir más objetos en la tienda →</Link>
  </section>
}
