<script setup lang="ts">
// 胜利彩带：纯 CSS 粒子，无依赖
const COLORS = ['#0d828e', '#de7525', '#1d9c9c', '#f5c542', '#5ba554']
const pieces = Array.from({ length: 24 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  delay: `${(i % 8) * 0.12}s`,
  color: COLORS[i % COLORS.length],
  dur: `${2.4 + (i % 5) * 0.3}s`,
}))
</script>

<template>
  <div class="confetti" aria-hidden="true">
    <i
      v-for="(p, i) in pieces"
      :key="i"
      :style="{ left: p.left, animationDelay: p.delay, background: p.color, animationDuration: p.dur }"
    />
  </div>
</template>

<style scoped>
.confetti {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 50;
}
.confetti i {
  position: absolute;
  top: -1rem;
  width: 0.5rem;
  height: 0.9rem;
  animation-name: fall;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}
@keyframes fall {
  to {
    transform: translateY(110vh) rotate(540deg);
    opacity: 0.6;
  }
}
</style>
