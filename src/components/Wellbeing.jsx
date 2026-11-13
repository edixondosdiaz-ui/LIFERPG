import { palette } from '../design/tokens'
import { useEffect, useState } from 'react'
import * as ex from '../services/experience'
import { addDays, today, lastDays, weekdayLetter } from '../lib/dates'
import { Card } from './ui'
import { LineChart } from './charts'
import { useAuth } from '../context/AuthContext'

const FIELDS = [['energy','Energía',palette.health],['stress','Estrés',palette.warning],['fatigue','Fatiga',palette.brand.light]]
export default function Wellbeing({ notify }) {
  const { refreshProfile } = useAuth()
  const [values, setValues] = useState({energy:5,stress:5,fatigue:5})
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    ex.wellbeing(addDays(today(),-6)).then(r=>{setRows(r); const t=r.find(x=>x.logged_on===today()); if(t)setValues({energy:t.energy,stress:t.stress,fatigue:t.fatigue})}).catch(e=>notify(e.message,'err'))
  }, [notify])
  async function save(e) {
    e.preventDefault();setBusy(true)
    try { await ex.saveWellbeing({...values,logged_on:today()});setRows(await ex.wellbeing(addDays(today(),-6)));await refreshProfile();notify('Bienestar guardado') } catch(e) {notify(e.message,'err')} finally {setBusy(false)}
  }
  return <Card title="Cómo te sientes hoy"><form onSubmit={save} className="space-y-4">{FIELDS.map(([key,label,color])=><label key={key} className="block text-sm"><span className="flex justify-between"><b>{label}</b><b style={{color}}>{values[key]} / 10</b></span><input aria-label={label} className="mt-3 w-full accent-pu-light" type="range" min={1} max={10} value={values[key]} onChange={e=>setValues({...values,[key]:Number(e.target.value)})}/></label>)}<button disabled={busy || !rows} className="btn w-full">Guardar bienestar de hoy</button></form>
    <p className="text-xs text-sub">Tendencia semanal · solo días registrados</p>{FIELDS.map(([key,label,color])=><div key={key}><h3 className="mb-2 text-xs font-bold">{label}</h3><LineChart color={color} points={lastDays(7).flatMap(d=>{const r=rows?.find(x=>x.logged_on===d);return r?[{label:weekdayLetter(d),value:r[key]}]:[]})} format={v=>`${v}/10`} empty="Registra al menos dos días para ver la tendencia."/></div>)}
  </Card>
}
