<script setup>
// Decorative falling snow behind the page content. Fixed positions so the layout is stable.
// Page content placed after this component should be `relative` so it sits on top.
const snowflakes = [
  { left: 4, size: 14, duration: 13, delay: -2 },
  { left: 12, size: 10, duration: 16, delay: -9 },
  { left: 21, size: 18, duration: 11, delay: -5 },
  { left: 30, size: 12, duration: 15, delay: -12 },
  { left: 39, size: 9, duration: 18, delay: -3 },
  { left: 48, size: 16, duration: 12, delay: -7 },
  { left: 57, size: 11, duration: 17, delay: -14 },
  { left: 66, size: 15, duration: 13, delay: -1 },
  { left: 75, size: 10, duration: 16, delay: -10 },
  { left: 84, size: 17, duration: 12, delay: -6 },
  { left: 92, size: 12, duration: 15, delay: -11 },
  { left: 97, size: 9, duration: 19, delay: -4 },
]
</script>

<template>
  <div class="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
    <span
      v-for="(flake, i) in snowflakes"
      :key="i"
      class="absolute -top-8 text-primary/25 motion-safe:animate-snowfall"
      :style="{
        left: `${flake.left}%`,
        fontSize: `${flake.size}px`,
        animationDuration: `${flake.duration}s`,
        animationDelay: `${flake.delay}s`,
      }"
      >❄</span
    >
  </div>
</template>
