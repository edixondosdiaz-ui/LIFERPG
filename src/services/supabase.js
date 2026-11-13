import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env.local (y reinicia npm run dev)'
  )
}

export const supabase = createClient(url, key)
// Se captura antes de montar React para no perder el evento del enlace inicial.
export const recoveryState = { valid: false }
supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') recoveryState.valid = true
  if (event === 'SIGNED_OUT') recoveryState.valid = false
})
