import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import * as api from '../services/api'
import * as px from '../services/pillars'
import { BarChart, LineChart } from '../components/charts'
import { Card, Chip, Empty, PillarHeader, Stat, Tabs, Toast, useToast, xpText } from '../components/ui'
import { addDays, clock, fmtDay, fmtDuration, sum, today as todayStr, weekStart } from '../lib/dates'
import { compress, e1rm, fmtGroup, groupByDay, kg, maxWeight, volumeOf } from '../lib/fitness'

const RED = '#ff4d4f'
const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const REST = [30, 60, 90, 120, 180]
const START_KEY = 'liferpg_workout_start'

// 1 = lunes ... 7 = domingo, en hora de Colombia
const todayWeekday = () => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' })).getDay()
  return d === 0 ? 7 : d
}

/* ---------- Una serie agrupada, con RPE / descanso / notas ---------- */
function GroupLine({ g, onDelete }) {
  return (
    <div className="flex items-start justify-between gap-2 text-sm">
      <div className="min-w-0">
        <p className="font-semibold">{fmtGroup(g)}</p>
        {(g.rpe || g.rest_seconds || g.notes) && (
          <p className="truncate text-[11px] text-sub">
            {[g.rpe && `RPE ${g.rpe}`, g.rest_seconds && `descanso ${g.rest_seconds}s`, g.notes].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
      {onDelete && <button onClick={onDelete} aria-label="Borrar serie" className="flex-none rounded-full px-2 text-sub transition hover:bg-red-400/15 hover:text-red-300">×</button>}
    </div>
  )
}

/* ---------- Tarjeta de ejercicio ---------- */
function ExerciseCard({ exercise, onDelete, onChanged, notify }) {
  const { refreshProfile } = useAuth()
  const [history, setHistory] = useState(null)
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [sets, setSets] = useState('3')
  const [more, setMore] = useState(false)
  const [rest, setRest] = useState(null)
  const [rpe, setRpe] = useState(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState(null) // null | 'peso' | 'volumen' | 'historial'

  const load = useCallback(async () => setHistory(await px.listExerciseHistory(exercise.id)), [exercise.id])
  useEffect(() => { load().catch((e) => notify(e.message, 'err')) }, [load, notify])

  const t = todayStr()
  const d = useMemo(() => {
    const rows = history ?? []
    const byDay = groupByDay(rows)
    const days = [...byDay.keys()].sort() // antiguo → reciente
    const prevDay = [...days].reverse().find((x) => x < t)
    const todaySets = byDay.get(t) ?? []
    const lastSets = prevDay ? byDay.get(prevDay) : []
    const perDay = days.map((day) => ({ day, sets: byDay.get(day), volume: volumeOf(byDay.get(day)), max: maxWeight(byDay.get(day)) }))
    const n = perDay.length
    const delta = n >= 2 && perDay[n - 2].volume ? Math.round(((perDay[n - 1].volume - perDay[n - 2].volume) / perDay[n - 2].volume) * 100) : null
    const best = rows.reduce((b, s) => Math.max(b, e1rm(Number(s.weight_kg), s.reps)), 0)
    return { byDay, perDay, todaySets, lastSets, prevDay, delta, pr: maxWeight(rows), bestVolSet: Math.max(0, ...rows.map((s) => Number(s.weight_kg) * s.reps)), e1rm: best }
  }, [history, t])

  const lastGroups = compress(d.lastSets)
  const todayGroups = compress(d.todaySets)

  async function done(r, extra = '') {
    onChanged()
    await Promise.all([load(), refreshProfile()])
    if (r?.pr) notify(`🏆 Récord personal${extra}${xpText(r)}`, 'pr')
    else if (r?.overload) notify(`Sobrecarga progresiva${extra}${xpText(r)}`, 'pr')
    else notify(`Registrado${extra}${xpText(r)}`)
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const r = await px.logEntry({
        exerciseId: exercise.id, weightKg: Number(weight), reps: Number(reps), sets: Number(sets),
        rpe, restSeconds: rest, notes: notes.trim() || null,
      })
      setNotes('')
      await done(r)
    } catch (err) { notify(err.message, 'err') } finally { setBusy(false) }
  }

  async function repeatLast() {
    setBusy(true)
    try {
      let xp = 0
      for (const g of lastGroups) {
        const r = await px.logEntry({ exerciseId: exercise.id, weightKg: g.weight_kg, reps: g.reps, sets: g.count, rpe: g.rpe, restSeconds: g.rest_seconds })
        xp += r.xp_awarded || 0
      }
      await done({ xp_awarded: xp }, ' · sesión anterior duplicada')
    } catch (err) { notify(err.message, 'err') } finally { setBusy(false) }
  }

  function prefill() {
    const g = lastGroups[0]
    if (!g) return
    setWeight(String(g.weight_kg)); setReps(String(g.reps)); setSets(String(g.count))
    if (g.rpe) { setRpe(g.rpe); setMore(true) }
  }

  async function removeGroup(g) {
    try {
      await Promise.all(g.ids.map((id) => px.deleteSet(id)))
      onChanged(); await load()
    } catch (err) { notify(err.message, 'err') }
  }

  const todayVol = volumeOf(d.todaySets)
  const preview = Number(weight) && Number(reps) && Number(sets) ? Number(weight) * Number(reps) * Number(sets) : null

  return (
    <div className="surface space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-extrabold">{exercise.name}</h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {d.pr > 0 && <span className="rounded-full bg-yellow-400/15 px-2 py-0.5 text-[10px] font-extrabold text-yellow-300">🏆 Récord {kg(d.pr)}</span>}
            {d.delta !== null && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${d.delta >= 0 ? 'bg-emerald-400/15 text-emerald-300' : 'bg-red-400/15 text-red-300'}`}>
                {d.delta >= 0 ? '▲' : '▼'} {Math.abs(d.delta)}% volumen vs. sesión anterior
              </span>
            )}
          </div>
        </div>
        <button onClick={onDelete} className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-semibold text-sub transition hover:bg-red-400/15 hover:text-red-300 active:scale-95">Borrar</button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-white/[.06] bg-card2/70 p-3">
          <p className="mb-2 text-[10px] font-bold text-sub">Última vez{d.prevDay ? ` · ${fmtDay(d.prevDay)}` : ''}</p>
          {lastGroups.length ? <div className="space-y-1.5">{lastGroups.map((g, i) => <GroupLine key={i} g={g} />)}</div> : <p className="text-xs text-sub">Sin registros</p>}
        </div>
        <div className="rounded-2xl border border-pu/20 bg-card2/70 p-3">
          <p className="mb-2 text-[10px] font-bold text-pu-light">Hoy{todayVol ? ` · ${Math.round(todayVol).toLocaleString('es-CO')} kg` : ''}</p>
          {todayGroups.length ? <div className="space-y-1.5">{todayGroups.map((g, i) => <GroupLine key={i} g={g} onDelete={() => removeGroup(g)} />)}</div> : <p className="text-xs text-sub">Aún nada</p>}
        </div>
      </div>

      {lastGroups.length > 0 && (
        <div className="flex gap-2">
          <button type="button" onClick={prefill} className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-2 text-xs font-bold transition active:scale-95">Usar datos de la última</button>
          <button type="button" disabled={busy || todayGroups.length > 0} onClick={repeatLast}
            className="flex-1 rounded-2xl border border-pu/30 bg-pu/10 py-2 text-xs font-bold text-pu-light transition active:scale-95 disabled:opacity-40">Duplicar sesión anterior</button>
        </div>
      )}

      <form onSubmit={submit} className="space-y-2.5">
        <div className="grid grid-cols-[1fr_1fr_.8fr] gap-2">
          <label className="block"><span className="mb-1 block text-[10px] font-bold text-sub">Peso (kg)</span>
            <input className="field" type="number" inputMode="decimal" min="0" max="1000" step="0.5" required value={weight} onChange={(e) => setWeight(e.target.value)} /></label>
          <label className="block"><span className="mb-1 block text-[10px] font-bold text-sub">Repeticiones</span>
            <input className="field" type="number" inputMode="numeric" min="1" max="200" step="1" required value={reps} onChange={(e) => setReps(e.target.value)} /></label>
          <label className="block"><span className="mb-1 block text-[10px] font-bold text-sub">Series</span>
            <input className="field" type="number" inputMode="numeric" min="1" max="30" step="1" required value={sets} onChange={(e) => setSets(e.target.value)} /></label>
        </div>

        <button type="button" onClick={() => setMore((v) => !v)} className="text-[11px] font-bold text-sub transition hover:text-ink" aria-expanded={more}>
          {more ? '− Ocultar detalles opcionales' : '+ Descanso, esfuerzo (RPE) y notas'}
        </button>
        {more && (
          <div className="animate-pop space-y-3 rounded-2xl border border-white/[.06] bg-card2/70 p-3">
            <div>
              <p className="mb-1.5 text-[10px] font-bold text-sub">Descanso entre series</p>
              <div className="flex flex-wrap gap-1.5">
                {REST.map((s) => <Chip key={s} active={rest === s} color={RED} onClick={() => setRest(rest === s ? null : s)}>{s >= 60 ? `${s / 60} min` : `${s} s`}</Chip>)}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[10px] font-bold text-sub">Esfuerzo percibido (RPE 1–10)</p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <Chip key={n} active={rpe === n} color={RED} onClick={() => setRpe(rpe === n ? null : n)}>{n}</Chip>)}
              </div>
            </div>
            <input className="field" placeholder="Notas del entrenamiento" maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        )}

        <button disabled={busy} className="btn w-full">
          {busy ? 'Guardando…' : preview ? `Registrar · ${preview.toLocaleString('es-CO')} kg de volumen` : 'Registrar ejercicio'}
        </button>
      </form>

      <div className="space-y-3 border-t border-white/[.06] pt-3">
        <Tabs color={RED} value={view ?? ''} onChange={(v) => setView(view === v ? null : v)}
          items={[{ id: 'peso', label: 'Peso' }, { id: 'volumen', label: 'Volumen' }, { id: 'historial', label: 'Historial' }]} />
        {view === 'peso' && (
          <div className="space-y-2">
            <LineChart color={RED} format={kg} points={d.perDay.slice(-20).map((p) => ({ label: fmtDay(p.day), value: p.max }))} empty="Se necesitan 2 sesiones para ver la progresión." />
            {d.e1rm > 0 && <p className="text-[11px] text-sub">1RM estimado: <b className="text-ink">{kg(d.e1rm)}</b> · mejor serie: <b className="text-ink">{Math.round(d.bestVolSet)} kg de volumen</b></p>}
          </div>
        )}
        {view === 'volumen' && (
          <BarChart colors={[RED]} format={(v) => `${Math.round(v)} kg`} labelEvery={Math.ceil(d.perDay.slice(-14).length / 7)}
            data={d.perDay.slice(-14).map((p, i, a) => ({ label: p.day.slice(8), value: Math.round(p.volume), active: i === a.length - 1 }))} empty="Aún no hay volumen registrado." />
        )}
        {view === 'historial' && (
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {d.perDay.length === 0 && <p className="text-xs text-sub">Sin historial todavía.</p>}
            {[...d.perDay].reverse().map((p) => (
              <div key={p.day} className="rounded-2xl border border-white/[.06] bg-card2/70 p-3">
                <div className="mb-1.5 flex items-center justify-between text-[11px]">
                  <b>{fmtDay(p.day)}</b><span className="text-sub">{Math.round(p.volume).toLocaleString('es-CO')} kg · máx {kg(p.max)}</span>
                </div>
                <div className="space-y-1">{compress(p.sets).map((g, i) => <GroupLine key={i} g={g} />)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- Pantalla ---------- */
export default function Strength() {
  const { refreshProfile } = useAuth()
  const [weekday, setWeekday] = useState(todayWeekday())
  const [exercises, setExercises] = useState([])
  const [name, setName] = useState('')
  const [weekSets, setWeekSets] = useState([])
  const [sessions, setSessions] = useState([])
  const [start, setStart] = useState(() => Number(localStorage.getItem(START_KEY)) || null)
  const [, tick] = useState(0)
  const [toast, notify] = useToast()
  const today = todayWeekday()
  const t = todayStr()

  const load = useCallback(async () => setExercises(await api.listExercises(weekday)), [weekday])
  useEffect(() => { load().catch((e) => notify(e.message, 'err')) }, [load, notify])

  const loadStats = useCallback(async () => {
    const since = addDays(weekStart(), -7) // semana actual + anterior
    const [s, w] = await Promise.all([px.listSetsSince(since), px.listWorkoutSessions(since)])
    setWeekSets(s); setSessions(w)
  }, [])
  useEffect(() => { loadStats().catch(() => {}) }, [loadStats])

  useEffect(() => {
    if (!start) return
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [start])

  async function add(e) {
    e.preventDefault()
    if (!name.trim()) return
    try { await api.addExercise({ weekday, name }); setName(''); load() } catch (err) { notify(err.message, 'err') }
  }
  async function remove(id) {
    if (confirm('¿Borrar este ejercicio y todas sus series?')) { await api.deleteExercise(id); load(); loadStats() }
  }

  function startWorkout() { const n = Date.now(); localStorage.setItem(START_KEY, String(n)); setStart(n) }
  async function finishWorkout() {
    const sec = (Date.now() - start) / 1000
    localStorage.removeItem(START_KEY); setStart(null)
    if (sec < 60) return notify('Entrenamiento descartado: duró menos de 1 minuto', 'err')
    try { const r = await px.saveWorkoutSession(sec); await Promise.all([loadStats(), refreshProfile()]); notify(`Entrenamiento guardado · ${fmtDuration(sec)}${xpText(r)}`, 'pr') }
    catch (err) { notify(err.message, 'err') }
  }

  // Métricas automáticas de la semana
  const ws = weekStart()
  const thisWeek = weekSets.filter((s) => s.performed_at >= ws)
  const lastWeek = weekSets.filter((s) => s.performed_at < ws)
  const volWeek = sum(thisWeek, (s) => s.weight_kg * s.reps)
  const volLast = sum(lastWeek, (s) => s.weight_kg * s.reps)
  const daysWeek = new Set(thisWeek.map((s) => s.performed_at)).size
  const volToday = sum(weekSets.filter((s) => s.performed_at === t), (s) => s.weight_kg * s.reps)
  const timeToday = sum(sessions.filter((s) => s.performed_at === t), (s) => s.duration_seconds)
  const timeWeek = sum(sessions.filter((s) => s.performed_at >= ws), (s) => s.duration_seconds)
  const weekDelta = volLast ? Math.round(((volWeek - volLast) / volLast) * 100) : null
  const bars = [...Array(7)].map((_, i) => {
    const day = addDays(ws, i)
    return { label: DAYS[i][0], value: Math.round(sum(thisWeek.filter((s) => s.performed_at === day), (s) => s.weight_kg * s.reps)), active: day === t }
  })
  const elapsed = start ? (Date.now() - start) / 1000 : 0

  return (
    <div className="space-y-5">
      <PillarHeader pillar="fuerza" title="Fuerza" kicker="Entrenamiento" color={RED} icon="⚔️" />

      <Card title="Entrenamiento de hoy"
        right={start ? <span className="rounded-full bg-red-400/15 px-2.5 py-1 text-[10px] font-extrabold text-red-300">● En curso</span> : null}>
        {start ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-4xl font-black tabular-nums tracking-tight">{clock(elapsed)}</p>
            <button onClick={finishWorkout} className="btn !bg-none !bg-red-500 !shadow-none">Terminar</button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-sub">Inicia el cronómetro para medir el tiempo total de tu sesión.</p>
            <button onClick={startWorkout} className="btn flex-none">Iniciar</button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Volumen de hoy" value={`${Math.round(volToday).toLocaleString('es-CO')} kg`} color={RED} />
          <Stat label="Tiempo hoy" value={timeToday ? fmtDuration(timeToday) : '–'} sub={timeWeek ? `${fmtDuration(timeWeek)} esta semana` : undefined} />
          <Stat label="Frecuencia semanal" value={`${daysWeek} ${daysWeek === 1 ? 'día' : 'días'}`} sub="de entrenamiento" />
          <Stat label="Volumen semanal" value={`${Math.round(volWeek).toLocaleString('es-CO')} kg`}
            sub={weekDelta === null ? undefined : `${weekDelta >= 0 ? '▲' : '▼'} ${Math.abs(weekDelta)}% vs. semana pasada`} />
        </div>
        <BarChart colors={[RED]} data={bars} format={(v) => `${v} kg`} empty="El volumen de cada día aparecerá aquí." />
      </Card>

      <div className="flex gap-1.5 rounded-2xl border border-white/[.07] bg-card p-1.5">
        {DAYS.map((d, i) => {
          const on = weekday === i + 1
          return (
            <button key={d} onClick={() => setWeekday(i + 1)}
              className={`relative flex-1 rounded-xl py-2.5 text-[11px] font-bold transition active:scale-95 ${on ? 'bg-gradient-to-b from-pu-light to-pu-dark text-white shadow-[0_6px_18px_-6px_#a855f7]' : 'text-sub hover:text-ink'}`}>
              {d}
              {today === i + 1 && <i className={`absolute left-1/2 top-1 h-1 w-1 -translate-x-1/2 rounded-full ${on ? 'bg-white' : 'bg-pu'}`} />}
            </button>
          )
        })}
      </div>

      <form onSubmit={add} className="flex gap-2">
        <input className="field" placeholder="Nuevo ejercicio (ej: Press de banca)" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        <button disabled={!name.trim()} className="btn flex-none">Agregar</button>
      </form>

      {exercises.length === 0 && <Empty title="Día libre por ahora" text="Agrega tu primer ejercicio para este día y empieza a registrar series." />}
      {exercises.map((ex) => <ExerciseCard key={ex.id} exercise={ex} onDelete={() => remove(ex.id)} onChanged={loadStats} notify={notify} />)}
      <Toast msg={toast} />
    </div>
  )
}
