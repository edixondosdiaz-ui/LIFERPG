import { useCallback, useEffect, useState } from 'react'
import * as api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import Avatar from '../../components/Avatar'
import { haptic } from '../../lib/ui'

const CATS = [
  { id: 'ropa', label: 'Ropa' },
  { id: 'accesorio', label: 'Accesorios' },
  { id: 'premium', label: 'Premium' },
]
const RARITY = {
  common: { label: 'Común', color: '#8b91a5' },
  rare: { label: 'Raro', color: '#38bdf8' },
  epic: { label: 'Épico', color: '#a855f7' },
  legendary: { label: 'Legendario', color: '#e6b43c' },
}

function Preview({ item, avatar }) {
  const slot = item.data?.slot
  if (slot === 'badge') return <span className="text-5xl">{item.data.icon}</span>
  if (slot === 'wrist') return <span className="grid h-16 w-16 place-items-center rounded-full border-2 text-3xl" style={{ borderColor: item.data.color }}>⌚</span>
  return <Avatar avatar={avatar} equipped={[item.data]} view={slot === 'frame' || slot === 'fx' || slot === 'face' ? 'head' : 'bust'} size={96} />
}

export default function Tienda() {
  const { profile, refreshProfile } = useAuth()
  const [items, setItems] = useState(null)
  const [owned, setOwned] = useState({}) // item_id -> equipped
  const [cat, setCat] = useState('ropa')
  const [busyId, setBusyId] = useState(null)
  const [msg, setMsg] = useState({ type: '', text: '' })

  const load = useCallback(async () => {
    const [its, inv] = await Promise.all([api.listShopItems(), api.listInventory()])
    setItems(its)
    setOwned(Object.fromEntries(inv.map((i) => [i.item_id, i.equipped])))
  }, [])
  useEffect(() => { load().catch((e) => setMsg({ type: 'err', text: e.message })) }, [load])

  async function act(item, kind) {
    setBusyId(item.id); setMsg({ type: '', text: '' }); haptic(12)
    try {
      if (kind === 'buy') await api.buyItem(item.id)
      else await api.equipItem(item.id, kind === 'equip')
      await Promise.all([load(), refreshProfile()])
      if (kind === 'buy') setMsg({ type: 'ok', text: `Compraste ${item.name}` })
    } catch (e) { setMsg({ type: 'err', text: e.message }) }
    setBusyId(null)
  }

  const coins = profile?.coins ?? 0
  const list = (items ?? []).filter((i) => i.category === cat)

  return (
    <div className="space-y-5">
      <header className="surface flex items-center justify-between p-4">
        <div><h1 className="text-xl font-extrabold tracking-tight">Tienda</h1><p className="text-xs text-sub">Gana monedas con tus logros</p></div>
        <div className="rounded-2xl bg-gold/15 px-4 py-2 text-lg font-black text-gold">🪙 {coins.toLocaleString('es-CO')}</div>
      </header>

      <div className="flex gap-1.5 rounded-2xl border border-white/[.07] bg-card p-1.5">
        {CATS.map((c) => (
          <button key={c.id} onClick={() => { haptic(4); setCat(c.id) }}
            className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition active:scale-95 ${cat === c.id ? 'bg-gradient-to-b from-pu-light to-pu-dark text-white' : 'text-sub'}`}>{c.label}</button>
        ))}
      </div>

      {msg.text && <p key={msg.text} className={`animate-pop rounded-2xl border px-4 py-2.5 text-center text-sm font-semibold ${msg.type === 'ok' ? 'border-pu/30 bg-pu/10 text-pu-light' : 'border-red-400/30 bg-red-400/10 text-red-300'}`}>{msg.text}</p>}
      {!items && !msg.text && <p className="text-center text-sm text-sub">Cargando…</p>}

      <div className="grid grid-cols-2 gap-3">
        {list.map((it) => {
          const r = RARITY[it.rarity]
          const has = it.id in owned
          const on = owned[it.id]
          const busy = busyId === it.id
          return (
            <div key={it.id} className="surface flex flex-col overflow-hidden p-3" style={on ? { borderColor: '#a855f7aa' } : undefined}>
              <div className="grid h-28 place-items-center rounded-2xl bg-black/25"><Preview item={it} avatar={profile?.avatar} /></div>
              <p className="mt-2.5 truncate text-sm font-extrabold">{it.name}</p>
              <p className="text-[10px] font-bold" style={{ color: r.color }}>{r.label}</p>
              <p className="mt-1 line-clamp-2 min-h-[28px] text-[11px] text-sub">{it.description}</p>
              <div className="mt-2.5">
                {it.is_premium && !has ? <span className="block rounded-xl bg-white/5 py-2.5 text-center text-xs font-bold text-sub">Premium · Próximamente</span>
                  : has ? <button disabled={busy} onClick={() => act(it, on ? 'unequip' : 'equip')}
                      className={`w-full rounded-xl py-2.5 text-xs font-bold transition active:scale-95 ${on ? 'bg-pu/20 text-pu-light' : 'bg-white/10'}`}>{on ? 'Equipado · Quitar' : 'Equipar'}</button>
                  : <button disabled={busy || coins < it.price_coins} onClick={() => act(it, 'buy')} className="btn w-full !rounded-xl !py-2.5 text-xs">🪙 {it.price_coins}{coins < it.price_coins ? ' · faltan ' + (it.price_coins - coins) : ''}</button>}
              </div>
            </div>
          )
        })}
      </div>
      {items && !list.length && <p className="text-center text-sm text-sub">Pronto habrá más objetos aquí.</p>}
    </div>
  )
}
