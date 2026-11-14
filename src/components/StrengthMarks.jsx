import { compactMarks } from '../lib/strengthRoutine'
import { kg } from '../lib/fitness'

export default function StrengthMarks({rows}){
  return <div className="space-y-2">{compactMarks(rows).map(g=><div key={g.id} className="flex min-w-0 flex-wrap items-center gap-2 text-sm"><b className="min-w-0 break-words">{g.name}</b>{g.sameWeight && g.sameReps?<span>{g.rows.length} {g.rows.length===1?'serie':'series'} de {g.rows[0].reps} reps · {kg(g.rows[0].weight_kg)}</span>:<>{g.sameWeight && <span>{kg(g.rows[0].weight_kg)}</span>}<div className="flex min-w-0 flex-wrap gap-1">{g.rows.map((r,i)=><span key={i} className="rounded-small border border-stroke bg-panel-inset px-2 py-1 text-[12px]">{g.sameWeight?r.reps:`${kg(r.weight_kg)} × ${r.reps}`}</span>)}<span className="self-center text-[12px] text-sub">reps</span></div></>}</div>)}</div>
}
