import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import * as api from '../services/api'
import * as px from '../services/pillars'
import { BarChart, Heatmap, HBars, Meter, Ring } from '../components/charts'
import { Card, Chip, Empty, GoalEditor, PillarHeader, Segment, Stat, Tabs, Toast, confirmDelete, useToast, xpText } from '../components/ui'
import { addDays, clock, daysBetween, fmtDay, fmtHours, lastDays, streakOf, sum, today as todayStr, weekStart, weekdayLetter } from '../lib/dates'
import { haptic } from '../lib/ui'
import { levelProgress } from '../lib/xp'

const SKY = '#38bdf8'
const DEFAULT_CATS = ['Matemáticas', 'Programación', 'Idiomas', 'Lectura', 'Ciencias', 'General']
const PRIORITY = { alta: { label: 'Alta', color: '#f87171', w: 0 }, media: { label: 'Media', color: '#fbbf24', w: 1 }, baja: { label: 'Baja', color: '#34d399', w: 2 } }
const TIMER_KEY = 'liferpg_study_timer'

const loadTimer = () => { try { return JSON.parse(localStorage.getItem(TIMER_KEY)) } catch { return null } }
const elapsedOf = (tm) => (tm ? tm.acc + (tm.status === 'running' ? Date.now() - tm.startedAt : 0) : 0)

/* ------------------------- Cronómetro / Pomodoro -------------------------- */
function Focus({ cats, onSaved, notify }) {
  const [tm, setTm] = useState(loadTimer)
  const [cfg, setCfg] = useState(() => loadTimer()?.cfg ?? { mode: 'pomodoro', focus: 25, brk: 5, topic: '', category: 'General' })
  const [, tick] = useState(0)
  const busy = useRef(false)

  useEffect(() => {
    if (tm) localStorage.setItem(TIMER_KEY, JSON.stringify(tm)); else localStorage.removeItem(TIMER_KEY)
  }, [tm])

  const save = useCallback(async (c, minutes) => {
    const r = await px.logStudy({ topic: c.topic.trim(), category: c.category.trim() || 'General', mode: c.mode, minutes })
    await onSaved()
    return r
  }, [onSaved])

  // Reloj: refresca la pantalla y cierra la fase del Pomodoro cuando se agota el tiempo
  useEffect(() => {
    if (tm?.status !== 'running') return
    const id = setInterval(async () => {
      tick((n) => n + 1)
      if (!tm.target || elapsedOf(tm) < tm.target || busy.current) return
      busy.current = true
      haptic(300)
      try {
        if (tm.phase === 'focus') {
          const r = await save(tm.cfg, tm.cfg.focus)
          const long = (tm.cycle + 1) % 4 === 0
          const brk = long ? 15 : tm.cfg.brk
          notify(`🍅 Pomodoro completado · ${tm.cfg.focus} min${xpText(r)}`, 'pr')
          setTm({ ...tm, phase: 'break', status: 'running', startedAt: Date.now(), acc: 0, cycle: tm.cycle + 1, target: brk * 60000 })
        } else {
          notify('Descanso terminado. ¿Otra ronda?')
          setTm(null)
        }
      } catch (e) { notify(e.message, 'err'); setTm({ ...tm, status: 'paused', acc: tm.target, startedAt: null }) } finally { busy.current = false }
    }, 500)
    return () => clearInterval(id)
  }, [tm, save, notify])

  const start = () => setTm({
    status: 'running', phase: 'focus', startedAt: Date.now(), acc: 0, cycle: tm?.cycle ?? 0, cfg,
    target: cfg.mode === 'pomodoro' ? cfg.focus * 60000 : null,
  })
  const pause = () => setTm({ ...tm, status: 'paused', acc: elapsedOf(tm), startedAt: null })
  const resume = () => setTm({ ...tm, status: 'running', startedAt: Date.now() })
  const discard = () => { if (confirmDelete('¿Descartar esta sesión sin guardar?')) setTm(null) }
  const skipBreak = () => setTm(null)

  async function stopAndSave() {
    const minutes = Math.round(elapsedOf(tm) / 60000)
    if (minutes < 1) { setTm(null); return notify('Sesión descartada: dura menos de 1 minuto', 'err') }
    try {
      const r = await save(tm.cfg, minutes)
      notify(`Sesión guardada · ${fmtHours(minutes)}${xpText(r)}`, 'pr')
      setTm(null)
    } catch (e) { notify(e.message, 'err') }
  }

  const active = !!tm
  const isBreak = tm?.phase === 'break'
  const el = elapsedOf(tm)
  const remaining = tm?.target ? Math.max(0, tm.target - el) : 0
  const shown = tm?.target ? remaining / 1000 : el / 1000
  const pct = !tm ? 0 : tm.target ? (el / tm.target) * 100 : ((el % 3600000) / 3600000) * 100
  const color = isBreak ? '#34d399' : SKY

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col items-center gap-4">
          <Ring pct={pct} color={color} size={190} stroke={12}>
            <div>
              <p className="text-5xl font-black tabular-nums tracking-tight">{clock(active ? shown : (cfg.mode === 'pomodoro' ? cfg.focus * 60 : 0))}</p>
              <p className="mt-1 text-[11px] font-bold text-sub">
                {!active ? (cfg.mode === 'pomodoro' ? 'Listo para enfocarte' : 'Cronómetro libre') : isBreak ? 'Descanso' : tm.status === 'paused' ? 'En pausa' : 'Enfocado'}
              </p>
            </div>
          </Ring>

          {active && <p className="text-center text-xs text-sub">{tm.cfg.topic} · {tm.cfg.category}{tm.cfg.mode === 'pomodoro' ? ` · ronda ${isBreak ? tm.cycle : tm.cycle + 1}` : ''}</p>}

          {active ? (
            <div className="grid w-full grid-cols-2 gap-2">
              {tm.status === 'running'
                ? <button onClick={pause} className="rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-bold transition active:scale-95">⏸ Pausar</button>
                : <button onClick={resume} className="btn">▶ Reanudar</button>}
              {isBreak
                ? <button onClick={skipBreak} className="btn">Saltar descanso</button>
                : <button onClick={stopAndSave} className="btn">✓ Terminar y guardar</button>}
              <button onClick={discard} className="col-span-2 py-1 text-[11px] font-bold text-sub transition hover:text-red-300">Descartar sesión</button>
            </div>
          ) : (
            <button onClick={start} disabled={!cfg.topic.trim()} className="btn w-full">Iniciar {cfg.mode === 'pomodoro' ? 'Pomodoro' : 'sesión libre'}</button>
          )}
        </div>
      </Card>

      {!active && (
        <Card title="Configurar sesión">
          <Tabs color={SKY} value={cfg.mode} onChange={(mode) => setCfg({ ...cfg, mode })} items={[{ id: 'pomodoro', label: '🍅 Pomodoro' }, { id: 'libre', label: '⏱ Libre' }]} />
          <input className="field" placeholder="¿Qué vas a estudiar? (tema)" maxLength={80} value={cfg.topic} onChange={(e) => setCfg({ ...cfg, topic: e.target.value })} />
          <div>
            <p className="mb-1.5 text-[10px] font-bold text-sub">Categoría</p>
            <div className="mb-2 flex flex-wrap gap-1.5">{cats.map((c) => <Chip key={c} active={cfg.category === c} color={SKY} onClick={() => setCfg({ ...cfg, category: c })}>{c}</Chip>)}</div>
            <input className="field" placeholder="O escribe otra categoría" maxLength={40} value={cats.includes(cfg.category) ? '' : cfg.category} onChange={(e) => setCfg({ ...cfg, category: e.target.value })} />
          </div>
          {cfg.mode === 'pomodoro' && (
            <div className="grid grid-cols-2 gap-3">
              <div><p className="mb-1.5 text-[10px] font-bold text-sub">Enfoque</p><Segment color={SKY} value={cfg.focus} onChange={(focus) => setCfg({ ...cfg, focus })} options={[15, 25, 45, 50].map((n) => ({ id: n, label: `${n} min` }))} /></div>
              <div><p className="mb-1.5 text-[10px] font-bold text-sub">Descanso</p><Segment color={SKY} value={cfg.brk} onChange={(brk) => setCfg({ ...cfg, brk })} options={[5, 10, 15].map((n) => ({ id: n, label: `${n} min` }))} /></div>
            </div>
          )}
          <p className="text-[11px] text-sub">Ganas 1 XP cada 2 minutos de estudio, más bonos por tu primera sesión del día y por cumplir tu objetivo semanal.</p>
        </Card>
      )}
    </div>
  )
}

/* --------------------------------- Tareas --------------------------------- */
function Tasks({ tasks, reload, notify }) {
  const { refreshProfile } = useAuth()
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('media')
  const [due, setDue] = useState('')
  const [showDone, setShowDone] = useState(false)
  const t = todayStr()

  async function add(e) {
    e.preventDefault()
    try { await px.addTask({ title, priority, dueOn: due }); setTitle(''); setDue(''); await reload() } catch (err) { notify(err.message, 'err') }
  }
  async function toggle(task) {
    try {
      const r = await px.setTaskDone(task.id, !task.done)
      await Promise.all([reload(), refreshProfile()])
      if (!task.done) notify(`Tarea completada${xpText(r)}`, 'pr')
    } catch (err) { notify(err.message, 'err') }
  }
  async function remove(id) { try { await px.deleteTask(id); reload() } catch (err) { notify(err.message, 'err') } }

  const pending = tasks.filter((x) => !x.done).sort((a, b) => (a.due_on || '9999').localeCompare(b.due_on || '9999') || PRIORITY[a.priority].w - PRIORITY[b.priority].w)
  const done = tasks.filter((x) => x.done)
  const pctDone = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0

  const Row = ({ task }) => {
    const late = !task.done && task.due_on && task.due_on < t
    const diff = task.due_on ? daysBetween(t, task.due_on) : null
    return (
      <div className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${task.done ? 'border-white/[.05] bg-card2/40 opacity-60' : late ? 'border-red-400/30 bg-red-400/5' : 'border-white/[.06] bg-card2/70'}`}>
        <button onClick={() => toggle(task)} aria-label={task.done ? 'Reabrir tarea' : 'Completar tarea'}
          className={`grid h-6 w-6 flex-none place-items-center rounded-full border-2 text-xs transition active:scale-90 ${task.done ? 'border-sky-400 bg-sky-400 text-app' : 'border-white/25'}`}>{task.done ? '✓' : ''}</button>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-semibold ${task.done ? 'line-through' : ''}`}>{task.title}</p>
          <p className="text-[11px] text-sub">
            <span style={{ color: PRIORITY[task.priority].color }}>● {PRIORITY[task.priority].label}</span>
            {task.due_on && <span className={late ? 'text-red-300' : ''}> · {fmtDay(task.due_on)}{!task.done && (diff === 0 ? ' (hoy)' : diff === 1 ? ' (mañana)' : late ? ` (hace ${-diff} d)` : '')}</span>}
          </p>
        </div>
        <button onClick={() => remove(task.id)} aria-label="Borrar tarea" className="flex-none rounded-full px-2 text-sub hover:bg-red-400/15 hover:text-red-300">×</button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card title="Nueva tarea">
        <form onSubmit={add} className="space-y-2.5">
          <input className="field" placeholder="Ej: Entregar taller de cálculo" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <div><p className="mb-1.5 text-[10px] font-bold text-sub">Prioridad</p>
              <div className="flex gap-1.5">{Object.entries(PRIORITY).map(([k, v]) => <Chip key={k} active={priority === k} color={v.color} onClick={() => setPriority(k)}>{v.label}</Chip>)}</div></div>
            <label className="block"><span className="mb-1.5 block text-[10px] font-bold text-sub">Fecha límite</span><input className="field !py-2" type="date" min={t} value={due} onChange={(e) => setDue(e.target.value)} /></label>
          </div>
          <button className="btn w-full" disabled={!title.trim()}>Agregar tarea</button>
        </form>
      </Card>

      <Card title={`Pendientes (${pending.length})`} right={tasks.length ? <span className="text-[11px] font-bold text-sky-300">{pctDone}% completado</span> : null}>
        {pending.length === 0 ? <Empty title={tasks.length ? '¡Todo al día!' : 'Sin tareas todavía'} text={tasks.length ? 'Completaste todas tus tareas.' : 'Agrega tus entregas y exámenes para no perderlos de vista.'} /> : <div className="space-y-2">{pending.map((x) => <Row key={x.id} task={x} />)}</div>}
      </Card>

      {done.length > 0 && (
        <Card title={`Completadas (${done.length})`} right={<button onClick={() => setShowDone((v) => !v)} className="text-[11px] font-bold text-sub">{showDone ? 'Ocultar' : 'Mostrar'}</button>}>
          {showDone && <div className="space-y-2">{done.slice(0, 20).map((x) => <Row key={x.id} task={x} />)}</div>}
        </Card>
      )}
    </div>
  )
}

/* -------------------------------- Progreso -------------------------------- */
function Progress({ sessions, tasks, settings, saveSettings, reload, notify }) {
  const { profile } = useAuth()
  const [range, setRange] = useState('dia')
  const [ach, setAch] = useState([])
  const t = todayStr(), ws = weekStart()
  useEffect(() => { api.getAchievements().then((a) => setAch(a.filter((x) => x.id.startsWith('study_') || x.id.startsWith('tasks_')))).catch(() => {}) }, [sessions.length, tasks])

  const byDay = new Map()
  for (const s of sessions) byDay.set(s.studied_on, (byDay.get(s.studied_on) || 0) + s.minutes)
  const minToday = byDay.get(t) || 0
  const minWeek = sum(sessions.filter((s) => s.studied_on >= ws), (s) => s.minutes)
  const goal = settings.study_goal_min_week
  const goalPct = Math.round((minWeek / goal) * 100)
  const streak = streakOf(new Set(byDay.keys()))
  const totalMin = sum(sessions, (s) => s.minutes)
  const xp = profile?.pillar_xp?.intelecto ?? 0
  const lp = levelProgress(xp)

  const bars = range === 'dia'
    ? lastDays(7).map((d) => ({ label: weekdayLetter(d), value: +((byDay.get(d) || 0) / 60).toFixed(2), active: d === t }))
    : Array.from({ length: 8 }, (_, i) => {
        const start = addDays(ws, (i - 7) * 7), end = addDays(start, 6)
        return { label: fmtDay(start).replace(/ .*/, ''), value: +(sum(sessions.filter((s) => s.studied_on >= start && s.studied_on <= end), (s) => s.minutes) / 60).toFixed(2), active: i === 7 }
      })

  const subjects = Object.entries(sessions.reduce((a, s) => ({ ...a, [s.category]: (a[s.category] || 0) + s.minutes }), {})).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }))

  const start = addDays(ws, -63)
  const cal = Array.from({ length: 70 }, (_, i) => {
    const date = addDays(start, i), m = byDay.get(date) || 0
    return { date, hidden: date > t, today: date === t, label: m ? fmtHours(m) : 'sin estudio', level: m === 0 ? 0 : m < 30 ? 1 : m < 60 ? 2 : m < 120 ? 3 : 4 }
  })

  async function remove(id) { if (confirmDelete('¿Borrar esta sesión?')) { try { await px.deleteStudy(id); reload() } catch (e) { notify(e.message, 'err') } } }
  const tasksDone = tasks.filter((x) => x.done).length

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-5">
          <Ring pct={goalPct} color={SKY} size={124}>
            <div><p className="text-2xl font-black leading-none">{Math.min(goalPct, 999)}%</p><p className="mt-1 text-[10px] text-sub">objetivo semanal</p></div>
          </Ring>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-extrabold">{fmtHours(minWeek)} <span className="font-medium text-sub">de {fmtHours(goal)}</span></p>
            <p className="text-[11px] text-sub">{minWeek >= goal ? '🎯 ¡Objetivo semanal cumplido!' : `Te faltan ${fmtHours(goal - minWeek)} esta semana.`}</p>
            <Meter label="Nivel educativo" value={lp.current} goal={lp.needed} unit="XP" color="#a78bfa" format={(v) => Math.round(v)} />
            <p className="text-[11px] text-sub">Nivel <b className="text-ink">{lp.level}</b> · {xp.toLocaleString('es-CO')} XP</p>
          </div>
        </div>
        <GoalEditor title="Objetivo semanal de estudio" settings={settings} onSave={(p) => saveSettings(p)} fields={[{ key: 'study_goal_min_week', label: 'Minutos por semana', unit: 'min', min: 30, max: 6000, step: 30 }]} />
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Hoy" value={fmtHours(minToday)} color={SKY} />
        <Stat label="Racha de estudio" value={`${streak} ${streak === 1 ? 'día' : 'días'}`} />
        <Stat label="Total (90 días)" value={fmtHours(totalMin)} />
        <Stat label="Tareas hechas" value={`${tasksDone}/${tasks.length}`} sub={tasks.length ? `${Math.round((tasksDone / tasks.length) * 100)}% cumplido` : undefined} />
      </div>

      <Card title="Horas estudiadas" right={<Tabs value={range} onChange={setRange} color={SKY} items={[{ id: 'dia', label: 'Por día' }, { id: 'sem', label: 'Por semana' }]} />}>
        <BarChart colors={[SKY]} data={bars} format={(v) => `${v} h`} empty="Guarda una sesión para ver tus horas." />
      </Card>

      <Card title="Calendario de actividad"><Heatmap days={cal} color={SKY} />
        <p className="text-[11px] text-sub">Últimas 10 semanas · más color = más minutos de estudio.</p></Card>

      <Card title="Materias más trabajadas"><HBars items={subjects} color={SKY} format={fmtHours} empty="Aún no hay materias registradas." /></Card>

      {ach.length > 0 && (
        <Card title="Logros de estudio">
          <div className="space-y-2">
            {ach.map((a) => (
              <div key={a.id} className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${a.unlocked ? 'border-sky-400/30 bg-sky-400/10' : 'border-white/[.06] bg-card2/70 opacity-80'}`}>
                <span className="text-2xl">{a.icon}</span>
                <div className="min-w-0 flex-1"><p className="text-sm font-bold">{a.name}</p><p className="text-[11px] text-sub">{a.description}</p>
                  {!a.unlocked && <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-sky-400" style={{ width: `${(a.progress / a.target) * 100}%` }} /></div>}</div>
                <span className="text-[11px] font-bold text-sub">{a.unlocked ? '✓' : `${a.progress}/${a.target}`}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Sesiones recientes">
        {sessions.length === 0 ? <p className="text-xs text-sub">Aún no hay sesiones.</p> : (
          <div className="space-y-1.5">
            {sessions.slice(0, 8).map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 rounded-2xl border border-white/[.06] bg-card2/70 px-3.5 py-2.5">
                <div className="min-w-0"><p className="truncate text-sm font-semibold">{s.mode === 'pomodoro' ? '🍅' : '⏱'} {s.topic}</p><p className="text-[11px] text-sub">{s.category} · {fmtDay(s.studied_on)} · {fmtHours(s.minutes)}</p></div>
                <button onClick={() => remove(s.id)} aria-label="Borrar sesión" className="flex-none rounded-full px-2 text-sub hover:bg-red-400/15 hover:text-red-300">×</button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

/* -------------------------------- Pantalla -------------------------------- */
export default function Educacion() {
  const { refreshProfile } = useAuth()
  const [tab, setTab] = useState('enfocar')
  const [sessions, setSessions] = useState([])
  const [tasks, setTasks] = useState([])
  const [settings, setSettings] = useState(px.DEFAULT_SETTINGS)
  const [ready, setReady] = useState(false)
  const [toast, notify] = useToast()

  const reload = useCallback(async () => {
    const [s, k] = await Promise.all([px.listStudy(addDays(todayStr(), -89)), px.listTasks()])
    setSessions(s); setTasks(k)
  }, [])
  const afterSave = useCallback(async () => { await Promise.all([reload(), refreshProfile()]) }, [reload, refreshProfile])

  useEffect(() => {
    Promise.all([px.getSettings().then(setSettings), reload()]).catch((e) => notify(e.message, 'err')).finally(() => setReady(true))
  }, [reload, notify])

  const saveSettings = useCallback(async (patch) => {
    try { await px.saveSettings(patch); setSettings((s) => ({ ...s, ...patch })); notify('Guardado') } catch (e) { notify(e.message, 'err'); throw e }
  }, [notify])

  const cats = [...new Set([...DEFAULT_CATS, ...sessions.map((s) => s.category)])].slice(0, 12)
  const pendingCount = tasks.filter((x) => !x.done).length

  return (
    <div className="space-y-5">
      <PillarHeader pillar="intelecto" title="Educación" kicker="Enfoque, tareas y aprendizaje" color={SKY} icon="🧠" />
      <Tabs color={SKY} value={tab} onChange={setTab} items={[{ id: 'enfocar', label: '⏱ Enfocar' }, { id: 'tareas', label: `✅ Tareas${pendingCount ? ` (${pendingCount})` : ''}` }, { id: 'progreso', label: '📈 Progreso' }]} />
      {!ready ? <p className="py-8 text-center text-sm text-sub">Cargando…</p>
        : tab === 'enfocar' ? <Focus cats={cats} onSaved={afterSave} notify={notify} />
        : tab === 'tareas' ? <Tasks tasks={tasks} reload={reload} notify={notify} />
        : <Progress sessions={sessions} tasks={tasks} settings={settings} saveSettings={saveSettings} reload={reload} notify={notify} />}
      <Toast msg={toast} />
    </div>
  )
}
