// Fechas en hora de Colombia, siempre como texto AAAA-MM-DD.
// La aritmética se hace a mediodía UTC para evitar saltos por zona horaria.
const TZ = 'America/Bogota'

export const today = (date = new Date()) => date.toLocaleDateString('en-CA', { timeZone: TZ })

const at = (s) => new Date(`${s}T12:00:00Z`)

export function addDays(s, n) {
  const d = at(s)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Lunes de la semana de la fecha dada
export function weekStart(s = today()) {
  return addDays(s, -((at(s).getUTCDay() + 6) % 7))
}

export const monthStart = (s = today()) => `${s.slice(0, 7)}-01`

// Últimos n días terminando en `end` (de más antiguo a más reciente)
export function lastDays(n, end = today()) {
  return Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)))
}

const SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
export const weekdayLetter = (s) => SHORT[at(s).getUTCDay()]

export const fmtDay = (s) =>
  at(s).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('.', '')

export const fmtLong = (s) =>
  at(s).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

export const daysBetween = (a, b) => Math.round((at(b) - at(a)) / 86400000)

// Racha de días consecutivos que termina hoy (o ayer, si hoy aún no hay registro)
export function streakOf(daySet, end = today()) {
  let cur = daySet.has(end) ? end : addDays(end, -1)
  let n = 0
  while (daySet.has(cur)) { n++; cur = addDays(cur, -1) }
  return n
}

const copFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
export const money = (n) => copFmt.format(Math.round(Number(n) || 0))
export const compactMoney = (n) => {
  const v = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (v >= 1e6) return `${sign}$${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)} M`
  if (v >= 1e3) return `${sign}$${Math.round(v / 1e3)} k`
  return `${sign}$${Math.round(v)}`
}

export const fmtDuration = (sec) => {
  const s = Math.max(0, Math.round(sec))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`
}
export const fmtHours = (min) => {
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`
}
export const clock = (sec) => {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60
  const mm = String(m).padStart(2, '0'), ss = String(r).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
export const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0)
export const avg = (arr, f = (x) => x) => (arr.length ? sum(arr, f) / arr.length : 0)

export function addMonth(s) {
  const [y, m, d] = s.split('-').map(Number)
  const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1
  const dim = new Date(Date.UTC(ny, nm, 0)).getUTCDate()
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, dim)).padStart(2, '0')}`
}
// Misma regla que apply_recurring() en SQL
export const nextRecurring = (s, every) => (every === 'semanal' ? addDays(s, 7) : every === 'quincenal' ? addDays(s, 15) : addMonth(s))

// Claves 'AAAA-MM' de los últimos n meses (de más antiguo a más reciente)
export function lastMonths(n, end = today()) {
  let [y, m] = end.split('-').map(Number)
  const out = []
  for (let i = 0; i < n; i++) {
    out.unshift(`${y}-${String(m).padStart(2, '0')}`)
    m -= 1
    if (m === 0) { m = 12; y -= 1 }
  }
  return out
}
export const monthLabel = (key) => new Date(`${key}-15T12:00:00Z`).toLocaleDateString('es-CO', { month: 'short', timeZone: 'UTC' }).replace('.', '')
