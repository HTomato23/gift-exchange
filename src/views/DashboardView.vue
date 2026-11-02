<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { supabase } from '@/supabase'
import { user, signOut } from '@/auth'
import SnowBackground from '@/components/SnowBackground.vue'
import { EVENT } from '@/event'

const loading = ref(true)
const error = ref('')
const participant = ref(null) // the signed-in user's own participants row, or null if not joined yet
const isAdmin = ref(false)
const drawDone = ref(false)
const signingOut = ref(false)

// Coming back from the wish-list form after saving (?saved=1): show a success message once,
// then clean the URL so a refresh doesn't show it again.
const route = useRoute()
const router = useRouter()
const justSaved = ref(route.query.saved === '1')
if (justSaved.value) router.replace({ query: {} })

// Hide the saved message automatically after 5 seconds (it can also be closed with ✕).
const hideSavedTimer = justSaved.value ? setTimeout(() => (justSaved.value = false), 5000) : null
onUnmounted(() => clearTimeout(hideSavedTimer))

const year = new Date().getFullYear()

// Google profile info (shown until the user has their own participants row).
const googleName = computed(() => user.value?.user_metadata?.full_name ?? '')
const avatarUrl = computed(() => user.value?.user_metadata?.avatar_url ?? '')

const firstName = computed(() => {
  const p = participant.value
  const name = p?.nickname || p?.full_name || googleName.value || user.value?.email || ''
  return name.split(/[\s@]/)[0]
})

// Days until the next event day (EVENT.countdownTo in src/event.js, e.g. Dec 27).
const eventDay = computed(() => {
  const { month, day } = EVENT.countdownTo
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let date = new Date(today.getFullYear(), month - 1, day)
  if (today > date) date = new Date(today.getFullYear() + 1, month - 1, day)
  return { date, days: Math.round((date - today) / 86_400_000) }
})

// Wishes 1–3 that are filled in. Links are only shown if they are http(s).
const wishes = computed(() => {
  const p = participant.value
  if (!p) return []
  return [1, 2, 3]
    .map((n) => ({ wish: p[`wish_${n}`], link: p[`link_${n}`] }))
    .filter((w) => w.wish)
    .map((w) => ({ ...w, link: /^https?:\/\//i.test(w.link ?? '') ? w.link : null }))
})

const tiles = computed(() => [
  {
    icon: '🎅',
    title: 'Gift buddy',
    // The match is revealed in the app on the Draw page once the admin has run the draw.
    value: drawDone.value ? 'Ready to draw! 🎁' : 'Not drawn yet',
    note: drawDone.value ? 'Open the Draw page' : 'Unlocks after the admin draw',
  },
  {
    icon: '📅',
    title: 'Event countdown',
    value:
      eventDay.value.days === 0
        ? 'Today! 🎉'
        : `${eventDay.value.days} ${eventDay.value.days === 1 ? 'day' : 'days'}`,
    note: eventDay.value.date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
  },
  // Gift amount and event details come from src/event.js
  {
    icon: '💰',
    title: 'Exchange Gift Amount',
    value: EVENT.giftAmount,
    note: EVENT.giftAmountNote,
    extra: EVENT.giftAmountExtra,
  },
  {
    icon: '📍',
    title: 'Event Details',
    value: EVENT.date,
    note: EVENT.location || 'Place to be announced',
    extra: EVENT.extra,
  },
])

onMounted(async () => {
  const [row, admin, draw] = await Promise.all([
    supabase.from('participants').select('*').eq('user_id', user.value.id).maybeSingle(),
    supabase.rpc('is_admin'),
    supabase.rpc('draw_done'),
  ])
  const failed = row.error || admin.error || draw.error
  if (failed) error.value = failed.message
  participant.value = row.data ?? null
  isAdmin.value = admin.data === true
  drawDone.value = draw.data === true
  loading.value = false
})

async function handleSignOut() {
  signingOut.value = true
  await signOut()
  // App.vue sends the user back to the landing page once the session is gone.
}
</script>

<template>
  <div class="relative min-h-dvh">
    <SnowBackground />

    <main class="relative mx-auto flex w-full max-w-xl flex-col gap-4 p-4 pb-10">
      <!-- Greeting panel -->
      <section
        class="relative overflow-hidden rounded-box bg-linear-to-br from-primary to-secondary p-6 text-primary-content shadow-xl motion-safe:animate-rise"
      >
        <span class="absolute top-4 right-24 text-xs text-accent" aria-hidden="true">✦</span>
        <span class="absolute right-6 bottom-5 text-base text-primary-content/40" aria-hidden="true"
          >❄</span
        >
        <span
          class="absolute right-4 -bottom-3 text-7xl opacity-90 motion-safe:animate-float"
          aria-hidden="true"
          >🎁</span
        >

        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-3">
            <div class="avatar">
              <div class="w-11 rounded-full ring-2 ring-primary-content/40">
                <img v-if="avatarUrl" :src="avatarUrl" alt="" referrerpolicy="no-referrer" />
                <div v-else class="flex h-full items-center justify-center bg-secondary text-lg">
                  🎄
                </div>
              </div>
            </div>
            <span v-if="isAdmin" class="badge badge-accent badge-sm font-semibold">Admin</span>
          </div>
          <button
            class="btn btn-ghost btn-sm text-primary-content hover:bg-primary-content/10"
            :disabled="signingOut"
            @click="handleSignOut"
          >
            <span v-if="signingOut" class="loading loading-spinner loading-xs"></span>
            Sign out
          </button>
        </div>

        <div class="mt-6 pr-20">
          <h1 class="text-3xl leading-tight font-bold">
            Hi, <template v-if="loading">…</template><template v-else>{{ firstName }}</template
            >!
          </h1>
          <p class="font-medium text-accent">Exchange Gift {{ year }}</p>
          <p class="mt-2 text-sm text-primary-content/80">
            Ho ho ho! Christmas is coming. Get your wish list ready so your Santa knows what makes
            you smile.
          </p>
        </div>
      </section>

      <!-- Saved message: same width, corners, padding and shadow as the greeting banner.
           Fades out when it disappears. -->
      <Transition
        leave-active-class="transition duration-500 ease-in"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div
          v-if="justSaved"
          role="alert"
          class="alert alert-success alert-soft alert-horizontal w-full rounded-box border-0 p-6 text-left shadow-xl motion-safe:animate-rise"
        >
          <span class="text-2xl" aria-hidden="true">🎉</span>
          <div>
            <p class="font-semibold">Your wish list is saved!</p>
            <p class="text-sm opacity-90">Your Santa will see it after the draw.</p>
          </div>
          <button
            class="btn btn-circle btn-sm ml-auto hover:bg-success-content/10"
            aria-label="Dismiss"
            @click="justSaved = false"
          >
            ✕
          </button>
        </div>
      </Transition>

      <div v-if="error" role="alert" class="alert alert-error">
        <span>{{ error }}</span>
      </div>

      <!-- Draw button: locked until the admin runs the draw (draw_done() = true).
           Only people who joined before the draw are part of it. -->
      <section
        v-if="!loading && (participant || !drawDone)"
        class="card bg-base-100 shadow-sm motion-safe:animate-rise [animation-delay:0.05s]"
      >
        <div class="card-body flex-row items-center gap-4">
          <span
            class="text-4xl"
            :class="{ 'motion-safe:animate-float': drawDone }"
            aria-hidden="true"
            >{{ drawDone ? '🎁' : '🔒' }}</span
          >
          <div class="min-w-0 flex-1">
            <h2 class="font-semibold text-secondary">
              {{ drawDone ? 'The draw is done!' : 'Draw my match' }}
            </h2>
            <p class="text-sm text-base-content/70">
              <template v-if="drawDone">Find out who you're buying for.</template>
              <template v-else-if="!participant">Join the exchange first to take part.</template>
              <template v-else>Waiting for the admin to start the draw.</template>
            </p>
          </div>
          <RouterLink v-if="drawDone" :to="{ name: 'draw' }" class="btn btn-primary shrink-0"
            >Draw</RouterLink
          >
          <button v-else class="btn shrink-0" disabled>Draw</button>
        </div>
      </section>

      <!-- Info tiles -->
      <section class="grid grid-cols-2 gap-3">
        <template v-if="loading">
          <div v-for="n in 4" :key="n" class="skeleton h-32 rounded-box"></div>
        </template>
        <div
          v-for="(tile, i) in tiles"
          v-else
          :key="tile.title"
          class="card relative overflow-hidden bg-linear-to-br from-primary to-secondary text-primary-content shadow-xl motion-safe:animate-rise"
          :style="{ animationDelay: `${0.1 + i * 0.07}s` }"
        >
          <span class="absolute top-3 right-4 text-xs text-accent" aria-hidden="true">✦</span>
          <div class="card-body gap-1 p-4">
            <span class="text-3xl" aria-hidden="true">{{ tile.icon }}</span>
            <h2 class="mt-1 text-xs font-medium text-primary-content/70">{{ tile.title }}</h2>
            <p class="leading-tight font-semibold wrap-break-word">
              {{ tile.value }}
            </p>
            <p class="text-xs wrap-break-word text-accent">{{ tile.note }}</p>
            <span
              v-if="tile.extra"
              class="badge mt-1 h-auto badge-sm border-0 bg-primary-content/15 py-0.5 text-left leading-tight text-primary-content"
              >{{ tile.extra }}</span
            >
          </div>
        </div>
      </section>

      <!-- Wish list -->
      <section class="card bg-base-100 shadow-sm motion-safe:animate-rise [animation-delay:0.4s]">
        <div class="card-body gap-3">
          <div class="flex items-center justify-between gap-2">
            <h2 class="card-title text-secondary">🎁 My wish list</h2>
            <span v-if="participant && drawDone" class="badge badge-ghost badge-sm">🔒 Locked</span>
          </div>

          <div v-if="loading" class="flex flex-col gap-2">
            <div class="skeleton h-12 w-full"></div>
            <div class="skeleton h-12 w-full"></div>
          </div>

          <!-- Not joined, draw already done: the database blocks new sign-ups -->
          <template v-else-if="!participant && drawDone">
            <div role="alert" class="alert alert-warning alert-soft">
              <span>
                Sign-ups are closed 🔒 The draw has already been made, so new people can't join this
                year.
              </span>
            </div>
          </template>

          <!-- Not joined yet -->
          <template v-else-if="!participant">
            <p class="text-sm text-base-content/70">
              You haven't joined the exchange yet. Add your name and up to three wishes so your
              Secret Santa knows what to get you.
            </p>
            <RouterLink :to="{ name: 'wishlist' }" class="btn btn-primary btn-block">
              Join &amp; add my wishes 🎄
            </RouterLink>
          </template>

          <!-- Joined: show wishes -->
          <template v-else>
            <p
              v-if="!wishes.length"
              class="rounded-lg bg-base-200 p-3 text-sm text-base-content/70"
            >
              🎁 No specific wishes. Your Santa will surprise you!
            </p>
            <ol v-else class="flex flex-col gap-2">
              <li
                v-for="(item, i) in wishes"
                :key="i"
                class="flex items-center gap-3 rounded-lg bg-base-200 p-3"
              >
                <span class="badge badge-primary badge-sm shrink-0">{{ i + 1 }}</span>
                <span class="min-w-0 flex-1 wrap-break-word">{{ item.wish }}</span>
                <a
                  v-if="item.link"
                  :href="item.link"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn btn-ghost btn-xs shrink-0"
                  >Link ↗</a
                >
              </li>
            </ol>
            <div v-if="participant.notes" class="rounded-lg bg-base-200 p-3 text-sm">
              <p class="font-medium text-secondary">Notes for your Santa</p>
              <p class="mt-1 whitespace-pre-line wrap-break-word text-base-content/80">
                {{ participant.notes }}
              </p>
            </div>
            <RouterLink
              v-if="!drawDone"
              :to="{ name: 'wishlist' }"
              class="btn btn-outline btn-primary btn-block"
            >
              Edit my wishes
            </RouterLink>
          </template>
        </div>
      </section>

      <!-- Admin-only link (display only; RLS protects the real data) -->
      <section
        v-if="isAdmin"
        class="card border border-dashed border-success bg-base-100 shadow-sm motion-safe:animate-rise [animation-delay:0.5s]"
      >
        <div class="card-body gap-2">
          <h2 class="card-title text-secondary">🛠️ Admin tools</h2>
          <p class="text-sm text-base-content/70">
            Set up families, check who joined, and start the draw.
          </p>
          <RouterLink :to="{ name: 'admin' }" class="btn btn-secondary btn-block">
            Open admin tools
          </RouterLink>
        </div>
      </section>
    </main>
  </div>
</template>
