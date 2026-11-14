import { HydrationPanel } from '../components/PilotCards'
import { palette } from '../design/tokens'
import Running from './Running'
import HealthSections from '../components/HealthSections'
import { healthOrder, healthFailure } from '../lib/healthLayout'
import { loadHealthLayout, saveHealthLayout } from '../services/healthLayout'
import * as ex from '../services/experience'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import * as px from '../services/pillars'
import { BarChart } from '../components/charts'
import { Card, Chip, Empty, GoalEditor, PillarHeader, Segment, Stat, Tabs, Toast, confirmDelete, useToast, xpText } from '../components/ui'
import { addDays, avg, fmtDay, lastDays, sum, today as todayStr, weekdayLetter } from '../lib/dates'

const GREEN = palette.health, BLUE = palette.hydration, INDIGO = palette.sleep
const QUALITY = ['Muy mala', 'Mala', 'Regular', 'Buena', 'Excelente']
const QUALITY_EMOJI = ['😫', '😕', '😐', '🙂', '😄']

const dayMap = (rows, key, val) => {
  const m = new Map()
  for (const r of rows) m.set(r[key], (m.get(r[key]) || 0) + val(r))
  return m
}
const hoursBetween = (bed, wake) => {
  if (!bed || !wake) return null
  const [bh, bm] = bed.split(':').map(Number), [wh, wm] = wake.split(':').map(Number)
  let mins = wh * 60 + wm - (bh * 60 + bm)
  if (mins <= 0) mins += 1440
  return Math.round((mins / 60) * 100) / 100
}
const fmtH = (h) => `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')} min`
const L = (n) => `${(n / 1000).toLocaleString('es-CO', { maximumFractionDigits: 2 })} L`

/* ---------------------------------- AGUA ---------------------------------- */
function Water({ data, settings, reload, notify, saveSettings, enableNotifications }) {
  const t = todayStr()
  const { refreshProfile } = useAuth()
  const [custom, setCustom] = useState('')
  const [range, setRange] = useState('semana')
  const goal = settings.water_goal_ml
  const byDay = dayMap(data.water, 'logged_on', (r) => r.ml)
  const total = byDay.get(t) || 0
  const pct = Math.round((total / goal) * 100)
  const todayRows = data.water.filter((r) => r.logged_on === t)

  async function add(ml) {
    try {
      const r = await px.logWater(ml)
      await Promise.all([reload(), refreshProfile()])
      notify(r.total >= r.goal && total < goal ? `🎉 Meta de agua cumplida${xpText(r)}` : `+${ml} ml${xpText(r)}`, r.total >= r.goal && total < goal ? 'pr' : 'ok')
    } catch (e) { notify(healthFailure(e), 'err') }
  }
  async function remove(id) { try { await px.deleteWater(id); reload() } catch (e) { notify(healthFailure(e), 'err') } }

  const n = range === 'semana' ? 7 : 30
  const days = lastDays(n)
  const series = days.map((d) => ({ label: n === 7 ? weekdayLetter(d) : d.slice(8), value: byDay.get(d) || 0, active: d === t }))
  const logged = days.filter((d) => byDay.has(d))
  const metDays = days.filter((d) => (byDay.get(d) || 0) >= goal).length

  async function setReminder(min) {
    if (min && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const p = await Notification.requestPermission()
      if (p !== 'granted') return notify('Activa los permisos de notificación del navegador para recibir recordatorios', 'err')
    }
    if (min && typeof Notification === 'undefined') return notify('Este navegador no admite notificaciones', 'err')
    if (min && Notification.permission !== 'granted') return notify('Activa el permiso de notificaciones del navegador', 'err')
    if (min) await enableNotifications()
    await saveSettings({ water_reminder_min: min })
    notify(min ? `Recordatorio cada ${min} min mientras la app esté abierta` : 'Recordatorios desactivados')
  }

  return (
    <div className="space-y-4">
      <Card className="!bg-card">
        <HydrationPanel total={total} goal={goal} pct={pct} onAdd={add}>
        <form onSubmit={(e) => { e.preventDefault(); const v = Number(custom); if (v > 0) { add(v); setCustom('') } }} className="flex gap-2">
          <input className="field" type="number" inputMode="numeric" min="1" max="5000" placeholder="Otra cantidad (ml)" value={custom} onChange={(e) => setCustom(e.target.value)} />
          <button className="btn flex-none" disabled={!Number(custom)}>Agregar</button>
        </form>
        </HydrationPanel>
      </Card>

      <Card title="Historial" right={<Tabs value={range} onChange={setRange} color={GREEN} items={[{ id: 'hoy', label: 'Hoy' }, { id: 'semana', label: 'Semana' }, { id: 'mes', label: 'Mes' }]} />}>
        {range === 'hoy' ? (
          todayRows.length === 0 ? <Empty title="Aún no has bebido agua hoy" text="Usa los botones rápidos de arriba." /> : (
            <div className="space-y-1.5">
              {[...todayRows].reverse().map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-2xl border border-white/[.06] bg-card2/70 px-3.5 py-2.5 text-sm">
                  <span className="font-semibold">💧 {r.ml} ml</span>
                  <span className="flex items-center gap-3 text-[11px] text-sub">
                    {new Date(r.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })}
                    <button onClick={() => remove(r.id)} aria-label="Borrar registro" className="rounded-full px-2 hover:bg-error/15 hover:text-error">×</button>
                  </span>
                </div>
              ))}
            </div>
          )
        ) : (
          <>
            <BarChart colors={[BLUE]} goal={goal} data={series} labelEvery={n === 7 ? 1 : 5} format={L} empty="Registra agua para ver tu historial." />
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Promedio diario" value={logged.length ? L(avg(logged, (d) => byDay.get(d))) : '–'} />
              <Stat label="Metas cumplidas" value={`${metDays}/${n}`} color={BLUE} />
              <Stat label="Total" value={L(sum(days, (d) => byDay.get(d) || 0))} />
            </div>
          </>
        )}
      </Card>

      <Card title="Ajustes">
        <GoalEditor title="Objetivo diario de agua" settings={settings} onSave={(p) => saveSettings(p)} fields={[{ key: 'water_goal_ml', label: 'Meta diaria', unit: 'ml', min: 500, max: 10000, step: 50 }]} />
        <div>
          <p className="mb-1.5 text-[11px] font-bold text-sub">Recordatorio (funciona con la app abierta)</p>
          <div className="flex flex-wrap gap-1.5">
            {[null, 30, 60, 90, 120].map((m) => <Chip key={m ?? 'off'} active={settings.water_reminder_min === m} color={GREEN} onClick={() => setReminder(m)}>{m ? `${m} min` : 'Apagado'}</Chip>)}
          </div>
        </div>
      </Card>
    </div>
  )
}

/* ---------------------------------- SUEÑO --------------------------------- */
function Sleep({ data, settings, reload, notify, saveSettings }) {
  const t = todayStr()
  const { refreshProfile } = useAuth()
  const goal = Number(settings.sleep_goal_h)
  const [date, setDate] = useState(t)
  const [mode, setMode] = useState('horario')
  const [bed, setBed] = useState('23:00')
  const [wake, setWake] = useState('07:00')
  const [hours, setHours] = useState('')
  const [quality, setQuality] = useState(null)
  const [range, setRange] = useState('semana')

  const map = new Map(data.sleep.map((s) => [s.slept_on, s]))
  const preview = mode === 'horario' ? hoursBetween(bed, wake) : Number(hours) || null
  const days = lastDays(range === 'semana' ? 7 : 30)
  const logged = days.map((d) => map.get(d)).filter(Boolean)
  const last = [...data.sleep].sort((a, b) => b.slept_on.localeCompare(a.slept_on))[0]

  // Días seguidos cumpliendo el objetivo (si hoy aún no hay registro, cuenta desde ayer)
  let streak = 0
  for (let d = map.has(t) ? t : addDays(t, -1); map.get(d) && Number(map.get(d).hours) >= goal; d = addDays(d, -1)) streak++

  async function save(e) {
    e.preventDefault()
    try {
      const r = await px.logSleep(mode === 'horario'
        ? { date, bed, wake, quality }
        : { date, hours: Number(hours), quality })
      await Promise.all([reload(), refreshProfile()])
      notify(`Sueño guardado · ${fmtH(r.hours)}${xpText(r)}`, r.hours >= goal ? 'pr' : 'ok')
      setHours('')
    } catch (err) { notify(healthFailure(err), 'err') }
  }
  async function remove(id) { if (confirmDelete('¿Borrar este registro de sueño?')) { try { await px.deleteSleep(id); reload() } catch (e) { notify(healthFailure(e), 'err') } } }

  return (
    <div className="space-y-4">
      <Card title="Registrar sueño">
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="mb-1 block text-[10px] font-bold text-sub">Noche que termina el</span>
              <input className="field" type="date" max={t} value={date} onChange={(e) => setDate(e.target.value)} required /></label>
            <div><span className="mb-1 block text-[10px] font-bold text-sub">Cómo lo registras</span>
              <Segment color={INDIGO} value={mode} onChange={setMode} options={[{ id: 'horas', label: 'Horas' }, { id: 'horario', label: 'Horario' }]} /></div>
          </div>
          {mode === 'horario' ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="block"><span className="mb-1 block text-[10px] font-bold text-sub">Hora de dormir</span><input className="field" type="time" required value={bed} onChange={(e) => setBed(e.target.value)} /></label>
              <label className="block"><span className="mb-1 block text-[10px] font-bold text-sub">Hora de despertar</span><input className="field" type="time" required value={wake} onChange={(e) => setWake(e.target.value)} /></label>
            </div>
          ) : (
            <label className="block"><span className="mb-1 block text-[10px] font-bold text-sub">Horas dormidas</span>
              <input className="field" type="number" inputMode="decimal" min="0.5" max="24" step="0.25" required placeholder="Ej: 7.5" value={hours} onChange={(e) => setHours(e.target.value)} /></label>
          )}
          <div>
            <p className="mb-1.5 text-[10px] font-bold text-sub">Calidad del sueño</p>
            <div className="flex gap-1.5">
              {QUALITY_EMOJI.map((em, i) => (
                <button key={i} type="button" onClick={() => setQuality(quality === i + 1 ? null : i + 1)} aria-label={QUALITY[i]} aria-pressed={quality === i + 1}
                  className={`flex-1 rounded-2xl border py-2 text-xl transition active:scale-press ${quality === i + 1 ? 'border-sleep bg-sleep/20' : 'border-white/10 bg-white/5'}`}>{em}</button>
              ))}
            </div>
            {quality && <p className="mt-1 text-center text-[11px] text-sub">{QUALITY[quality - 1]}</p>}
          </div>
          <button className="btn w-full" disabled={!preview}>{preview ? `Guardar · ${fmtH(preview)}` : 'Guardar sueño'}</button>
        </form>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Última noche" value={last ? fmtH(Number(last.hours)) : '–'} sub={last ? (Number(last.hours) >= goal ? '✓ objetivo cumplido' : `meta ${goal} h`) : `meta ${goal} h`} color={INDIGO} />
        <Stat label="Racha con objetivo" value={`${streak} ${streak === 1 ? 'día' : 'días'}`} sub="durmiendo ≥ meta" />
        <Stat label="Promedio semanal" value={(() => { const w = lastDays(7).map((d) => map.get(d)).filter(Boolean); return w.length ? fmtH(avg(w, (s) => s.hours)) : '–' })()} />
        <Stat label="Promedio mensual" value={(() => { const w = lastDays(30).map((d) => map.get(d)).filter(Boolean); return w.length ? fmtH(avg(w, (s) => s.hours)) : '–' })()} />
      </div>

      <Card title="Evolución" right={<Tabs value={range} onChange={setRange} color={GREEN} items={[{ id: 'semana', label: 'Semana' }, { id: 'mes', label: 'Mes' }]} />}>
        <BarChart colors={[INDIGO]} goal={goal} format={fmtH} labelEvery={range === 'semana' ? 1 : 5}
          data={days.map((d) => ({ label: range === 'semana' ? weekdayLetter(d) : d.slice(8), value: Number(map.get(d)?.hours || 0), active: d === t }))} empty="Registra tu sueño para ver la gráfica." />
        {logged.some((s) => s.quality) && <p className="text-[11px] text-sub">Calidad promedio: <b className="text-ink">{QUALITY_EMOJI[Math.round(avg(logged.filter((s) => s.quality), (s) => s.quality)) - 1]} {avg(logged.filter((s) => s.quality), (s) => s.quality).toFixed(1)} / 5</b></p>}
      </Card>

      <Card title="Registros recientes">
        {data.sleep.length === 0 ? <p className="text-xs text-sub">Aún no hay registros.</p> : (
          <div className="space-y-1.5">
            {[...data.sleep].reverse().slice(0, 7).map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-2xl border border-white/[.06] bg-card2/70 px-3.5 py-2.5 text-sm">
                <div><p className="font-semibold">{fmtDay(s.slept_on)} · {fmtH(Number(s.hours))}</p>
                  <p className="text-[11px] text-sub">{s.bed_time ? `${s.bed_time.slice(0, 5)} → ${s.wake_time.slice(0, 5)}` : 'Horas manuales'}{s.quality ? ` · ${QUALITY_EMOJI[s.quality - 1]} ${QUALITY[s.quality - 1]}` : ''}</p></div>
                <button onClick={() => remove(s.id)} aria-label="Borrar registro" className="rounded-full px-2 text-sub hover:bg-error/15 hover:text-error">×</button>
              </div>
            ))}
          </div>
        )}
        <GoalEditor title="Objetivo de sueño" settings={settings} onSave={(p) => saveSettings(p)} fields={[{ key: 'sleep_goal_h', label: 'Horas por noche', unit: 'h', min: 3, max: 14, step: 0.5 }]} />
      </Card>
    </div>
  )
}

/* -------------------------------- PANTALLA -------------------------------- */
export default function Salud() {
  const {user}=useAuth()
  const [order,setOrder]=useState(healthOrder()),[layoutReady,setLayoutReady]=useState(false),[savingOrder,setSavingOrder]=useState(false),[layoutMessage,setLayoutMessage]=useState(''),[dataReady,setDataReady]=useState(false)
  const savingRef=useRef(false)
  const readLayout=useCallback(async()=>{try{const row=await loadHealthLayout();setOrder(healthOrder(row?.section_order));setLayoutReady(true);setLayoutMessage('')}catch(e){setLayoutMessage(healthFailure(e,'No pudimos recuperar el orden de tus tarjetas. Intenta de nuevo.'))}},[])
  useEffect(()=>{if(user?.id)readLayout()},[user?.id,readLayout])
  async function changeOrder(next){
    if(savingRef.current || !layoutReady)return
    const previous=order;savingRef.current=true;setSavingOrder(true);setOrder(next);setLayoutMessage('Guardando orden…')
    try{await saveHealthLayout(user.id,next);setLayoutMessage('Orden guardado')}catch(e){setOrder(previous);setLayoutReady(false);setLayoutMessage(healthFailure(e,'No pudimos confirmar el guardado. Mostramos el orden anterior; vuelve a consultarlo.'))}finally{savingRef.current=false;setSavingOrder(false)}
  }
  const [settings, setSettings] = useState(px.DEFAULT_SETTINGS)
  const [notifications, setNotifications] = useState(false)
  const [data, setData] = useState({ water: [], sleep: [] })
  const [ready, setReady] = useState(false)
  const [toast, notify] = useToast()
  const waterRef = useRef({ total: 0, goal: 2000 })

  const reload = useCallback(async () => {
    const since = addDays(todayStr(), -29)
    const [water, sleep] = await Promise.all([px.listWater(since), px.listSleep(since)])
    setData({ water, sleep });setDataReady(true)
  }, [])

  useEffect(() => {
    Promise.all([px.getSettings().then(setSettings), ex.getPreferences().then(p => setNotifications(p?.notifications ?? (typeof Notification !== 'undefined' && Notification.permission === 'granted'))), reload()]).catch((e) => notify(healthFailure(e), 'err')).finally(() => setReady(true))
  }, [reload, notify])

  const saveSettings = useCallback(async (patch) => {
    try { await px.saveSettings(patch); setSettings((s) => ({ ...s, ...patch })); notify('Guardado') } catch (e) { notify(healthFailure(e), 'err'); throw e }
  }, [notify])

  // Recordatorio de agua (solo mientras la app está abierta)
  waterRef.current = { total: sum(data.water.filter((r) => r.logged_on === todayStr()), (r) => r.ml), goal: settings.water_goal_ml }
  useEffect(() => {
    const min = settings.water_reminder_min
    if (!notifications || !min || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const id = setInterval(() => {
      if (waterRef.current.total < waterRef.current.goal) new Notification('💧 LifeRPG', { body: 'Es buen momento para tomar agua.' })
    }, min * 60000)
    return () => clearInterval(id)
  }, [settings.water_reminder_min, notifications])

  const enableNotifications = async () => {
    const p = await ex.getPreferences()
    await ex.savePreferences({units:p?.units ?? 'km',profile_visibility:p?.profile_visibility ?? 'friends',notifications:true})
    setNotifications(true)
  }
  const props = { data, settings, reload, notify, saveSettings, enableNotifications }
  return (
    <div className="space-y-5">
      <PillarHeader pillar="vitalidad" title="Salud" kicker="Movimiento, hidratación y descanso" color={GREEN} icon="❤️" />
      <HealthSections order={order} onOrder={changeOrder} disabled={!layoutReady || savingOrder} status={<>{layoutMessage && <p role="status" className="text-[12px] text-sub">{layoutMessage}</p>}{!layoutReady && layoutMessage && <button className="pilot-secondary" onClick={readLayout}>Reintentar cargar orden</button>}</>}>{ {
        running:<Running embedded/>,
        water:dataReady?<Water {...props}/>:<p className="text-sm text-sub">{ready?'No pudimos cargar tus registros. Intenta de nuevo.':'Cargando hidratación…'}</p>,
        sleep:dataReady?<Sleep {...props}/>:<p className="text-sm text-sub">{ready?'No pudimos cargar tus registros. Intenta de nuevo.':'Cargando sueño…'}</p>
      } }</HealthSections>


      {ready && !dataReady && <button className="pilot-secondary" onClick={()=>reload().catch(e=>notify(healthFailure(e),'err'))}>Reintentar cargar registros</button>}
      <Toast msg={toast} />
    </div>
  )
}
