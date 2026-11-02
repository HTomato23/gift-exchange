# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A gift-exchange (Secret Santa) website for the owner's friends and family. Frontend only: Vue 3 + Supabase. Most users open it on their phones.

**The Supabase database already exists and is managed by the owner. Never write migrations, SQL, or change the database — only build the frontend.** The owner starts the draw from the `/admin` page (`run_draw()`), or in the Supabase SQL Editor. Resetting the draw is SQL Editor only (no delete policy on `assignments`).

The owner builds this step by step: build only the pages they ask for, then stop so they can test.

Current state: six pages, no header. `/` → `src/views/LandingView.vue` (centered card with Google sign-in; signed-in users go to `/dashboard`). `/dashboard` → `src/views/DashboardView.vue` (greeting, Draw button card — locked until `draw_done()`, info tiles, own wish list, admin tools link; green saved message after `?saved=1`, auto-hides after 5 s). `/wishlist` → `src/views/WishlistView.vue` (join / edit own participants row: name, nickname, 3 wishes + links, notes; read-only after the draw). `/draw` → `src/views/DrawView.vue` (tap-to-reveal gift, then "You're buying for…" with the receiver's wishes, links, notes). `/admin` → `src/views/AdminView.vue` (admin only, `meta.requiresAdmin` checks `is_admin()`: add/rename/delete families, set each participant's `family_id` (sends only `family_id`), pre-draw checks, start the draw via `run_draw()` with a confirm modal; after the draw, a "Who's buying for whom" card that reads `assignments` only when the admin taps Show, listed in loop order). `/privacy` → `src/views/PrivacyView.vue` (public privacy policy, required by Google to publish the OAuth app; keep it in sync with what the site collects; contact email = `EVENT.contactEmail`). Shared `src/components/SnowBackground.vue`.

## Commands

- `npm run dev` — dev server at http://localhost:5173 (the URL registered for OAuth redirects)
- `npm run build` / `npm run preview` — production build to `dist/`
- `npm run lint` — Oxlint then ESLint; **both run with `--fix` and modify files**
- `npm run format` — Prettier over `src/`

No test runner is installed.

## Deployment

Static site (`dist/`). `.env` values are baked in at build time, so build with the right `.env`, or set `VITE_SUPABASE_URL` / `VITE_SUPABASE_KEY` in the host's settings if it builds for you. Routes use `createWebHistory`, so the host must serve `index.html` for every path: `public/_redirects` (Netlify, Cloudflare Pages) and `vercel.json` (Vercel) do this. The deployed URL must be in Supabase → Authentication → URL Configuration (Site URL + Redirect URLs).

## Stack

- Vue 3 (`<script setup>`, Composition API), JavaScript only — no TypeScript
- Vue Router (`src/router/index.js`, `createWebHistory`); `@` aliases to `src/`
- Tailwind CSS v4 via `@tailwindcss/vite` + daisyUI v5. **No `tailwind.config.js`** — all config lives in `src/assets/main.css` (`@import "tailwindcss"; @plugin "daisyui";` plus a custom theme block)
- `@supabase/supabase-js`
- Vue stable 3.5.x. Node `^22.22.2 || ^24.15.0 || >=26.0.0` (the lint tooling requires these).
- `overrides` in `package.json` forces `minimatch` ^11.0.3 to patch a security advisory in ESLint's dependency tree. Don't run `npm audit fix --force`: it downgrades ESLint.

## Code layout

- `src/supabase.js` — the single Supabase client. Reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_KEY` from `.env` and throws if the key is a secret/service_role key.
- `src/event.js` — `EVENT` settings (gift amount + `giftAmountNote` / `giftAmountExtra`, event date text, location, `extra` line e.g. "Potluck 🍲", `countdownTo` month/day for the dashboard countdown) shown on the dashboard tiles; edited by hand (not in the DB).
- `src/auth.js` — shared auth state (`session`, `user`, `authReady`, `whenAuthReady` promise) and `signInWithGoogle()` / `signOut()`. Use these rather than calling `supabase.auth` from components.
- `src/App.vue` — layout shell (`bg-base-200` + `<RouterView />`, no header). Also watches `user` and redirects on sign-in/sign-out.
- `src/router/index.js` — routes use `meta.requiresAuth` / `meta.guestOnly` / `meta.requiresAdmin`; a `beforeEach` guard awaits `whenAuthReady` before redirecting; `meta.requiresAdmin` also calls `is_admin()`.

## Styling rules

- Use daisyUI components/classes (`btn`, `card`, `input`, `textarea`, `select`, `table`, `alert`, `navbar`, `badge`, `modal`, `loading`, …) instead of custom CSS. Use Tailwind utilities only for layout/spacing.
- Theme: the custom `festive` theme in `main.css` — white and green, based on `src/assets/images/image.jpg` (forest green `primary`, deep pine `secondary`, gold `accent`, Christmas red `error`, white `base-100` on mint-white `base-200`; very rounded cards, pill buttons). It's forced with `data-theme="festive"` on `<html>` in `index.html`, so OS dark mode doesn't switch themes.
- Mobile-first: the content column is `max-w-xl` and must work at phone width.

## Auth

- Google sign-in only: `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })`.
- Only the publishable/anon key may be used in the frontend. `.env` is gitignored; `.env.example` is the committed template.

## Database (read-only reference)

Full schema, RLS policies, trigger and functions: `gift-exchange-setup.sql` in the project root (the owner's setup script, kept up to date with the live database; reference only — never run it. **Section 0 drops all tables and functions, so running it deletes all data.** Gitignored.).

**family**: `id` bigint, `name` text unique (1–100 chars), `created_at`. A family = a sibling set; people in the same family can't draw each other.

**participants**: one row per user
- `id` uuid, `user_id` uuid unique (defaults to `auth.uid()`)
- `email` — filled in by the `participants_before_write` trigger from the Google login
- `full_name` (required, 1–100 chars after trim), `nickname` (optional, ≤ 50)
- `family_id` bigint → family (optional; **admin-only** — the trigger ignores it from non-admins)
- `wish_1`, `link_1`, `wish_2`, `link_2`, `wish_3`, `link_3` — **all optional** (wishes ≤ 200). People with no wishes can tap "Surprise me!", which adds that text to `notes`.
- `notes` (optional, ≤ 200 — sizes, likes, things to avoid), `created_at` / `updated_at` (automatic)
- Links must match `^https?://`, or the DB rejects the row. Validate this and the length limits in forms too.
- **When a user signs up, the frontend must NOT send `email`, `user_id`, or `family_id`.**
- Users cannot delete their own row (admin only).

**assignments**: `giver_id` → `participants.id`, `receiver_id` → `participants.id` (each unique), `created_at`. Draw results; only the admin can read them. Participants see their match **in the app** on `/draw` (no emails). Everyone can reveal on a different day — the matches are fixed when the admin runs `run_draw()`; revealing only reads them.

RPC functions (`supabase.rpc(...)`, all require sign-in):
- `is_admin()` → boolean (compares the JWT email to the admin email)
- `draw_done()` → boolean (true once any assignment exists)
- `my_match()` → the signed-in user's receiver: one row (or none) with `nickname`, `full_name`, `wish_1..3`, `link_1..3`, `notes`. No arguments; never returns email, family_id, or anyone else's match (the privacy policy promises this). Used by `/draw`; `normaliseMatch()` in `DrawView.vue` reads it.
- `run_draw()` → text — admin only; shuffles everyone into one loop with no same-family pairs. Fails if < 3 participants, a family is more than half of everyone, or the draw was already run. Called from the `/admin` page.

## Security rules (enforced by RLS in the database)

- A normal user can only read, insert, and update their **own** participants row.
- Once `draw_done()` is true nobody can **sign up** or **edit** their row — show it read-only in the UI and hide/disable "join".
- Only the admin can read all participants, edit/delete any row, manage families, set `family_id`, read assignments, and run the draw.
- Admin email: bautistalanz0423@gmail.com. In the UI, decide admin status with `is_admin()`, never by comparing emails. UI checks are only for display; the real protection is RLS.
