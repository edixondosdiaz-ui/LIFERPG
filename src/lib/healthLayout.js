export function healthFailure(error,message='No pudimos completar la solicitud. Intenta de nuevo en un momento.'){
 console.error('[Salud]',error)
 return message
}
