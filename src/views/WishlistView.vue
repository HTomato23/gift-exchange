<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { supabase } from '@/supabase'
import { user } from '@/auth'
import SnowBackground from '@/components/SnowBackground.vue'

const router = useRouter()
const year = new Date().getFullYear()

// Same limits as the database checks (see gift-exchange-setup.sql).
const MAX = { fullName: 100, nickname: 50, wish: 200, notes: 200 }
const LINK_RE = /^https?:\/\/\S+$/i

const loading = ref(true)
const saving = ref(false)
const submitted = ref(false) // only show field errors after the first save attempt
const error = ref('')
const participant = ref(null) // existing row, or null if the user hasn't joined yet
const drawDone = ref(false)

const form = reactive({
  fullName: '',
  nickname: '',
  wishes: [
    { wish: '', link: '' },
    { wish: '', link: '' },
    { wish: '', link: '' },
  ],
  notes: '',
})

const isNew = computed(() => !participant.value)
const locked = computed(() => drawDone.value) // nobody can join or edit after the draw

const errors = computed(() => {
  const e = {}
  const fullName = form.fullName.trim()
  if (!fullName) e.fullName = 'Please enter your full name.'
  else if (fullName.length > MAX.fullName) e.fullName = `Max ${MAX.fullName} characters.`
  if (form.nickname.trim().length > MAX.nickname) e.nickname = `Max ${MAX.nickname} characters.`

  form.wishes.forEach((w, i) => {
    const wish = w.wish.trim()
    const link = w.link.trim()
    // All wishes are optional (people can choose "Surprise me!" in the notes instead).
    if (wish.length > MAX.wish) e[`wish${i}`] = `Max ${MAX.wish} characters.`
    else if (link && !wish) e[`wish${i}`] = 'Add a wish for this link.'
    if (link && !LINK_RE.test(link)) e[`link${i}`] = 'Links must start with http:// or https://'
  })

  if (form.notes.trim().length > MAX.notes) e.notes = `Max ${MAX.notes} characters.`
  return e
})

// "Surprise me!" quick option: adds or removes the phrase at the start of the notes.
const SURPRISE = 'Surprise me!'
const SURPRISE_RE = /surprise me!?\s*/i
const hasSurprise = computed(() => SURPRISE_RE.test(form.notes))
function toggleSurprise() {
  const rest = form.notes.replace(SURPRISE_RE, '').trim()
  form.notes = hasSurprise.value ? rest : `${SURPRISE} ${rest}`.trim().slice(0, MAX.notes)
}
const noWishes = computed(() => form.wishes.every((w) => !w.wish.trim()))

const hasErrors = computed(() => Object.keys(errors.value).length > 0)
const show = (key) => submitted.value && errors.value[key]

onMounted(async () => {
  const [row, draw] = await Promise.all([
    supabase.from('participants').select('*').eq('user_id', user.value.id).maybeSingle(),
    supabase.rpc('draw_done'),
  ])
  if (row.error || draw.error) error.value = (row.error || draw.error).message
  drawDone.value = draw.data === true

  const p = row.data
  participant.value = p ?? null
  if (p) {
    form.fullName = p.full_name ?? ''
    form.nickname = p.nickname ?? ''
    form.notes = p.notes ?? ''
    form.wishes.forEach((w, i) => {
      w.wish = p[`wish_${i + 1}`] ?? ''
      w.link = p[`link_${i + 1}`] ?? ''
    })
  } else {
    // New participant: start with the name from their Google account.
    form.fullName = user.value?.user_metadata?.full_name ?? ''
  }
  loading.value = false
})

// Only these columns are ever sent. Never email, user_id or family_id.
function buildPayload() {
  const clean = (s) => s.trim() || null
  const payload = {
    full_name: form.fullName.trim(),
    nickname: clean(form.nickname),
    notes: clean(form.notes),
  }
  form.wishes.forEach((w, i) => {
    payload[`wish_${i + 1}`] = clean(w.wish)
    payload[`link_${i + 1}`] = clean(w.link)
  })
  return payload
}

async function save() {
  submitted.value = true
  error.value = ''
  if (hasErrors.value || locked.value) return

  saving.value = true
  const payload = buildPayload()
  const { data, error: err } = isNew.value
    ? await supabase.from('participants').insert(payload).select('id')
    : await supabase
        .from('participants')
        .update(payload)
        .eq('id', participant.value.id)
        .select('id')
  saving.value = false

  // RLS blocks inserts with an error, but blocked updates just change 0 rows.
  if (err?.code === '42501' || (!err && !data?.length)) {
    drawDone.value = true
    error.value = "The draw has already been made, so wish lists can't be changed anymore."
    return
  }
  if (err?.code === '23514') {
    error.value = 'Something is too long or a link is invalid. Please check the form.'
    return
  }
  if (err) {
    error.value = err.message
    return
  }

  router.push({ name: 'dashboard', query: { saved: '1' } })
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
        <span
          class="absolute right-4 -bottom-3 text-7xl opacity-90 motion-safe:animate-float"
          aria-hidden="true"
          >📝</span
        >

        <RouterLink
          :to="{ name: 'dashboard' }"
          class="btn btn-circle btn-ghost btn-sm border-primary-content/40 text-primary-content hover:bg-primary-content/10"
          aria-label="Back to dashboard"
          >←</RouterLink
        >

        <div class="mt-4 pr-20">
          <h1 class="text-3xl leading-tight font-bold">
            {{ isNew ? 'Join the exchange' : 'My wish list' }}
          </h1>
          <p class="font-medium text-accent">Exchange Gift {{ year }}</p>
          <p class="mt-2 text-sm text-primary-content/80">
            Tell your Secret Santa what would make you smile. Add up to three wishes, with links if
            you have them.
          </p>
        </div>
      </section>

      <!-- Loading -->
      <template v-if="loading">
        <div class="skeleton h-40 rounded-box"></div>
        <div class="skeleton h-72 rounded-box"></div>
      </template>

      <!-- Draw done and never joined: sign-ups are closed -->
      <div v-else-if="isNew && locked" role="alert" class="alert alert-warning alert-soft">
        <span>
          Sign-ups are closed 🔒 The draw has already been made, so new people can't join this year.
        </span>
      </div>

      <form v-else class="flex flex-col gap-4" novalidate @submit.prevent="save">
        <div v-if="locked" role="alert" class="alert alert-info alert-soft">
          <span>🔒 The draw is done, so your wish list is locked. Here's what you sent.</span>
        </div>

        <!-- Disables every input at once after the draw -->
        <fieldset :disabled="locked || saving" class="flex flex-col gap-4">
          <!-- About you -->
          <section
            class="card bg-base-100 shadow-sm motion-safe:animate-rise [animation-delay:0.1s]"
          >
            <div class="card-body gap-1">
              <h2 class="card-title text-secondary">🙋 About you</h2>

              <fieldset class="fieldset">
                <legend class="fieldset-legend">Full name *</legend>
                <input
                  v-model="form.fullName"
                  type="text"
                  class="input w-full"
                  :class="{ 'input-error': show('fullName') }"
                  :maxlength="MAX.fullName"
                  autocomplete="name"
                  placeholder="e.g. Juan Dela Cruz"
                />
                <p v-if="show('fullName')" class="label text-error">{{ errors.fullName }}</p>
              </fieldset>

              <fieldset class="fieldset">
                <legend class="fieldset-legend">
                  Nickname <span class="font-normal">(optional)</span>
                </legend>
                <input
                  v-model="form.nickname"
                  type="text"
                  class="input w-full"
                  :class="{ 'input-error': show('nickname') }"
                  :maxlength="MAX.nickname"
                  autocomplete="nickname"
                  placeholder="What the family calls you"
                />
                <p v-if="show('nickname')" class="label text-error">{{ errors.nickname }}</p>
              </fieldset>
            </div>
          </section>

          <!-- Wishes -->
          <section
            class="card bg-base-100 shadow-sm motion-safe:animate-rise [animation-delay:0.2s]"
          >
            <div class="card-body gap-3">
              <h2 class="card-title text-secondary">🎁 My wishes</h2>
              <p class="text-sm text-base-content/70">
                All wishes are optional. Not sure what you want? Leave them empty and choose
                <span class="font-medium">Surprise me!</span> in the notes below. Links must start
                with <code>https://</code>.
              </p>

              <div
                v-for="(w, i) in form.wishes"
                :key="i"
                class="flex flex-col gap-2 rounded-box bg-base-200 p-3"
              >
                <div class="flex items-center gap-2">
                  <span class="badge badge-primary badge-sm">{{ i + 1 }}</span>
                  <span class="text-sm font-medium">
                    Wish {{ i + 1 }}
                    <span class="font-normal text-base-content/60">(optional)</span>
                  </span>
                  <span class="ml-auto text-xs text-base-content/50">
                    {{ w.wish.length }}/{{ MAX.wish }}
                  </span>
                </div>

                <input
                  v-model="w.wish"
                  type="text"
                  class="input w-full"
                  :class="{ 'input-error': show(`wish${i}`) }"
                  :maxlength="MAX.wish"
                  :placeholder="['e.g. A cozy hoodie', 'e.g. A good book', 'e.g. Chocolates'][i]"
                />
                <p v-if="show(`wish${i}`)" class="text-xs text-error">{{ errors[`wish${i}`] }}</p>

                <label class="input w-full" :class="{ 'input-error': show(`link${i}`) }">
                  <span aria-hidden="true">🔗</span>
                  <input
                    v-model="w.link"
                    type="url"
                    inputmode="url"
                    class="grow"
                    placeholder="https://… (optional)"
                    autocapitalize="off"
                    autocomplete="off"
                    spellcheck="false"
                  />
                </label>
                <p v-if="show(`link${i}`)" class="text-xs text-error">{{ errors[`link${i}`] }}</p>
              </div>
            </div>
          </section>

          <!-- Notes for your Santa -->
          <section
            class="card bg-base-100 shadow-sm motion-safe:animate-rise [animation-delay:0.3s]"
          >
            <div class="card-body gap-1">
              <h2 class="card-title text-secondary">📝 Notes for your Santa</h2>
              <fieldset class="fieldset">
                <legend class="fieldset-legend">
                  Sizes, favorite colors, things to avoid…
                  <span class="font-normal">(optional)</span>
                </legend>
                <!-- Quick option for people without specific wishes -->
                <button
                  type="button"
                  class="btn btn-sm mb-1 w-fit"
                  :class="hasSurprise ? 'btn-accent' : 'btn-outline btn-accent'"
                  :aria-pressed="hasSurprise"
                  @click="toggleSurprise"
                >
                  {{ hasSurprise ? '✓ Surprise me!' : '🎁 Surprise me!' }}
                </button>
                <textarea
                  v-model="form.notes"
                  class="textarea w-full"
                  :class="{ 'textarea-error': show('notes') }"
                  :maxlength="MAX.notes"
                  rows="3"
                  placeholder="e.g. Shirt M, shoes US 9. I love dark chocolate. No perfume please!"
                ></textarea>
                <p v-if="noWishes && !form.notes.trim()" class="text-xs text-base-content/70">
                  💡 No wishes yet? Tap <span class="font-medium">Surprise me!</span> or add a few
                  hints so your Santa has something to go on.
                </p>
                <p class="label" :class="{ 'text-error': show('notes') }">
                  {{ show('notes') ? errors.notes : `${form.notes.length}/${MAX.notes}` }}
                </p>
              </fieldset>
            </div>
          </section>
        </fieldset>

        <div v-if="error" role="alert" class="alert alert-error">
          <span>{{ error }}</span>
        </div>
        <div v-if="submitted && hasErrors" role="alert" class="alert alert-warning alert-soft">
          <span>Please fix the highlighted fields.</span>
        </div>

        <!-- Save button stays reachable at the bottom of the screen on phones -->
        <div v-if="!locked" class="sticky bottom-4 z-10">
          <button
            type="submit"
            class="btn btn-primary btn-lg btn-block shadow-lg"
            :disabled="saving"
          >
            <span v-if="saving" class="loading loading-spinner loading-sm"></span>
            {{ isNew ? 'Join & save my wishes 🎄' : 'Save changes' }}
          </button>
        </div>
      </form>
    </main>
  </div>
</template>
