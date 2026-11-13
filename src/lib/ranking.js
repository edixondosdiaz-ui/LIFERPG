export const rankNumber=n=>n==null || !Number.isFinite(Number(n))?'—':Number(n).toLocaleString('es-CO')
export const rankScore=(row,scope)=>row.private?null:scope==='league'?row.week_xp:row.xp
