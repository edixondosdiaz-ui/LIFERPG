import { useRef } from 'react'
import OwnRankBar from '../components/OwnRankBar'
import { RankingPodium, RankRow } from '../components/RankingCards'

// Casillas de diseño, sin nombres, XP ni perfiles de ejemplo.
export default function RankingPreview(){
  const anchor=useRef(null),me={position:null,username:null,xp:null,avatar:null}
  const slots=[1,2,3].map(position=>({id:`slot-${position}`,position,username:null,xp:null,week_xp:null,avatar:null}))
  return <div className="space-y-5"><h1 className="text-2xl font-extrabold">Ranking · diseño</h1><p className="text-[12px] leading-relaxed text-sub">Podio y fila propia sin participantes ni métricas. Los guiones representan datos que vendrán del servidor.</p><RankingPodium rows={slots} scope="global" preview/><h2 className="font-bold">Tu fila resaltada</h2><RankRow row={me} scope="global" mine preview rowRef={anchor}/><OwnRankBar row={me} anchorRef={anchor} scope="global" preview/><p className="text-[12px] text-sub">En el ranking real, tu fila aparece fija sobre la navegación cuando queda fuera de pantalla, incluso si no estás entre los primeros 100.</p><section className="surface space-y-3 p-4"><h2 className="font-bold">Perfil privado</h2><p className="text-sm text-sub">Este perfil es privado.</p><p className="text-[12px] text-sub">La hoja real muestra únicamente avatar, usuario y este mensaje.</p></section><div aria-hidden="true" className="h-[400px]"/></div>
}
