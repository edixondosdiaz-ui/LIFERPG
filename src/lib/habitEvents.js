// Notificación en memoria; los datos y las fechas siempre se vuelven a leer de Supabase.
const listeners = new Set()
export function subscribeHabitChanges(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export function notifyHabitChanges() {
  for (const listener of listeners) listener()
}
