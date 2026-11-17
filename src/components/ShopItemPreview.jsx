import Avatar from './Avatar'
export const shopSection=item=>item.section || ({background:'backgrounds',fx:'backgrounds',frame:'frames',title:'titles'}[item.data?.slot] || 'avatar')
export default function ShopItemPreview({ item, avatar, equipped }) {
  const data=item.data || {}
  if(data.utility) return <span className="rounded-2xl border border-pu/30 px-4 py-3 text-center text-sm font-extrabold text-pu-light">{data.utility==='rename_card'?'@ Nuevo nombre':'Racha protegida'}</span>
  if(data.slot==='title') return <span className="text-center text-lg font-extrabold text-pu-light">{data.text}</span>
  if(data.slot==='badge') return <span className="text-4xl">{data.icon}</span>
  const preview=[...equipped.filter(e=>e.slot!==data.slot),data]
  return <Avatar avatar={avatar} equipped={preview} size={106} view={data.slot==='wrist'?'full':'bust'} />
}

