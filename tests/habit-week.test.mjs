import { test } from 'node:test'
import assert from 'node:assert/strict'
import { today } from '../src/lib/dates.js'
import { habitWeekDays, habitStreak, habitWeekRows } from '../src/lib/habitWeek.js'
import { subscribeHabitChanges, notifyHabitChanges } from '../src/lib/habitEvents.js'

test('el cambio de día sigue la medianoche de Bogotá',()=>{
  assert.equal(today(new Date('2026-11-14T04:59:59Z')),'2026-11-13')
  assert.equal(today(new Date('2026-11-14T05:00:00Z')),'2026-11-14')
})
test('semana lunes a domingo incluso al cambiar de año',()=>{
  const days=habitWeekDays('2027-01-01')
  assert.equal(days.length,7)
  assert.equal(days[0].date,'2026-12-28')
  assert.equal(days[6].date,'2027-01-03')
})
test('cero registros deja los siete días sin hábitos',()=>{
  assert.ok(habitWeekRows({today:'2026-11-13',days:[],streak:0},'2026-11-13').every(d=>d.habits.length===0))
  assert.equal(habitStreak([],'2026-11-13'),0)
})
test('racha cuenta días distintos, admite ayer y descarta futuros',()=>{
  assert.equal(habitStreak(['2026-11-11','2026-11-12','2026-11-12','2026-11-14'],'2026-11-13'),2)
  assert.equal(habitStreak(['2026-11-11'],'2026-11-13'),0)
  assert.equal(habitStreak(['2026-11-12','2026-11-13'],'2026-11-13'),2)
})
test('solo se enciende la fecha con hábitos reales, nunca el futuro',()=>{
  const rows=habitWeekRows({today:'2026-11-13',days:[{date:'2026-11-13',habits:[{habit:'Agua',count:1}]},{date:'2026-11-14',habits:[{habit:'Agua',count:1}]}]},'2026-11-13')
  assert.equal(rows.filter(d=>d.habits.length).length,1)
  assert.equal(rows[4].habits[0].habit,'Agua')
})
test('notificación local actualiza suscriptores y permite limpiarlos',()=>{
  let calls=0
  const unsubscribe=subscribeHabitChanges(()=>calls++)
  notifyHabitChanges();assert.equal(calls,1)
  unsubscribe();notifyHabitChanges();assert.equal(calls,1)
})
