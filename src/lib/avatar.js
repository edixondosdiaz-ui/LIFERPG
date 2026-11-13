// Opciones del avatar "versión futura". Se guardan tal cual en profiles.avatar (jsonb).
export const SKINS = ['#f6d7bd', '#ecbf98', '#d29a6c', '#b27849', '#8a5733', '#5d3a22', '#fbe6d4', '#40291f']
export const HAIR_COLORS = ['#14100d', '#3a2515', '#6b4423', '#a5773f', '#d9b66a', '#cfcfd2', '#7c3aed', '#be3b45']
export const EYE_COLORS = ['#2b1d12', '#5b3a1c', '#2f6f4f', '#3b6ea8', '#6b7280', '#9a683b']
export const SHIRT_COLORS = ['#2d2a45', '#8b91a5', '#111827', '#7c4a1d']

export const FACES = [
  { id: 'ovalado', label: 'Ovalado' },
  { id: 'redondo', label: 'Redondo' },
  { id: 'cuadrado', label: 'Cuadrado' },
]
export const HAIRS = [
  { id: 'rapado', label: 'Rapado' },
  { id: 'corto', label: 'Corto' },
  { id: 'texturizado', label: 'Texturizado' },
  { id: 'largo', label: 'Largo' },
  { id: 'rizado', label: 'Rizado' },
  { id: 'monio', label: 'Moño' },
  { id: 'calvo', label: 'Sin pelo' },
  { id: 'trenzas', label: 'Trenzas' },
]
export const BEARDS = [
  { id: 'ninguna', label: 'Ninguna' },
  { id: 'sombra', label: 'Sombra' },
  { id: 'corta', label: 'Corta' },
  { id: 'completa', label: 'Completa' },
]
export const ACCESSORIES = [
  { id: 'ninguno', label: 'Ninguno' },
  { id: 'cinta', label: 'Cinta' },
  { id: 'aro', label: 'Aro' },
  { id: 'audifonos', label: 'Audífonos' },
]
// "Estética general": define el fondo y la ropa base
export const AESTHETICS = {
  atleta: { label: 'Atleta', bg: ['#2a1b4d', '#0f0b1c'], shirt: '#2d2a45', accent: '#a855f7' },
  minimal: { label: 'Minimal', bg: ['#2b2f3a', '#12141b'], shirt: '#8b91a5', accent: '#e5e7eb' },
  noche: { label: 'Noche', bg: ['#10243a', '#070d16'], shirt: '#111827', accent: '#38bdf8' },
  solar: { label: 'Solar', bg: ['#4a2a12', '#170d06'], shirt: '#7c4a1d', accent: '#e6b43c' },
}

export const DEFAULT_AVATAR = {
  skin: SKINS[2], face: 'ovalado', hair: 'corto', hairColor: HAIR_COLORS[1],
  eyes: EYE_COLORS[1], beard: 'ninguna', accessory: 'ninguno', aesthetic: 'atleta',
  shirtColor: SHIRT_COLORS[0],
}

export const normalizeAvatar = (a) => ({ ...DEFAULT_AVATAR, ...(a || {}), shirtColor: a?.shirtColor || AESTHETICS[a?.aesthetic]?.shirt || SHIRT_COLORS[0] })
export function randomAvatar() {
  const pick = (list) => list[Math.floor(Math.random() * list.length)]
  return { ...DEFAULT_AVATAR, skin: pick(SKINS), hair: pick(HAIRS).id, hairColor: pick(HAIR_COLORS), eyes: pick(EYE_COLORS), beard: pick(BEARDS).id, face: pick(FACES).id, shirtColor: pick(SHIRT_COLORS) }
}
// ¿El usuario ya personalizó algo? (profiles.avatar viene como {} al inicio)
export const hasAvatar = (a) => !!a && Object.keys(a).length > 0
