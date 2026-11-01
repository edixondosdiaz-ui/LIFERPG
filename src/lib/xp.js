export const XP = { HABIT: 20, SET: 5, OVERLOAD_BONUS: 10 }

// Nivel 2 con 100 XP, nivel 3 con 400, nivel 4 con 900...
export const levelFromXp = (xp) => Math.floor(Math.sqrt(xp / 100)) + 1
const xpForLevel = (level) => (level - 1) ** 2 * 100

export function levelProgress(xp) {
  const level = levelFromXp(xp)
  const base = xpForLevel(level)
  const needed = xpForLevel(level + 1) - base
  const current = xp - base
  return { level, current, needed, pct: Math.round((current / needed) * 100) }
}

export const PILLARS = {
  fuerza: { label: 'Fuerza', icon: '💪' },
  vitalidad: { label: 'Salud', icon: '❤️' },
  intelecto: { label: 'Educación', icon: '🧠' },
  finanzas: { label: 'Finanzas', icon: '💰' },
}

export const HABITS = {
  vitalidad: ['Agua', 'Sueño'],
  intelecto: ['Lectura', 'Estudio'],
  finanzas: ['Registrar gastos', 'Ahorro'],
}
