<script setup>
// Admin tools: families, family assignments, and starting the draw.
// The router only lets the admin in, but that is display-only: RLS in the database is what
// actually allows these reads/writes (is_admin()).
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { supabase } from '@/supabase'
import SnowBackground from '@/components/SnowBackground.vue'

const year = new Date().getFullYear()
const MAX_FAMILY_NAME = 100

const loading = ref(true)
const error = ref('')
const notice = ref('') // short success message

const families = ref([])
const participants = ref([])
const drawDone = ref(false)

// ---------- Loading ----------
async function load() {
  const [fam, people, draw] = await Promise.all([
    supabase.from('family').select('id, name').order('name'),
    supabase
      .from('participants')
      .select('id, full_name, nickname, email, family_id, wish_1')
      .order('full_name'),
    supabase.rpc('draw_done'),
  ])
  const failed = fam.error || people.error || draw.error
  if (failed) error.value = failed.message
  families.value = fam.data ?? []
  participants.value = people.data ?? []
  drawDone.value = draw.data === true
  loading.value = false
}
onMounted(load)

function flash(message) {
  notice.value = message
  error.value = ''
  setTimeout(() => {
    if (notice.value === message) notice.value = ''
  }, 4000)
}

function friendlyError(err) {
  if (err.code === '23505') return 'A family with that name already exists.'
  if (err.code === '23514') return `Family names must be 1–${MAX_FAMILY_NAME} characters.`
  return err.message
}

// ---------- Draw checks (the database checks these again in run_draw()) ----------
const memberCount = computed(() => {
  const counts = {}
  for (const p of participants.value) {
    if (p.family_id) counts[p.family_id] = (counts[p.family_id] ?? 0) + 1
  }
  return counts
})

const biggestFamily = computed(() => {
  let best = null
  for (const f of families.value) {
    const n = memberCount.value[f.id] ?? 0
    if (!best || n > best.count) best = { name: f.name, count: n }
  }
  return best
})

const total = computed(() => participants.value.length)
const withoutFamily = computed(() => participants.value.filter((p) => !p.family_id).length)

const checks = computed(() => [
  {
    ok: total.value >= 3,
    text: `At least 3 participants (${total.value} joined)`,
  },
  {
    ok: !biggestFamily.value || biggestFamily.value.count * 2 <= total.value,
    text: biggestFamily.value?.count
      ? `No family is more than half of everyone (biggest: ${biggestFamily.value.name}, ${biggestFamily.value.count} of ${total.value})`
      : 'No family is more than half of everyone',
  },
])
const canDraw = computed(() => !drawDone.value && checks.value.every((c) => c.ok))

// ---------- Confirm dialog (daisyUI modal) ----------
const confirmDialog = ref(null)
const confirmState = ref({ title: '', body: '', label: '', danger: false, run: null })
const confirmBusy = ref(false)

function askConfirm(state) {
  confirmState.value = state
  confirmDialog.value.showModal()
}
async function runConfirmed() {
  confirmBusy.value = true
  await confirmState.value.run()
  confirmBusy.value = false
  confirmDialog.value.close()
}

// ---------- Start the draw ----------
function startDraw() {
  askConfirm({
    title: 'Start the draw? 🎲',
    body: `This matches all ${total.value} participants at once. After this, nobody can join or edit their wish list, and the draw can only be undone from the Supabase SQL Editor.`,
    label: 'Yes, start the draw',
    danger: false,
    run: async () => {
      const { data, error: err } = await supabase.rpc('run_draw')
      if (err) {
        error.value = err.message
        return
      }
      drawDone.value = true
      flash(`🎉 ${data ?? 'The draw is done!'}`)
    },
  })
}

// ---------- Families ----------
const newFamily = ref('')
const addingFamily = ref(false)

async function addFamily() {
  const name = newFamily.value.trim()
  if (!name) return
  addingFamily.value = true
  const { data, error: err } = await supabase.from('family').insert({ name }).select('id, name')
  addingFamily.value = false
  if (err) {
    error.value = friendlyError(err)
    return
  }
  families.value = [...families.value, ...data].sort((a, b) => a.name.localeCompare(b.name))
  newFamily.value = ''
  flash(`Added the ${name} family.`)
}

const editingId = ref(null)
const editingName = ref('')

function startRename(family) {
  editingId.value = family.id
  editingName.value = family.name
}

async function saveRename(family) {
  const name = editingName.value.trim()
  if (!name || name === family.name) {
    editingId.value = null
    return
  }
  const { error: err } = await supabase.from('family').update({ name }).eq('id', family.id)
  if (err) {
    error.value = friendlyError(err)
    return
  }
  family.name = name
  families.value.sort((a, b) => a.name.localeCompare(b.name))
  editingId.value = null
  flash('Family renamed.')
}

function deleteFamily(family) {
  const n = memberCount.value[family.id] ?? 0
  askConfirm({
    title: `Delete the ${family.name} family?`,
    body: n
      ? `${n} ${n === 1 ? 'person is' : 'people are'} in this family. They'll be kept, just without a family.`
      : 'Nobody is in this family yet.',
    label: 'Delete family',
    danger: true,
    run: async () => {
      const { error: err } = await supabase.from('family').delete().eq('id', family.id)
      if (err) {
        error.value = friendlyError(err)
        return
      }
      families.value = families.value.filter((f) => f.id !== family.id)
      for (const p of participants.value) if (p.family_id === family.id) p.family_id = null
      flash(`Deleted the ${family.name} family.`)
    },
  })
}

// ---------- Assign people to families ----------
const savingPerson = ref(null)

async function setFamily(person, value) {
  const familyId = value ? Number(value) : null
  const previous = person.family_id
  person.family_id = familyId // update the screen right away
  savingPerson.value = person.id
  // Only family_id is sent.
  const { data, error: err } = await supabase
    .from('participants')
    .update({ family_id: familyId })
    .eq('id', person.id)
    .select('id')
  savingPerson.value = null
  if (err || !data?.length) {
    person.family_id = previous
    error.value = err ? err.message : "Couldn't save. Are you still signed in as the admin?"
  }
}

const displayName = (p) => (p.nickname ? `${p.nickname} (${p.full_name})` : p.full_name)
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
          >🛠️</span
        >

        <RouterLink
          :to="{ name: 'dashboard' }"
          class="btn btn-circle btn-ghost btn-sm border-primary-content/40 text-primary-content hover:bg-primary-content/10"
          aria-label="Back to dashboard"
          >←</RouterLink
        >

        <div class="mt-4 pr-20">
          <h1 class="text-3xl leading-tight font-bold">Admin tools</h1>
          <p class="font-medium text-accent">Exchange Gift {{ year }}</p>
          <p class="mt-2 text-sm text-primary-content/80">
            Group siblings into families so they can't draw each other, then start the draw.
          </p>
        </div>
      </section>

      <!-- Messages -->
      <div v-if="notice" role="status" class="alert alert-success shadow-sm">
        <span>{{ notice }}</span>
      </div>
      <div v-if="error" role="alert" class="alert alert-error">
        <span>{{ error }}</span>
        <button class="btn btn-ghost btn-xs" aria-label="Dismiss" @click="error = ''">✕</button>
      </div>

      <template v-if="loading">
        <div class="skeleton h-48 rounded-box"></div>
        <div class="skeleton h-48 rounded-box"></div>
        <div class="skeleton h-64 rounded-box"></div>
      </template>

      <template v-else>
        <!-- Stats -->
        <section class="stats w-full bg-base-100 shadow-sm motion-safe:animate-rise">
          <div class="stat place-items-center px-2">
            <div class="stat-title">Joined</div>
            <div class="stat-value text-primary">{{ total }}</div>
          </div>
          <div class="stat place-items-center px-2">
            <div class="stat-title">Families</div>
            <div class="stat-value text-secondary">{{ families.length }}</div>
          </div>
          <div class="stat place-items-center px-2">
            <div class="stat-title">No family</div>
            <div class="stat-value text-base-content/60">{{ withoutFamily }}</div>
          </div>
        </section>

        <!-- 1. Families -->
        <section class="card bg-base-100 shadow-sm motion-safe:animate-rise [animation-delay:0.1s]">
          <div class="card-body gap-3">
            <h2 class="card-title text-secondary">👨‍👩‍👧 Families</h2>
            <p class="text-sm text-base-content/70">
              People in the same family won't be matched with each other. Only add a family for
              siblings or households that shouldn't draw each other.
            </p>

            <form class="join w-full" @submit.prevent="addFamily">
              <input
                v-model="newFamily"
                class="input join-item w-full"
                :maxlength="MAX_FAMILY_NAME"
                placeholder="New family name, e.g. Bautista"
                :disabled="addingFamily"
              />
              <button
                class="btn btn-primary join-item"
                :disabled="!newFamily.trim() || addingFamily"
              >
                <span v-if="addingFamily" class="loading loading-spinner loading-xs"></span>
                Add
              </button>
            </form>

            <p v-if="!families.length" class="text-sm text-base-content/60 italic">
              No families yet.
            </p>

            <ul v-else class="flex flex-col gap-2">
              <li
                v-for="family in families"
                :key="family.id"
                class="flex items-center gap-2 rounded-box bg-base-200 p-2 pl-3"
              >
                <template v-if="editingId === family.id">
                  <input
                    v-model="editingName"
                    class="input input-sm min-w-0 flex-1"
                    :maxlength="MAX_FAMILY_NAME"
                    aria-label="Family name"
                    @keyup.enter="saveRename(family)"
                    @keyup.esc="editingId = null"
                  />
                  <button class="btn btn-primary btn-sm" @click="saveRename(family)">Save</button>
                  <button class="btn btn-ghost btn-sm" @click="editingId = null">Cancel</button>
                </template>
                <template v-else>
                  <span class="min-w-0 flex-1 font-medium wrap-break-word">{{ family.name }}</span>
                  <span class="badge badge-ghost badge-sm shrink-0">
                    {{ memberCount[family.id] ?? 0 }}
                    {{ (memberCount[family.id] ?? 0) === 1 ? 'person' : 'people' }}
                  </span>
                  <button
                    class="btn btn-ghost btn-sm btn-square"
                    aria-label="Rename family"
                    @click="startRename(family)"
                  >
                    ✏️
                  </button>
                  <button
                    class="btn btn-ghost btn-sm btn-square"
                    aria-label="Delete family"
                    @click="deleteFamily(family)"
                  >
                    🗑️
                  </button>
                </template>
              </li>
            </ul>
          </div>
        </section>

        <!-- 2. Participants -->
        <section class="card bg-base-100 shadow-sm motion-safe:animate-rise [animation-delay:0.2s]">
          <div class="card-body gap-3">
            <h2 class="card-title text-secondary">🙋 Participants</h2>
            <p class="text-sm text-base-content/70">
              Choose a family for each person. Changes save automatically.
            </p>

            <p v-if="!participants.length" class="text-sm text-base-content/60 italic">
              Nobody has joined yet.
            </p>

            <ul v-else class="flex flex-col gap-2">
              <li
                v-for="person in participants"
                :key="person.id"
                class="flex flex-col gap-2 rounded-box bg-base-200 p-3"
              >
                <div class="min-w-0">
                  <p class="font-medium wrap-break-word">{{ displayName(person) }}</p>
                  <p class="text-xs break-all text-base-content/60">{{ person.email }}</p>
                </div>
                <div class="flex items-center gap-2">
                  <select
                    class="select select-sm w-full"
                    :value="person.family_id ?? ''"
                    :disabled="drawDone || savingPerson === person.id"
                    :aria-label="`Family for ${person.full_name}`"
                    @change="setFamily(person, $event.target.value)"
                  >
                    <option value="">No family</option>
                    <option v-for="family in families" :key="family.id" :value="family.id">
                      {{ family.name }}
                    </option>
                  </select>
                  <span
                    v-if="savingPerson === person.id"
                    class="loading loading-spinner loading-xs shrink-0"
                  ></span>
                </div>
              </li>
            </ul>
            <p v-if="drawDone" class="text-xs text-base-content/60">
              🔒 Families are locked because the draw is done.
            </p>
          </div>
        </section>

        <!-- 3. The draw -->
        <section
          class="card border-2 bg-base-100 shadow-sm motion-safe:animate-rise [animation-delay:0.3s]"
          :class="drawDone ? 'border-success' : 'border-primary'"
        >
          <div class="card-body gap-3">
            <h2 class="card-title text-secondary">🎲 The draw</h2>

            <template v-if="drawDone">
              <p class="text-sm">
                ✅ <span class="font-semibold">The draw is done.</span> Everyone can now open the
                Draw page to see their match.
              </p>
              <p class="text-xs text-base-content/60">
                To redo it, clear the draw in the Supabase SQL Editor first.
              </p>
            </template>

            <template v-else>
              <ul class="flex flex-col gap-1 text-sm">
                <li v-for="check in checks" :key="check.text" class="flex gap-2">
                  <span aria-hidden="true">{{ check.ok ? '✅' : '❌' }}</span>
                  <span :class="{ 'text-error': !check.ok }">{{ check.text }}</span>
                </li>
                <li v-if="withoutFamily" class="flex gap-2 text-base-content/70">
                  <span aria-hidden="true">ℹ️</span>
                  <span>
                    {{ withoutFamily }} {{ withoutFamily === 1 ? 'person has' : 'people have' }}
                    no family. That's fine: they can be matched with anyone.
                  </span>
                </li>
              </ul>
              <button
                class="btn btn-primary btn-lg btn-block"
                :disabled="!canDraw"
                @click="startDraw"
              >
                🎲 Start the draw
              </button>
              <p class="text-xs text-base-content/60">
                After the draw, nobody can join or change their wish list.
              </p>
            </template>
          </div>
        </section>
      </template>
    </main>

    <!-- Confirm dialog -->
    <dialog ref="confirmDialog" class="modal modal-bottom sm:modal-middle">
      <div class="modal-box">
        <h3 class="text-lg font-bold text-secondary">{{ confirmState.title }}</h3>
        <p class="py-3 text-sm">{{ confirmState.body }}</p>
        <div class="modal-action">
          <form method="dialog">
            <button class="btn btn-ghost" :disabled="confirmBusy">Cancel</button>
          </form>
          <button
            class="btn"
            :class="confirmState.danger ? 'btn-error' : 'btn-primary'"
            :disabled="confirmBusy"
            @click="runConfirmed"
          >
            <span v-if="confirmBusy" class="loading loading-spinner loading-sm"></span>
            {{ confirmState.label }}
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button :disabled="confirmBusy">close</button>
      </form>
    </dialog>
  </div>
</template>
