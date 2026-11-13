import COPInput from '../components/COPInput'
import { palette } from '../design/tokens'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import * as px from '../services/pillars'
import { BarChart, HBars, LineChart, Meter } from '../components/charts'
import { Card, Chip, Empty, PillarHeader, Segment, Stat, Tabs, Toast, confirmDelete, useToast, xpText } from '../components/ui'
import { addDays, compactMoney, daysBetween, fmtDay, lastDays, lastMonths, monthLabel, monthStart, money, nextRecurring, sum, today as todayStr, weekStart } from '../lib/dates'

const GOLD = palette.finance, INCOME = palette.success, EXPENSE = palette.error, SAVING = palette.fat
const EXPENSE_CATS = ['Alimentación', 'Transporte', 'Salud', 'Educación', 'Ocio', 'Suscripciones', 'Hogar', 'Otros']
const INCOME_CATS = ['Salario', 'Freelance', 'Negocio', 'Inversiones', 'Regalo', 'Otros']
const KINDS = { ingreso: { label: 'Ingreso', plural: 'Ingresos', color: INCOME, sign: '+' }, gasto: { label: 'Gasto', plural: 'Gastos', color: EXPENSE, sign: '−' }, ahorro: { label: 'Ahorro', plural: 'Ahorros', color: SAVING, sign: '→' } }
const CAT_ICON = { Alimentación: '🍽️', Transporte: '🚌', Salud: '💊', Educación: '📚', Ocio: '🎮', Suscripciones: '📺', Hogar: '🏠', Otros: '📦', Salario: '💼', Freelance: '💻', Negocio: '🏪', Inversiones: '📈', Regalo: '🎁', Ahorro: '🐷' }
const GOAL_ICONS = ['🎯', '💻', '🛟', '✈️', '📈', '🏠', '🚗', '🎓']
const EVERY = [{ id: 'nunca', label: 'No se repite' }, { id: 'semanal', label: 'Semanal' }, { id: 'quincenal', label: 'Quincenal' }, { id: 'mensual', label: 'Mensual' }]

const sumKind = (rows, kind) => sum(rows.filter((r) => r.kind === kind), (r) => r.amount)
const between = (rows, a, b) => rows.filter((r) => r.occurred_on >= a && r.occurred_on <= b)
const flow = (rows) => ({ in: sumKind(rows, 'ingreso'), out: sumKind(rows, 'gasto'), save: sumKind(rows, 'ahorro') })

/* -------------------------------- Resumen --------------------------------- */
function Summary({ tx, goals, goSection }) {
  const t = todayStr()
  const [period, setPeriod] = useState('mes')
  const [chart, setChart] = useState('dias')

  const all = flow(tx)
  const available = all.in - all.out - all.save
  const from = period === 'hoy' ? t : period === 'semana' ? weekStart() : monthStart()
  const cur = flow(between(tx, from, t))
  const balance = cur.in - cur.out
  const savePct = cur.in > 0 ? Math.round((cur.save / cur.in) * 100) : null

  const bars = chart === 'dias'
    ? lastDays(14).map((d) => { const f = flow(tx.filter((x) => x.occurred_on === d)); return { label: d.slice(8), values: [f.in, f.out], active: d === t } })
    : lastMonths(6).map((m) => { const f = flow(tx.filter((x) => x.occurred_on.startsWith(m))); return { label: monthLabel(m), values: [f.in, f.out], active: m === t.slice(0, 7) } })

  // Evolución del dinero disponible (últimos 30 días)
  const days = lastDays(30)
  let run = sum(tx.filter((x) => x.occurred_on < days[0]), (x) => (x.kind === 'ingreso' ? x.amount : -x.amount))
  const line = days.map((d) => {
    run += sum(tx.filter((x) => x.occurred_on === d), (x) => (x.kind === 'ingreso' ? x.amount : -x.amount))
    return { label: fmtDay(d), value: Math.round(run) }
  })

  const cats = Object.entries(between(tx, from, t).filter((x) => x.kind === 'gasto').reduce((a, x) => ({ ...a, [x.category]: (a[x.category] || 0) + x.amount }), {}))
    .sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label: `${CAT_ICON[label] ?? '📦'} ${label}`, value, color: GOLD }))

  const weeks = Array.from({ length: 8 }, (_, i) => {
    const s = addDays(weekStart(), (i - 7) * 7)
    return { label: fmtDay(s).replace(/ .*/, ''), value: Math.round(sumKind(between(tx, s, addDays(s, 6)), 'gasto')), active: i === 7 }
  })
  const wDelta = weeks[6].value ? Math.round(((weeks[7].value - weeks[6].value) / weeks[6].value) * 100) : null

  const active = goals.map((g) => ({ ...g, saved: sum(tx.filter((x) => x.goal_id === g.id), (x) => x.amount) })).filter((g) => g.saved < g.target_amount).slice(0, 3)

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-3xl border border-warning/30 bg-gradient-to-br from-warning/20 via-card to-card p-5">
        <p className="relative text-[11px] font-bold text-sub">Dinero disponible</p>
        <p className={`relative mt-1 text-xl font-black tracking-tight ${available < 0 ? 'text-error' : ''}`}>{money(available)}</p>
        <div className="relative mt-3 flex items-center justify-between rounded-2xl bg-white/5 px-3.5 py-2.5 text-xs">
          <span className="text-sub">🐷 Ahorro acumulado</span><b style={{ color: SAVING }}>{money(all.save)}</b>
        </div>
      </section>

      <Tabs color={GOLD} value={period} onChange={setPeriod} items={[{ id: 'hoy', label: 'Hoy' }, { id: 'semana', label: 'Semana' }, { id: 'mes', label: 'Mes' }]} />
      <div className="grid grid-cols-2 gap-2">
        <Stat label={`Balance ${period === 'hoy' ? 'diario' : period === 'semana' ? 'semanal' : 'mensual'}`} value={`${balance >= 0 ? '+' : '−'}${money(Math.abs(balance))}`} color={balance >= 0 ? INCOME : EXPENSE} sub="ingresos − gastos" />
        <Stat label="Porcentaje de ahorro" value={savePct === null ? '–' : `${savePct}%`} color={SAVING} sub={savePct === null ? 'sin ingresos en el periodo' : `${money(cur.save)} ahorrados`} />
        <Stat label="Ingresos" value={money(cur.in)} color={INCOME} />
        <Stat label="Gastos" value={money(cur.out)} color={EXPENSE} />
      </div>

      <Card title="Ingresos vs. gastos" right={<Tabs value={chart} onChange={setChart} color={GOLD} items={[{ id: 'dias', label: '14 días' }, { id: 'meses', label: '6 meses' }]} />}>
        <BarChart colors={[INCOME, EXPENSE]} data={bars} format={compactMoney} labelEvery={chart === 'dias' ? 2 : 1} empty="Registra movimientos para compararlos." />
        <p className="flex gap-4 text-[11px] text-sub"><span><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: INCOME }} />Ingresos</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: EXPENSE }} />Gastos</span></p>
      </Card>

      <Card title="Evolución del dinero disponible"><LineChart points={line} color={GOLD} format={money} empty="Registra movimientos para ver tu evolución." /></Card>

      <Card title={`Gastos por categoría · ${period === 'hoy' ? 'hoy' : period === 'semana' ? 'esta semana' : 'este mes'}`}>
        <HBars items={cats} format={money} empty="Sin gastos en este periodo." />
      </Card>

      <Card title="Tendencia de gasto semanal" right={wDelta !== null ? <span className={`text-[11px] font-extrabold ${wDelta <= 0 ? 'text-success' : 'text-error'}`}>{wDelta >= 0 ? '▲' : '▼'} {Math.abs(wDelta)}% vs. semana pasada</span> : null}>
        <BarChart colors={[GOLD]} data={weeks} format={money} empty="Aún no hay gastos registrados." />
      </Card>

      <Card title="Metas en progreso" right={<button onClick={goSection} className="text-[11px] font-bold text-sub">Ver todas</button>}>
        {active.length === 0 ? <p className="text-xs text-sub">Crea una meta para ver su avance aquí.</p> : (
          <div className="space-y-3">{active.map((g) => <Meter key={g.id} label={`${g.icon} ${g.name}`} value={g.saved} goal={g.target_amount} color={SAVING} format={compactMoney} />)}</div>
        )}
      </Card>
    </div>
  )
}

/* ------------------------------- Movimientos ------------------------------ */
function Movements({ tx, goals, recurring, reload, notify, historyOnly = false }) {
  const { refreshProfile } = useAuth()
  const t = todayStr()
  const [kind, setKind] = useState('gasto')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Alimentación')
  const [desc, setDesc] = useState('')
  const [goalId, setGoalId] = useState(null)
  const [date, setDate] = useState(t)
  const [every, setEvery] = useState('nunca')
  const [filter, setFilter] = useState('todos')
  const [limit, setLimit] = useState(30)
  const [busy, setBusy] = useState(false)

  function pickKind(k) {
    setKind(k); setEvery('nunca'); setGoalId(null)
    setCategory(k === 'gasto' ? 'Alimentación' : k === 'ingreso' ? 'Salario' : 'Ahorro')
  }

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const goal = goals.find((g) => g.id === goalId)
      const cat = kind === 'ahorro' ? (goal ? goal.name : 'Ahorro') : category
      const r = await px.logFin({ kind, amount: Number(amount), category: cat, description: desc, goalId: kind === 'ahorro' ? goalId : null, date })
      if (every !== 'nunca' && kind !== 'ahorro') {
        await px.addRecurring({ kind, amount: Number(amount), category: cat, description: desc, every, nextOn: nextRecurring(date, every) })
      }
      setAmount(''); setDesc(''); setEvery('nunca')
      await Promise.all([reload(), refreshProfile()])
      notify(`${KINDS[kind].label} registrado${xpText(r)}`, kind === 'ahorro' ? 'pr' : 'ok')
    } catch (err) { notify(err.message, 'err') } finally { setBusy(false) }
  }
  async function remove(id) { if (confirmDelete('¿Borrar este movimiento?')) { try { await px.deleteTransaction(id); reload() } catch (e) { notify(e.message, 'err') } } }
  async function removeRec(id) { if (confirmDelete('¿Dejar de repetir este movimiento? Los ya generados se conservan.')) { try { await px.deleteRecurring(id); reload() } catch (e) { notify(e.message, 'err') } } }

  const shown = tx.filter((x) => filter === 'todos' || x.kind === filter)
  const groups = []
  for (const x of shown.slice(0, limit)) {
    const g = groups[groups.length - 1]
    if (g && g.date === x.occurred_on) g.items.push(x); else groups.push({ date: x.occurred_on, items: [x] })
  }

  return (
    <div className="space-y-4">
      {!historyOnly && <div id="movimiento" className="scroll-mt-4"><Card title="Nuevo movimiento">
        <form id="finance-movement" onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-3 gap-1.5">
            {Object.entries(KINDS).map(([k, v]) => (
              <button key={k} type="button" onClick={() => pickKind(k)} aria-pressed={kind === k}
                className="rounded-2xl border py-2.5 text-xs font-extrabold transition active:scale-press"
                style={kind === k ? { background: v.color + '26', borderColor: v.color, color: v.color } : { background: palette.soft, borderColor: palette.grid, color: palette.text.secondary }}>{v.label}</button>
            ))}
          </div>
          <COPInput label="Monto en COP" required value={amount} onChange={setAmount}/>

          {kind === 'ahorro' ? (
            <div>
              <p className="mb-1.5 text-[10px] font-bold text-sub">¿A qué meta?</p>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={goalId === null} color={SAVING} onClick={() => setGoalId(null)}>🐷 Ahorro general</Chip>
                {goals.map((g) => <Chip key={g.id} active={goalId === g.id} color={SAVING} onClick={() => setGoalId(g.id)}>{g.icon} {g.name}</Chip>)}
              </div>
            </div>
          ) : (
            <div>
              <p className="mb-1.5 text-[10px] font-bold text-sub">Categoría</p>
              <div className="flex flex-wrap gap-1.5">{[...new Set([...tx.filter(x => x.kind === kind).map(x => x.category), ...(kind === 'gasto' ? EXPENSE_CATS : INCOME_CATS)])].slice(0,12).map((c) => <Chip key={c} active={category === c} color={KINDS[kind].color} onClick={() => setCategory(c)}>{CAT_ICON[c]} {c}</Chip>)}</div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2">
            <input className="field" maxLength={120} placeholder={kind === 'ingreso' ? 'Fuente (ej: Empresa XYZ)' : 'Descripción (opcional)'} value={desc} onChange={(e) => setDesc(e.target.value)} />
            <input className="field !px-3" type="date" max={t} required value={date} onChange={(e) => setDate(e.target.value)} aria-label="Fecha" />
          </div>

          {kind !== 'ahorro' && (
            <div>
              <p className="mb-1.5 text-[10px] font-bold text-sub">{kind === 'ingreso' ? 'Ingreso periódico' : 'Gasto periódico'}</p>
              <Segment color={GOLD} value={every} onChange={setEvery} options={EVERY} />
            </div>
          )}
          <button className="btn w-full" disabled={busy || !Number(amount)}>{busy ? 'Guardando…' : `Registrar ${KINDS[kind].label.toLowerCase()}${Number(amount) ? ` · ${money(Number(amount))}` : ''}`}</button>
        </form>
      </Card></div>}

      {!historyOnly && recurring.length > 0 && (
        <Card title="Movimientos periódicos">
          <div className="space-y-1.5">
            {recurring.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-2xl border border-white/[.06] bg-card2/70 px-3.5 py-2.5">
                <div className="min-w-0"><p className="truncate text-sm font-semibold">{CAT_ICON[r.category] ?? '📦'} {r.description || r.category}</p>
                  <p className="text-[11px] text-sub">{KINDS[r.kind].label} {r.every} · próximo {fmtDay(r.next_on)}</p></div>
                <span className="flex-none text-sm font-extrabold" style={{ color: KINDS[r.kind].color }}>{money(r.amount)}</span>
                <button onClick={() => removeRec(r.id)} aria-label="Quitar periódico" className="flex-none rounded-full px-2 text-sub hover:bg-error/15 hover:text-error">×</button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {historyOnly && <Card title="Historial">
        <div className="flex flex-wrap gap-1.5">
          {[['todos', 'Todos'], ['ingreso', 'Ingresos'], ['gasto', 'Gastos'], ['ahorro', 'Ahorros']].map(([k, l]) => <Chip key={k} active={filter === k} color={GOLD} onClick={() => { setFilter(k); setLimit(30) }}>{l}</Chip>)}
        </div>
        {groups.length === 0 ? <Empty title="Sin movimientos" text="Registra tu primer ingreso o gasto arriba." /> : (
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.date}>
                <p className="mb-1.5 text-[11px] font-bold text-sub">{g.date === t ? 'Hoy' : g.date === addDays(t, -1) ? 'Ayer' : fmtDay(g.date)}</p>
                <div className="space-y-1.5">
                  {g.items.map((x) => (
                    <div key={x.id} className="flex items-center gap-3 rounded-2xl border border-white/[.06] bg-card2/70 px-3 py-2.5">
                      <span className="grid h-9 w-9 flex-none place-items-center rounded-xl text-lg" style={{ background: KINDS[x.kind].color + '22' }}>{CAT_ICON[x.category] ?? (x.kind === 'ahorro' ? '🎯' : '📦')}</span>
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{x.description || x.category}</p>
                        <p className="truncate text-[11px] text-sub">{x.category}{x.from_recurring ? ' · automático' : ''}</p></div>
                      <span className="flex-none text-sm font-extrabold" style={{ color: KINDS[x.kind].color }}>{KINDS[x.kind].sign}{money(x.amount)}</span>
                      <button onClick={() => remove(x.id)} aria-label="Borrar movimiento" className="flex-none rounded-full px-1.5 text-sub hover:bg-error/15 hover:text-error">×</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {shown.length > limit && <button onClick={() => setLimit(limit + 30)} className="w-full rounded-2xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold">Ver más</button>}
          </div>
        )}
      </Card>}
    </div>
  )
}

/* ---------------------------------- Metas --------------------------------- */
function Goals({ tx, goals, reload, notify }) {
  const { refreshProfile } = useAuth()
  const t = todayStr()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('🎯')
  const [target, setTarget] = useState('')
  const [deadline, setDeadline] = useState('')
  const [deposit, setDeposit] = useState({})
  const totalSaved = sumKind(tx, 'ahorro')

  async function add(e) {
    e.preventDefault()
    try { await px.addGoal({ name, icon, target: Number(target), deadline }); setName(''); setTarget(''); setDeadline(''); await reload(); notify('Meta creada') } catch (err) { notify(err.message, 'err') }
  }
  async function contribute(g) {
    const v = Number(deposit[g.id])
    if (!v) return
    try {
      const r = await px.logFin({ kind: 'ahorro', amount: v, category: g.name, goalId: g.id })
      setDeposit({ ...deposit, [g.id]: '' })
      await Promise.all([reload(), refreshProfile()])
      notify(`Ahorro registrado${xpText(r)}`, 'pr')
    } catch (err) { notify(err.message, 'err') }
  }
  async function remove(g) { if (confirmDelete(`¿Borrar la meta "${g.name}"? Tus ahorros se conservan como ahorro general.`)) { try { await px.deleteGoal(g.id); reload() } catch (e) { notify(e.message, 'err') } } }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Total ahorrado" value={money(totalSaved)} color={SAVING} />
        <Stat label="Metas" value={`${goals.filter((g) => sum(tx.filter((x) => x.goal_id === g.id), (x) => x.amount) >= g.target_amount).length}/${goals.length}`} sub="cumplidas" />
      </div>

      <Card title="Nueva meta">
        <form onSubmit={add} className="space-y-2.5">
          <div className="flex flex-wrap gap-1.5">{GOAL_ICONS.map((i) => <button key={i} type="button" onClick={() => setIcon(i)} aria-pressed={icon === i} className={`h-10 w-10 rounded-xl border text-xl transition active:scale-press ${icon === i ? 'border-warning bg-warning/20' : 'border-white/10 bg-white/5'}`}>{i}</button>)}</div>
          <input className="field" placeholder="Ej: Laptop nueva, Fondo de emergencia, Viaje" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <COPInput label="Monto objetivo (COP)" required value={target} onChange={setTarget}/>
            <input className="field !px-3" type="date" min={t} value={deadline} onChange={(e) => setDeadline(e.target.value)} aria-label="Fecha límite (opcional)" />
          </div>
          <button className="btn w-full" disabled={!name.trim() || !Number(target)}>Crear meta</button>
        </form>
      </Card>

      {goals.length === 0 ? <Empty title="Aún no tienes metas" text="Define algo concreto por lo que ahorrar y ve cómo avanzas." /> : goals.map((g) => {
        const saved = sum(tx.filter((x) => x.goal_id === g.id), (x) => x.amount)
        const pct = Math.min(100, Math.round((saved / g.target_amount) * 100))
        const left = Math.max(0, g.target_amount - saved)
        const done = saved >= g.target_amount
        const daysLeft = g.deadline ? daysBetween(t, g.deadline) : null
        const perMonth = daysLeft && daysLeft > 0 && !done ? left / Math.max(1, daysLeft / 30) : null
        return (
          <section key={g.id} className="surface space-y-3 p-4" style={done ? { borderColor: palette.success + '66' } : undefined}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-warning/15 text-2xl">{g.icon}</span>
                <div className="min-w-0"><p className="truncate text-base font-extrabold">{g.name}</p>
                  <p className="text-[11px] text-sub">{done ? '🏁 ¡Meta cumplida!' : daysLeft === null ? 'Sin fecha límite' : daysLeft < 0 ? `Venció hace ${-daysLeft} días` : `${daysLeft} días restantes`}</p></div>
              </div>
              <button onClick={() => remove(g)} aria-label="Borrar meta" className="rounded-full px-2 text-sub hover:bg-error/15 hover:text-error">×</button>
            </div>
            <div>
              <div className="mb-1 flex items-baseline justify-between text-xs"><b>{money(saved)}</b><span className="text-sub">de {money(g.target_amount)} · {pct}%</span></div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-all duration-ui" style={{ width: `${pct}%`, background: done ? INCOME : `linear-gradient(90deg, ${SAVING}99, ${SAVING})` }} /></div>
              {!done && <p className="mt-1.5 text-[11px] text-sub">Faltan {money(left)}{perMonth ? ` · ahorra ~${money(perMonth)} al mes` : ''}</p>}
            </div>
            {!done && (
              <form onSubmit={(e) => { e.preventDefault(); contribute(g) }} className="flex gap-2">
                <COPInput label="Abonar (COP)" value={deposit[g.id] ?? ''} onChange={value=>setDeposit({...deposit,[g.id]:value})}/>
                <button className="btn flex-none !py-2.5" disabled={!Number(deposit[g.id])}>Abonar</button>
              </form>
            )}
          </section>
        )
      })}
    </div>
  )
}

/* -------------------------------- Pantalla -------------------------------- */
export default function Finanzas() {
  const { refreshProfile } = useAuth()
  const [tx, setTx] = useState([])
  const [goals, setGoals] = useState([])
  const [recurring, setRecurring] = useState([])
  const [ready, setReady] = useState(false)
  const [toast, notify] = useToast()
  useEffect(() => {
    if (ready && window.location.hash === '#movimiento') document.getElementById('movimiento')?.scrollIntoView({behavior:'smooth'})
  }, [ready])

  const reload = useCallback(async () => {
    const [a, b, c] = await Promise.all([px.listTransactions(), px.listGoals(), px.listRecurring()])
    setTx(a); setGoals(b); setRecurring(c)
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        // Genera primero los ingresos/gastos periódicos que ya vencieron
        const n = await px.applyRecurring().catch(() => 0)
        await reload()
        if (n > 0) notify(`Se registraron ${n} movimiento${n === 1 ? '' : 's'} periódico${n === 1 ? '' : 's'}`)
      } catch (e) { notify(e.message, 'err') } finally { setReady(true) }
    })()
  }, [reload, notify, refreshProfile])

  return (
    <div className="finance-page space-y-4">
      <PillarHeader pillar="finanzas" title="Finanzas" kicker="Ingresos, gastos y ahorro" color={GOLD} icon="💰" />
      {!ready ? <p className="py-8 text-center text-sm text-sub">Cargando…</p> : <>
        <section className="surface space-y-3 !bg-card p-4"><div><p className="text-[12px] font-semibold text-sub">Balance del mes</p><p className="break-words font-display text-[28px] font-extrabold tabular-nums">{money(flow(between(tx,monthStart(),todayStr())).in-flow(between(tx,monthStart(),todayStr())).out)}</p></div><p className="flex flex-wrap justify-between gap-2 text-[12px] text-sub">Ahorro del mes <strong className="text-[16px] text-finance">{money(flow(between(tx,monthStart(),todayStr())).save)}</strong></p><button type="submit" form="finance-movement" className="btn w-full">Registrar movimiento</button></section>
        <Movements tx={tx} goals={goals} recurring={recurring} reload={reload} notify={notify} />
        <div id="metas" className="scroll-mt-24"><Goals tx={tx} goals={goals} reload={reload} notify={notify} /></div>
        <Summary tx={tx} goals={goals} goSection={() => document.getElementById('metas')?.scrollIntoView({behavior:'smooth'})} />
        <Movements tx={tx} goals={goals} recurring={recurring} reload={reload} notify={notify} historyOnly />
      </>}
      <Toast msg={toast} />
    </div>
  )
}
