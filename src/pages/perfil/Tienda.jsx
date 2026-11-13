import { palette } from '../../design/tokens'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import * as api from '../../services/api'
import * as economy from '../../services/economy'
import { useAuth } from '../../context/AuthContext'
import Avatar from '../../components/Avatar'

const CATEGORIES = [ ['avatar','Avatar'], ['backgrounds','Fondos de avatar'], ['frames','Marcos de perfil'], ['titles','Títulos'], ['utilities','Utilidades'] ]
const RARITY = { common:['Común',palette.text.secondary], rare:['Raro',palette.education], epic:['Épico',palette.brand.light], legendary:['Legendario',palette.finance] }
const sectionOf = item => item.section || ({background:'backgrounds',fx:'backgrounds',frame:'frames',title:'titles'}[item.data?.slot] || 'avatar')

function Preview({ item, avatar, equipped }) {
  const data=item.data || {}
  if(data.utility) return <span className="rounded-2xl border border-pu/30 px-4 py-3 text-center text-sm font-extrabold text-pu-light">{data.utility==='rename_card'?'@ Nuevo nombre':'Racha protegida'}</span>
  if(data.slot==='title') return <span className="text-center text-lg font-extrabold text-pu-light">{data.text}</span>
  if(data.slot==='badge') return <span className="text-4xl">{data.icon}</span>
  const preview=[...equipped.filter(e=>e.slot!==data.slot),data]
  return <Avatar avatar={avatar} equipped={preview} size={106} view={data.slot==='wrist'?'full':'bust'} />
}

export default function Tienda() {
  const { profile, equipped, refreshProfile }=useAuth()
  const [params,setParams]=useSearchParams()
  const category=CATEGORIES.some(([id])=>id===params.get('categoria'))?params.get('categoria'):'avatar'
  const [items,setItems]=useState(null)
  const [owned,setOwned]=useState({})
  const [wallet,setWallet]=useState(null)
  const [movements,setMovements]=useState([])
  const [rewards,setRewards]=useState(null)
  const [busy,setBusy]=useState(false)
  const working=useRef(false)
  const [pending,setPending]=useState(null)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const load=useCallback(async()=>{
    const [catalog,inventory,w,r]=await Promise.all([api.listShopItems(),api.listInventory(),economy.wallet(),economy.rules()])
    const history=await economy.ledger()
    setItems(catalog);setOwned(Object.fromEntries(inventory.map(i=>[i.item_id,i.equipped])));setWallet(w);setMovements(history);setRewards(r)
  },[])
  useEffect(()=>{load().catch(e=>setError(e.message))},[load])
  const priceOf=item=>Math.max(0,Math.floor(item.price_coins*(100-(wallet?.premium?wallet.discount:0))/100))
  async function act(work,success) {
    if(working.current)return
    working.current=true;setBusy(true);setError('');setMessage('')
    try {await work();setPending(null);setMessage(success);await refreshProfile();await load()}
    catch(e){setError(e.message)}finally{working.current=false;setBusy(false)}
  }
  function ask(item) {setError('');setPending({item,price:priceOf(item),requestId:crypto.randomUUID()})}
  return <div className="space-y-5">
    <header className="surface flex items-center justify-between gap-3 p-4"><div><h1 className="text-xl font-extrabold">Tienda</h1><p className="mt-1 text-xs text-sub">Cosméticos y utilidades. Tu XP no está en venta.</p></div><p className="shrink-0 text-lg font-black text-gold">{(wallet?.coins ?? profile?.coins ?? 0).toLocaleString('es-CO')}<span className="block text-right text-[10px] font-normal text-sub">monedas</span></p></header>
    {wallet?.premium && <p className="text-xs text-pu-light">Descuento Premium activo: {wallet.discount}%</p>}
    <label className="block text-xs font-bold text-sub">Categoría<select className="field mt-2" value={category} onChange={e=>setParams({categoria:e.target.value})}>{CATEGORIES.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
    {error && <p role="alert" className="rounded-2xl border border-error/30 p-3 text-sm text-error">{error}</p>}
    {message && <p role="status" className="text-sm text-pu-light">{message}</p>}
    {!items && !error && <p className="text-sm text-sub">Cargando tienda…</p>}
    {pending && <section role="alertdialog" aria-modal="true" aria-label="Confirmar compra" className="surface space-y-3 border-pu/40 p-4">
      <h2 className="font-extrabold">Confirmar compra</h2><p className="text-sm">{pending.item.name} por <b className="text-gold">{pending.price} monedas</b>.</p><p className="text-xs text-sub">Saldo después de comprar: {(wallet?.coins ?? 0)-pending.price} monedas.</p>
      <div className="grid grid-cols-2 gap-2"><button disabled={busy} className="rounded-2xl bg-white/10 py-3 text-sm" onClick={()=>setPending(null)}>Cancelar</button><button disabled={busy} className="btn" onClick={()=>act(()=>economy.purchase(pending.item.id,pending.requestId,pending.price),`Compraste ${pending.item.name}`)}>{busy?'Procesando…':'Confirmar compra'}</button></div>
      <p className="text-xs text-sub">Si la conexión falla, reintenta esta misma compra: el servidor reconoce la solicitud y evita cobrar dos veces.</p>
    </section>}
    <div className="grid grid-cols-2 gap-3">{(items || []).filter(item=>sectionOf(item)===category).map(item=>{
      const [rarity,color]=RARITY[item.rarity] || RARITY.common
      const utility=item.data?.utility, has=item.id in owned, on=owned[item.id], quantity=wallet?.utilities?.[utility] ?? 0
      const price=priceOf(item), premiumOnly=item.is_premium && !wallet?.premium
      const capped=utility==='streak_guard' && quantity>=2
      return <article key={item.id} className="surface flex flex-col overflow-hidden p-3" style={on?{borderColor:palette.brand.DEFAULT + 'aa'}:undefined}>
        <div className="grid h-28 place-items-center rounded-2xl bg-black/25"><Preview item={item} avatar={profile?.avatar} equipped={equipped}/></div>
        <h2 className="mt-3 text-sm font-extrabold">{item.name}</h2><p className="mt-1 text-[10px] font-bold" style={{color}}>{rarity}</p><p className="mt-2 flex-1 text-xs text-sub">{item.description}</p>
        <p className="mt-3 text-sm font-bold text-gold">{wallet?.premium && price<item.price_coins && <s className="mr-1 text-xs font-normal text-sub">{item.price_coins}</s>}{price} monedas</p>
        {utility && <p className="mt-1 text-xs text-sub">En inventario: {quantity}{utility==='streak_guard'?' / 2':''}</p>}
        <div className="mt-3">{has && !utility ? <button disabled={busy} className="w-full rounded-xl bg-pu/15 py-3 text-xs font-bold text-pu-light" onClick={()=>act(()=>api.equipItem(item.id,!on),on?'Objeto retirado':'Objeto equipado')}>{on?'Equipado · Quitar':'Equipar'}</button>
          : <button disabled={busy || !wallet || premiumOnly || capped || wallet.coins<price} onClick={()=>ask(item)} className="btn w-full !rounded-xl !px-2 !py-3 text-xs">{premiumOnly?'Solo premium':capped?'Máximo 2':wallet && wallet.coins<price?'Sin saldo':'Comprar'}</button>}
          {premiumOnly && <Link to="/premium" className="mt-2 block text-center text-[10px] text-pu-light">Activar prueba gratuita →</Link>}
        </div>
      </article>
    })}</div>
    {items && !items.some(i=>sectionOf(i)===category) && <p className="text-sm text-sub">Disponible pronto</p>}
    {category==='utilities' && wallet && <section className="surface space-y-3 p-4"><h2 className="font-bold">Usar tus utilidades</h2><Link to="/perfil" className="block text-sm text-pu-light">Cambiar usuario · {wallet.name_changes} cambios disponibles →</Link><p className="text-xs text-sub">El protector cubre ayer si faltó actividad y tenías una racha anteayer. No otorga XP ni completa hábitos.</p><button disabled={busy || !wallet.utilities.streak_guard} className="btn w-full" onClick={()=>{if(confirm('¿Consumir un protector para cubrir el día de ayer?'))act(economy.useStreakGuard,'Día de ayer protegido')}}>Usar protector de racha</button></section>}
    {rewards && <section className="surface space-y-2 p-4"><h2 className="font-bold">Cómo ganas monedas</h2><p className="text-xs text-sub">Nivel alcanzado: +{rewards.level_coins}. Racha de al menos siete días: +{rewards.weekly_streak_coins}, máximo una vez cada siete días. Actividad en los cuatro pilares del día: +{rewards.complete_day_coins}. Ascenso de liga: +{rewards.league_promotion_coins}. Los logros conservan sus recompensas.</p></section>}
    <section className="surface space-y-3 p-4"><h2 className="font-bold">Movimientos de monedas</h2><p className="text-xs text-sub">Últimos 40 movimientos. El saldo previo se reconoce como apertura.</p>{!movements.length && <p className="text-xs text-sub">Sin movimientos para mostrar.</p>}<div className="max-h-80 space-y-3 overflow-y-auto">{movements.map(m=><div key={m.id} className="flex items-start justify-between gap-3 text-xs"><div><p>{m.reason}</p><p className="mt-1 text-sub">{new Date(m.created_at).toLocaleString('es-CO',{timeZone:'America/Bogota',dateStyle:'short',timeStyle:'short'})}</p></div><div className="shrink-0 text-right"><b className={m.amount>=0?'text-success':'text-gold'}>{m.amount>0?'+':''}{m.amount}</b><p className="mt-1 text-sub">Saldo {m.balance}</p></div></div>)}</div></section>
  </div>
}
