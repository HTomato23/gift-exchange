import { createRouter, createWebHistory } from 'vue-router'
import { user, whenAuthReady } from '@/auth'
import LandingView from '@/views/LandingView.vue'
import DashboardView from '@/views/DashboardView.vue'
import WishlistView from '@/views/WishlistView.vue'
import DrawView from '@/views/DrawView.vue'
import AdminView from '@/views/AdminView.vue'
import PrivacyView from '@/views/PrivacyView.vue'
import { supabase } from '@/supabase'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // guestOnly: signed-in users are sent to the dashboard
    { path: '/', name: 'landing', component: LandingView, meta: { guestOnly: true } },
    // requiresAuth: signed-out users are sent to the landing page
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardView,
      meta: { requiresAuth: true },
    },
    // Join the exchange / edit your own wish list (read-only after the draw)
    {
      path: '/wishlist',
      name: 'wishlist',
      component: WishlistView,
      meta: { requiresAuth: true },
    },
    // Reveal your match (unlocks after the admin runs the draw)
    { path: '/draw', name: 'draw', component: DrawView, meta: { requiresAuth: true } },
    // Admin tools: families + start the draw (requiresAdmin: non-admins go to the dashboard)
    {
      path: '/admin',
      name: 'admin',
      component: AdminView,
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    // Public privacy policy (no sign-in needed; linked from Google's consent screen)
    { path: '/privacy', name: 'privacy', component: PrivacyView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

// Wait until Supabase knows the session, then send each user to the right page.
// This only controls navigation; the real data protection is RLS in the database.
router.beforeEach(async (to) => {
  await whenAuthReady
  if (to.meta.requiresAuth && !user.value) return { name: 'landing' }
  if (to.meta.guestOnly && user.value) return { name: 'dashboard' }
  if (to.meta.requiresAdmin) {
    const { data } = await supabase.rpc('is_admin')
    if (data !== true) return { name: 'dashboard' }
  }
})

export default router
