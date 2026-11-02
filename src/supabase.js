import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_KEY. Fill them in .env and restart.')
}

// Safety net: refuse to run with a secret key, since everything here ships to the browser.
function isSecretKey(key) {
  if (key.startsWith('sb_secret_')) return true
  // Legacy JWT keys: the payload says role "anon" or "service_role".
  try {
    const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.role === 'service_role'
  } catch {
    return false
  }
}

if (isSecretKey(supabaseKey)) {
  throw new Error(
    'VITE_SUPABASE_KEY is a secret/service_role key. Use the publishable (anon) key instead.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey)
