<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { supabase } from '@/supabase'
import { user } from '@/auth'
import SnowBackground from '@/components/SnowBackground.vue'

const year = new Date().getFullYear()

const loading = ref(true)
const error = ref('')
const joined = ref(false) // does the user have a participants row?
const drawDone = ref(false)

// stage: 'ready' (gift waiting) → 'shaking' (animation) → 'revealed'
const stage = ref('ready')
const match = ref(null) // normalised match, see normaliseMatch()
const notReady = ref(false) // true while the my_match() database function doesn't exist yet

// Remember on this device that the user already revealed, so later visits skip the animation.
// Display-only convenience; the match itself always comes from the database.
const revealedKey = computed(() => `gift-exchange:revealed:${user.value?.id}:${year}`)
function rememberRevealed() {
  try {
    localStorage.setItem(revealedKey.value, '1')
  } catch {
    // storage blocked (private mode etc.): just show the animation again next time
  }
}
function alreadyRevealed() {
  try {
    return localStorage.getItem(revealedKey.value) === '1'
  } catch {
    return false
  }
}

const isLink = (s) => /^https?:\/\//i.test(s ?? '')

// my_match() isn't in the database yet. This accepts one row or a one-row list, and the
// columns we expect (nickname/full_name or display_name, wish_1..3, link_1..3, notes).
// Adjust here once the real function's columns are known.
function normaliseMatch(data) {
  const r = Array.isArray(data) ? data[0] : data
  if (!r) return null
  return {
    name: r.display_name || r.nickname || r.full_name || r.name || 'Your match',
    fullName: r.nickname && r.full_name ? r.full_name : '',
    wishes: [1, 2, 3]
      .map((n) => ({ wish: r[`wish_${n}`], link: r[`link_${n}`] }))
      .filter((w) => w.wish)
      .map((w) => ({ ...w, link: isLink(w.link) ? w.link : null })),
    notes: r.notes || '',
  }
}

async function fetchMatch() {
  const { data, error: err } = await supabase.rpc('my_match')
  if (err) {
    // PGRST202 = function not found → the admin hasn't added my_match() yet
    if (err.code === 'PGRST202') notReady.value = true
    else error.value = err.message
    return
  }
  match.value = normaliseMatch(data)
  if (!match.value) error.value = "We couldn't find your match. Please ask the admin."
}

onMounted(async () => {
  const [row, draw] = await Promise.all([
    supabase.from('participants').select('id').eq('user_id', user.value.id).maybeSingle(),
    supabase.rpc('draw_done'),
  ])
  if (row.error || draw.error) error.value = (row.error || draw.error).message
  joined.value = !!row.data
  drawDone.value = draw.data === true

  // Coming back later: show the match straight away.
  if (joined.value && drawDone.value && alreadyRevealed()) {
    await fetchMatch()
    stage.value = 'revealed'
  }
  loading.value = false
})

async function reveal() {
  stage.value = 'shaking'
  error.value = ''
  // Fetch while the gift shakes; always shake for at least 2 seconds for the suspense.
  await Promise.all([fetchMatch(), new Promise((r) => setTimeout(r, 2000))])
  stage.value = 'revealed'
  if (match.value) rememberRevealed()
}
</script>

<template>
  <div class="relative min-h-dvh">
    <SnowBackground />

    <main class="relative mx-auto flex w-full max-w-xl flex-col gap-4 p-4 pb-10">
      <!-- Header panel -->
      <section
        class="relative overflow-hidden rounded-box bg-linear-to-br from-primary to-secondary p-6 text-primary-content shadow-xl motion-safe:animate-rise"
      >
        <span class="absolute top-5 right-8 text-xs text-accent" aria-hidden="true">✦</span>
        <span class="absolute right-6 bottom-5 text-base text-primary-content/40" aria-hidden="true"
          >❄</span
        >

        <RouterLink
          :to="{ name: 'dashboard' }"
          class="btn btn-circle btn-ghost btn-sm border-primary-content/40 text-primary-content hover:bg-primary-content/10"
          aria-label="Back to dashboard"
          >←</RouterLink
        >

        <div class="mt-4">
          <h1 class="text-3xl leading-tight font-bold">Draw my match</h1>
          <p class="font-medium text-accent">Exchange Gift {{ year }}</p>
          <p class="mt-2 text-sm text-primary-content/80">
            Your match is already chosen. Open your gift whenever you're ready, and keep it a
            secret! 🤫
          </p>
        </div>
      </section>

      <!-- Loading -->
      <div v-if="loading" class="skeleton h-80 rounded-box"></div>

      <!-- Not joined -->
      <section v-else-if="!joined" class="card bg-base-100 shadow-sm motion-safe:animate-rise">
        <div class="card-body items-center gap-3 text-center">
          <span class="text-5xl" aria-hidden="true">🙋</span>
          <h2 class="card-title text-secondary">You're not in the draw</h2>
          <p class="text-sm text-base-content/70">
            Only people who joined before the draw get a match.
          </p>
          <RouterLink :to="{ name: 'dashboard' }" class="btn btn-ghost btn-sm"
            >Back to dashboard</RouterLink
          >
        </div>
      </section>

      <!-- Draw not done yet -->
      <section v-else-if="!drawDone" class="card bg-base-100 shadow-sm motion-safe:animate-rise">
        <div class="card-body items-center gap-3 text-center">
          <span class="text-5xl" aria-hidden="true">🔒</span>
          <h2 class="card-title text-secondary">Not yet!</h2>
          <p class="text-sm text-base-content/70">
            The admin hasn't started the draw. Check back soon.
          </p>
          <RouterLink :to="{ name: 'dashboard' }" class="btn btn-ghost btn-sm"
            >Back to dashboard</RouterLink
          >
        </div>
      </section>

      <!-- Gift waiting / shaking -->
      <section
        v-else-if="stage !== 'revealed'"
        class="card bg-base-100 shadow-xl motion-safe:animate-rise"
      >
        <div class="card-body items-center gap-5 py-10 text-center">
          <button
            type="button"
            class="text-8xl transition-transform hover:scale-110 disabled:cursor-wait"
            :class="stage === 'shaking' ? 'motion-safe:animate-shake' : 'motion-safe:animate-float'"
            :disabled="stage === 'shaking'"
            aria-label="Open your gift"
            @click="reveal"
          >
            🎁
          </button>
          <div>
            <h2 class="text-xl font-bold text-secondary">
              {{ stage === 'shaking' ? 'Unwrapping…' : 'Your gift is waiting!' }}
            </h2>
            <p class="text-sm text-base-content/70">
              {{
                stage === 'shaking'
                  ? 'Santa is checking his list…'
                  : 'Tap the gift to see who you are buying for.'
              }}
            </p>
          </div>
          <button
            class="btn btn-primary btn-lg btn-wide"
            :disabled="stage === 'shaking'"
            @click="reveal"
          >
            <span v-if="stage === 'shaking'" class="loading loading-dots loading-md"></span>
            <template v-else>Open my gift ✨</template>
          </button>
        </div>
      </section>

      <!-- Revealed: database function not added yet (placeholder) -->
      <section
        v-else-if="notReady"
        class="card border-2 border-dashed border-accent bg-base-100 shadow-sm motion-safe:animate-rise"
      >
        <div class="card-body items-center gap-3 text-center">
          <span class="text-5xl" aria-hidden="true">🎅</span>
          <h2 class="card-title text-secondary">Almost there!</h2>
          <p class="text-sm text-base-content/70">
            Your match will appear here once the admin finishes setting up the reveal.
          </p>
          <span class="badge badge-accent badge-sm">Waiting for my_match()</span>
        </div>
      </section>

      <!-- Revealed: the match -->
      <template v-else-if="match">
        <section
          class="relative overflow-hidden rounded-box bg-linear-to-br from-primary to-secondary p-6 text-center text-primary-content shadow-xl motion-safe:animate-rise"
        >
          <span class="absolute top-4 left-6 text-accent" aria-hidden="true">✦</span>
          <span class="absolute top-8 right-8 text-sm text-accent" aria-hidden="true">✦</span>
          <span class="absolute bottom-4 left-10 text-xs text-primary-content/50" aria-hidden="true"
            >❄</span
          >
          <p class="text-sm text-primary-content/80">You're buying for</p>
          <h2 class="mt-1 text-4xl font-bold wrap-break-word">{{ match.name }} 🎉</h2>
          <p v-if="match.fullName" class="mt-1 font-medium text-accent">{{ match.fullName }}</p>
          <p class="mt-3 text-xs text-primary-content/70">Shh… keep it a secret! 🤫</p>
        </section>

        <section
          class="card bg-base-100 shadow-sm motion-safe:animate-rise [animation-delay:0.15s]"
        >
          <div class="card-body gap-3">
            <h2 class="card-title text-secondary">🎁 Their wish list</h2>
            <p v-if="!match.wishes.length" class="rounded-box bg-base-200 p-3 text-sm">
              🎁 No specific wishes. Surprise them! Check their notes below for hints.
            </p>
            <ol v-else class="flex flex-col gap-2">
              <li
                v-for="(item, i) in match.wishes"
                :key="i"
                class="flex items-center gap-3 rounded-box bg-base-200 p-3"
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

            <div v-if="match.notes" class="rounded-box bg-base-200 p-3 text-sm">
              <p class="font-medium text-secondary">📝 Notes for their Santa</p>
              <p class="mt-1 whitespace-pre-line wrap-break-word text-base-content/80">
                {{ match.notes }}
              </p>
            </div>
          </div>
        </section>
      </template>

      <div v-if="error" role="alert" class="alert alert-error">
        <span>{{ error }}</span>
      </div>
    </main>
  </div>
</template>
