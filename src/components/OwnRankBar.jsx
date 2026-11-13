import { useEffect, useState } from 'react'
import { RankRow } from './RankingCards'

export default function OwnRankBar({row,anchorRef,scope,onOpen,preview=false}){
  const [visible,setVisible]=useState(true)
  useEffect(()=>{
    if(!row){setVisible(true);return}
    const node=anchorRef.current
    if(!node){setVisible(false);return}
    const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting && entry.intersectionRatio>=.99),{threshold:[0,.99,1],rootMargin:'0px 0px -170px 0px'})
    observer.observe(node);return()=>observer.disconnect()
  },[row,anchorRef])
  if(!row || visible)return null
  return <aside aria-label="Tu posición fuera de pantalla" className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom,0px))] left-1/2 z-20 w-[calc(100%-24px)] max-w-md -translate-x-1/2"><RankRow row={row} scope={scope} mine highlight onOpen={onOpen} preview={preview}/></aside>
}
