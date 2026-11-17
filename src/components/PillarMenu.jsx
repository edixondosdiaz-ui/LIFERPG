import { NavLink } from 'react-router-dom'
import { PILLAR_MENUS } from '../lib/pillarNavigation'
export function PillarIcon({name,className='h-5 w-5'}){
 const paths={run:'m8 10 4-3 4 5 4 1M12 8l-2 7-6 6m6-6 6 2 1 5',water:'M12 3S5 11 5 15a7 7 0 0014 0c0-4-7-12-7-12Z',sleep:'M20 15A9 9 0 019 4a9 9 0 1011 11Z',wallet:'M4 6h15v14H4zM4 6V4h13M15 11h5v5h-5z',list:'M8 6h12M8 12h12M8 18h12M3 6h1M3 12h1M3 18h1',chart:'M4 20V4M4 20h17M9 16v-5m5 5V7m5 9v-7',goal:'M12 3a9 9 0 100 18 9 9 0 000-18Zm0 5a4 4 0 100 8 4 4 0 000-8Z',study:'M3 4h7l2 2 2-2h7v16h-7l-2 1-2-1H3zM12 6v15'}
 return <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name] || paths.list}/></svg>
}
export default function PillarMenu({pillar}){
 return <nav aria-label={`Opciones de ${pillar}`} className="menu-scroll flex min-w-0 gap-1 overflow-x-auto scroll-smooth pb-1">{PILLAR_MENUS[pillar].map(item=><NavLink key={item.path} end to={item.path} className={({isActive})=>`flex min-h-[60px] min-w-0 shrink-0 flex-col items-center justify-center gap-1 rounded-small border px-3 py-2 text-center text-[11px] font-semibold ${isActive?'border-pu bg-pu/15 text-pu-light':'border-stroke-glass bg-panel text-sub hover:text-pu-light'}`}><PillarIcon name={item.icon}/><span>{item.label}</span></NavLink>)}</nav>
}
