// Vibración corta al seleccionar (solo en dispositivos que lo permiten)
export const haptic = (ms = 8) => {
  try { if (navigator.vibrate) navigator.vibrate(ms) } catch { /* sin soporte */ }
}
