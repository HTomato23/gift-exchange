<script setup>
// Public privacy policy (no sign-in needed). Google requires its URL to publish the sign-in app.
// Keep this text in sync with what the site actually collects and who can see it.
import { RouterLink } from 'vue-router'
import SnowBackground from '@/components/SnowBackground.vue'
import { EVENT } from '@/event'

const LAST_UPDATED = 'November 2, 2026'

const sections = [
  {
    icon: '🔐',
    title: 'What we collect',
    items: [
      'When you sign in with Google, we receive your name, email address and profile photo from your Google account. We never see or store your Google password.',
      'When you join, we store what you type in the form: your full name, nickname, up to three wishes with optional links, and your notes for your Santa.',
      'The organizer may add you to a family group so that siblings are not matched with each other.',
      'After the draw, we store who is giving a gift to whom.',
    ],
  },
  {
    icon: '👀',
    title: 'Who can see your information',
    items: [
      'You can see and edit your own details until the draw is made.',
      'After the draw, the person who drew you (your Secret Santa) can see your name, wishes, links and notes. They cannot see your email address.',
      'The organizer (admin) can see everyone’s details, including email addresses, family groups and who was matched with whom, to run the exchange.',
      'Other participants cannot see your details.',
    ],
  },
  {
    icon: '🎯',
    title: 'How we use it',
    items: [
      'Only to run this family gift exchange: signing you in, matching participants, and showing your Secret Santa what you would like.',
      'We do not sell, rent or share your information with anyone, and we do not use it for advertising.',
      'We do not use analytics or tracking tools.',
    ],
  },
  {
    icon: '🗄️',
    title: 'Where it is stored',
    items: [
      'Your sign-in and gift exchange details are stored with Supabase, our database and sign-in provider. Access is protected by security rules so each person only reaches what they are allowed to see.',
      'The website is hosted on Vercel, which may keep standard technical logs (such as IP addresses) to run and protect the site.',
      'Your browser keeps you signed in and remembers on your device whether you already revealed your match. You can clear this by signing out or clearing your browser data.',
    ],
  },
  {
    icon: '🧹',
    title: 'Keeping and deleting your information',
    items: [
      'Your details are kept for this year’s gift exchange. The organizer may clear them after the event.',
      'You can ask the organizer to delete your information at any time using the contact below.',
    ],
  },
]
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
          >🛡️</span
        >

        <!-- "/" sends signed-in people on to the dashboard automatically -->
        <RouterLink
          to="/"
          class="btn btn-circle btn-ghost btn-sm border-primary-content/40 text-primary-content hover:bg-primary-content/10"
          aria-label="Back"
          >←</RouterLink
        >

        <div class="mt-4 pr-20">
          <h1 class="text-3xl leading-tight font-bold">Privacy Policy</h1>
          <p class="font-medium text-accent">Exchange Gift</p>
          <p class="mt-2 text-sm text-primary-content/80">
            This is a private gift exchange for our family and friends. Here is what we keep about
            you and why, in plain words.
          </p>
        </div>
      </section>

      <section
        v-for="(section, i) in sections"
        :key="section.title"
        class="card bg-base-100 shadow-sm motion-safe:animate-rise"
        :style="{ animationDelay: `${0.08 * (i + 1)}s` }"
      >
        <div class="card-body gap-2">
          <h2 class="card-title text-secondary">
            <span aria-hidden="true">{{ section.icon }}</span> {{ section.title }}
          </h2>
          <ul class="list-disc space-y-1.5 pl-5 text-sm text-base-content/80">
            <li v-for="item in section.items" :key="item">{{ item }}</li>
          </ul>
        </div>
      </section>

      <section class="card bg-base-100 shadow-sm motion-safe:animate-rise [animation-delay:0.5s]">
        <div class="card-body gap-2">
          <h2 class="card-title text-secondary"><span aria-hidden="true">💌</span> Contact</h2>
          <p class="text-sm text-base-content/80">
            Questions, or want your information removed? Email the organizer at
            <a
              :href="`mailto:${EVENT.contactEmail}`"
              class="link font-medium break-all link-primary"
              >{{ EVENT.contactEmail }}</a
            >.
          </p>
          <p class="text-xs text-base-content/60">
            We may update this page if the website changes. Last updated: {{ LAST_UPDATED }}.
          </p>
        </div>
      </section>
    </main>
  </div>
</template>
