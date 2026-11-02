import { computed, ref } from 'vue'
import { supabase } from './supabase'

// Shared, app-wide auth state. Import these anywhere instead of calling Supabase directly.
export const session = ref(null)
export const authReady = ref(false)
export const user = computed(() => session.value?.user ?? null)

// Resolves once we know whether someone is signed in (used by the router guard).
let markReady
export const whenAuthReady = new Promise((resolve) => (markReady = resolve))

function setSession(newSession) {
  session.value = newSession
  authReady.value = true
  markReady()
}

supabase.auth.getSession().then(({ data }) => setSession(data.session))

supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession))

export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
}

export function signOut() {
  return supabase.auth.signOut()
}
