<script setup>
import { watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { user } from './auth'

const route = useRoute()
const router = useRouter()

// React to sign-in / sign-out while a page is already open
// (e.g. signing out on the dashboard, or a session ending in another tab).
watch(user, (u) => {
  if (!u && route.meta.requiresAuth) router.replace({ name: 'landing' })
  if (u && route.meta.guestOnly) router.replace({ name: 'dashboard' })
})
</script>

<template>
  <div class="min-h-dvh bg-base-200">
    <RouterView />
  </div>
</template>
