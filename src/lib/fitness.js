import { sum } from './dates'

// Agrupa series (cualquier orden) por día → Map(día → series en orden de registro)
export function groupByDay(rows) {
  const m = new Map()
  for (const r of rows) {
    if (!m.has(r.performed_at)) m.set(r.performed_at, [])
    m.get(r.performed_at).push(r)
  }
  return m
}

export const volumeOf = (sets) => sum(sets, (s) => Number(s.weight_kg) * s.reps)
export const maxWeight = (sets) => Math.max(0, ...sets.map((s) => Number(s.weight_kg)))
// Estimación de 1RM (fórmula de Epley)
export const e1rm = (w, r) => (r <= 1 ? w : w * (1 + r / 30))

// Une series consecutivas idénticas: 3 filas de 60×8 → { weight_kg: 60, reps: 8, count: 3 }
export function compress(sets) {
  const out = []
  for (const s of sets) {
    const last = out[out.length - 1]
    const w = Number(s.weight_kg)
    if (last && last.weight_kg === w && last.reps === s.reps && (last.rpe ?? null) === (s.rpe ?? null)) {
      last.count++
      last.ids.push(s.id)
    } else {
      out.push({ weight_kg: w, reps: s.reps, rpe: s.rpe ?? null, rest_seconds: s.rest_seconds ?? null, notes: s.notes ?? null, count: 1, ids: [s.id] })
    }
  }
  return out
}

export const kg = (n) => `${Number(n).toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg`
export const fmtGroup = (g) => `${Number(g.weight_kg).toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg × ${g.reps}${g.count > 1 ? ` · ${g.count} series` : ''}`
