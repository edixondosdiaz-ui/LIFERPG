import { test } from 'node:test'
import assert from 'node:assert/strict'
import { studyMonthDays,shiftStudyMonth,studyDate,studyLevel,studyDaySummary,studyMonthSummary } from '../src/lib/studyCalendar.js'
test('cuadrícula empieza lunes, admite bisiestos y meses de seis semanas',()=>{
  const feb=studyMonthDays('2024-02')
  assert.equal(feb.length%7,0);assert.equal(feb[3],'2024-02-01');assert.ok(feb.includes('2024-02-29'))
  assert.equal(studyMonthDays('2026-03').length,42)
  assert.equal(studyMonthDays('2026-11')[6],'2026-11-01')
  assert.equal(studyMonthDays('2025-02').filter(Boolean).length,28)
})
test('navegación cruza años en ambos sentidos y no falla en el límite superior',()=>{
  assert.equal(shiftStudyMonth('2026-01',-1),'2025-12')
  assert.equal(shiftStudyMonth('2026-12',1),'2027-01')
  assert.equal(studyMonthDays('9999-12').filter(Boolean).length,31)
})
test('DATE de Colombia no se convierte a UTC; timestamps sin DATE usan Bogotá',()=>{
  assert.equal(studyDate({studied_on:'2026-11-12',created_at:'2026-11-13T04:59:59Z'}),'2026-11-12')
  assert.equal(studyDate({created_at:'2026-11-13T04:59:59Z'}),'2026-11-12')
  assert.equal(studyDate({created_at:'2026-11-13T05:00:00Z'}),'2026-11-13')
})
test('minutos, Pomodoros y XP solo suman lo registrado, incluido XP cero',()=>{
  const rows=[{minutes:25,mode:'pomodoro',xp_awarded:22},{minutes:10,mode:'libre',xp_awarded:null},{minutes:5,mode:'libre',xp_awarded:0}]
  assert.deepEqual(studyDaySummary(rows),{minutes:40,pomodoros:1,xp:22,unknownXp:1})
  assert.deepEqual(studyDaySummary([]),{minutes:0,pomodoros:0,xp:0,unknownXp:0})
})
test('escala conserva cinco intensidades y racha mensual usa fechas distintas',()=>{
  assert.deepEqual([0,1,29,30,59,60,119,120].map(studyLevel),[0,1,1,2,2,3,3,4])
  const stats=studyMonthSummary(['01','01','02','04'].map(d=>({studied_on:`2026-11-${d}`,minutes:25,mode:'pomodoro',xp_awarded:null})))
  assert.equal(stats.activeDays,3);assert.equal(stats.minutes,100);assert.equal(stats.bestStreak,2)
})
