<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { msToNextShanghaiMidnight } from '@/game/schedule'

const left = ref(msToNextShanghaiMidnight())
let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  timer = setInterval(() => (left.value = msToNextShanghaiMidnight()), 1000)
})
onUnmounted(() => clearInterval(timer))

const label = computed(() => {
  const s = Math.max(0, Math.floor(left.value / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(sec)}`
})
</script>

<template>
  <span class="countdown">距下一题 {{ label }}</span>
</template>

<style scoped>
.countdown {
  color: var(--c-text-light);
  font-variant-numeric: tabular-nums;
  font-size: 0.9rem;
}
</style>
