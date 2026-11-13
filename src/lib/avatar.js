import { avatarTokens } from '../design/tokens.js'
// Opciones del avatar "versión futura". Se guardan tal cual en profiles.avatar (jsonb).
export const SKINS = avatarTokens.skin
export const HAIR_COLORS = avatarTokens.hair
export const EYE_COLORS = avatarTokens.eyes
export const SHIRT_COLORS = avatarTokens.shirt

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
export const AESTHETICS = avatarTokens.aesthetics

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
