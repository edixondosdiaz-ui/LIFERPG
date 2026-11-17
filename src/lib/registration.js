import { today } from './dates.js'

export const LEGAL_VERSION='2026-11-16.1'
export const MINIMUM_AGE=15
export const USERNAME_PATTERN=/^[a-z0-9_]{3,20}$/
export const normalizeUsername=value=>value.trim().toLowerCase()
export function birthDateValid(value,day=today()){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value) || value>day || value.slice(0,4)==='0000')return false
  const date=new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===value
}
export function ageOn(value,day=today()){
  if(!birthDateValid(value,day))return null
  const year=Number(day.slice(0,4))-Number(value.slice(0,4))
  return year-(day.slice(5)<value.slice(5)?1:0)
}
export const isMinor=(value,day=today())=>ageOn(value,day)!==null && ageOn(value,day)<18
export function registrationErrors(fields,day=today()){
  const errors={}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()))errors.email='Escribe un correo válido.'
  if(fields.password.length<8)errors.password='Usa al menos 8 caracteres.'
  if(!USERNAME_PATTERN.test(normalizeUsername(fields.username)))errors.username='Usa de 3 a 20 letras sin tildes, números o guion bajo.'
  if(!fields.displayName.trim() || fields.displayName.trim().length>40)errors.displayName='Escribe un nombre para mostrar de máximo 40 caracteres.'
  if(!birthDateValid(fields.birthDate,day))errors.birthDate='Elige una fecha de nacimiento válida que no sea futura.'
  if(birthDateValid(fields.birthDate,day) && ageOn(fields.birthDate,day)<MINIMUM_AGE)errors.birthDate=`Puedes registrarte desde los ${MINIMUM_AGE} años.`
  if(isMinor(fields.birthDate,day)){
    if(!fields.guardianAccepted)errors.guardianAccepted='El representante legal debe autorizar el registro y el tratamiento de datos.'
  }
  if(!fields.terms)errors.terms='Lee y acepta los términos y la política de privacidad para continuar.'
  return errors
}
