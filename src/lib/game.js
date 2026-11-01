export const PILLARS = {
  fuerza:     { key: 'fuerza',     label: 'Fuerza',       short: 'Fuerza',       icon: '⚔️', color: '#ff4d4f', name: 'Deporte',   desc: 'Rutinas y sobrecarga progresiva' },
  vitalidad:  { key: 'vitalidad',  label: 'Vitalidad',    short: 'Vitalidad',    icon: '💚', color: '#2fbf4a', name: 'Salud',     desc: 'Hábitos de bienestar y sueño' },
  intelecto:  { key: 'intelecto',  label: 'Intelecto',    short: 'Intelecto',    icon: '🧠', color: '#38bdf8', name: 'Educación', desc: 'Aprendizaje y crecimiento mental' },
  financiero: { key: 'financiero', label: 'C. Financiero', short: 'C. Financiero', icon: '💰', color: '#e6b43c', name: 'Finanzas',  desc: 'Control financiero e inversiones' },
};
export const PILLAR_KEYS = Object.keys(PILLARS);

export const CLASSES = [
  { id: 'guerrero', label: 'Guerrero', icon: '⚔️', color: '#ff4d4f' },
  { id: 'mago',     label: 'Mago',     icon: '🧙', color: '#a855f7' },
  { id: 'picaro',   label: 'Pícaro',   icon: '🗡️', color: '#e6b43c' },
  { id: 'casual',   label: 'Casual',   icon: '👕', color: '#38bdf8' },
];

export const SKINS = ['#ffdbb4', '#f1c27d', '#c68642', '#8d5524', '#4a2c14', '#ffe0bd'];
export const HAIR_COLORS = ['#1a0f0a', '#3b2314', '#7a4a10', '#c19a6b', '#f4d03f', '#e8e8e8', '#a855f7', '#ff4d4f', '#38bdf8'];
export const EYE_COLORS = ['#38bdf8', '#2fbf4a', '#7a4a10', '#a855f7', '#e8e8e8'];
export const HAIR_STYLES = [
  { id: 'corto', label: 'Corto', icon: '✂️' },
  { id: 'medio', label: 'Medio', icon: '💈' },
  { id: 'largo', label: 'Largo', icon: '🌊' },
  { id: 'rizado', label: 'Rizado', icon: '🌀' },
  { id: 'monio', label: 'Moño', icon: '🎀' },
];
export const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const STAT_MAX = 50;

// Hábitos base por pilar (xp = experiencia, stat = puntos de atributo)
export const DEFAULT_HABITS = [
  { id: 'f1', pillar: 'fuerza', name: 'Sesión de Pecho y Tríceps', icon: '🏋️', xp: 120, stat: 3 },
  { id: 'f2', pillar: 'fuerza', name: '30 min Cardio HIIT', icon: '🏃', xp: 80, stat: 2 },
  { id: 'v1', pillar: 'vitalidad', name: 'Tomar 2 L de agua', icon: '💧', xp: 40, stat: 1 },
  { id: 'v2', pillar: 'vitalidad', name: 'Dormir 8 horas', icon: '😴', xp: 60, stat: 2 },
  { id: 'v3', pillar: 'vitalidad', name: 'Comida saludable', icon: '🥗', xp: 50, stat: 1 },
  { id: 'i1', pillar: 'intelecto', name: 'Leer 30 minutos', icon: '📚', xp: 60, stat: 2 },
  { id: 'i2', pillar: 'intelecto', name: 'Estudiar 1 hora', icon: '✏️', xp: 90, stat: 3 },
  { id: 'i3', pillar: 'intelecto', name: 'Practicar un idioma', icon: '🗣️', xp: 50, stat: 1 },
  { id: 'c1', pillar: 'financiero', name: 'Registrar gastos del día', icon: '🧾', xp: 40, stat: 2 },
  { id: 'c2', pillar: 'financiero', name: 'Ahorrar / invertir', icon: '🐷', xp: 60, stat: 2 },
];

export const xpForLevel = (lvl) => lvl * 250;
export const todayKey = (d = new Date()) => {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};
export const weekdayIndex = (d = new Date()) => (d.getDay() + 6) % 7; // 0 = Lunes

export const newState = (uid) => ({
  uid, profile: null, pillars: [], trainDays: [],
  level: 1, xp: 0, totalXp: 0,
  stats: { fuerza: 0, vitalidad: 0, intelecto: 0, financiero: 0 },
  streak: 0, lastDate: null, log: {}, customHabits: [],
  routines: {}, history: [], weeklyGoal: 500, notifications: false,
});

export const getHabits = (s) =>
  [...DEFAULT_HABITS, ...s.customHabits].filter((h) => s.pillars.includes(h.pillar));

// Suma/resta XP y puntos de atributo manejando subida y bajada de nivel
function applyDelta(s, dxp, pillar, dstat) {
  let { xp, level } = s;
  xp += dxp;
  while (xp >= xpForLevel(level)) { xp -= xpForLevel(level); level++; }
  while (xp < 0 && level > 1) { level--; xp += xpForLevel(level); }
  xp = Math.max(0, xp);
  const stats = { ...s.stats, [pillar]: Math.min(STAT_MAX, Math.max(0, s.stats[pillar] + dstat)) };
  return { ...s, xp, level, stats, totalXp: Math.max(0, s.totalXp + dxp) };
}

// Marca / desmarca un hábito. Con foto de evidencia: +25% XP (RF-05)
export function toggleHabit(s, h, photo = false) {
  const today = todayKey();
  const day = { ...(s.log[today] || {}) };
  let next;
  if (day[h.id]) {
    const e = day[h.id];
    delete day[h.id];
    next = applyDelta(s, -e.xp, h.pillar, -e.stat);
  } else {
    const xp = Math.round(h.xp * (photo ? 1.25 : 1));
    day[h.id] = { xp, stat: h.stat, photo };
    next = applyDelta(s, xp, h.pillar, h.stat);
    if (next.lastDate !== today) {
      const y = new Date(); y.setDate(y.getDate() - 1);
      next.streak = next.lastDate === todayKey(y) ? next.streak + 1 : 1;
      next.lastDate = today;
    }
  }
  return { ...next, log: { ...s.log, [today]: day } };
}

export const weeklyPotential = (days, pillars) => days * 120 + pillars * 50;

export const ACHIEVEMENTS = [
  { id: 'a1', icon: '🔥', label: 'Racha de 7 días', test: (s) => s.streak >= 7 },
  { id: 'a2', icon: '💪', label: 'Primera semana gym', test: (s) => s.history.length >= 3 },
  { id: 'a3', icon: '📚', label: 'Lector constante', test: (s) => Object.values(s.log).filter((d) => d.i1).length >= 5 },
  { id: 'a4', icon: '🏆', label: 'Top 10 Global', test: (s, rank) => rank <= 10 },
  { id: 'a5', icon: '⚡', label: 'Racha de 30 días', test: (s) => s.streak >= 30 },
  { id: 'a6', icon: '💎', label: 'Nivel 20', test: (s) => s.level >= 20 },
];
