<script setup lang="ts">
import { computed } from 'vue'
import { judgeWord } from '@/game/match'

/**
 * 字块行——答题页棋盘与首页示例共用的唯一渲染。
 * 传 answer = 揭示行（逐字着色 + 3D 翻转）；不传 = 活动输入行（素块）。
 */
const props = withDefaults(defineProps<{
  word: string
  answer?: string
  /** 方框数量（活动行需要，默认 = word 长度） */
  len?: number
  animate?: boolean
}>(), { animate: true })

const count = computed(() => props.len ?? Array.from(props.word).length)
const chars = computed(() => {
  const arr = Array.from(props.word)
  return Array.from({ length: count.value }, (_, i) => arr[i] ?? '')
})
const states = computed(() => (props.answer ? judgeWord(props.word, props.answer) : null))
const allExact = computed(() => states.value?.every(s => s === 'exact') ?? false)
</script>

<template>
  <div class="tile-row">
    <div
      v-for="(c, i) in chars"
      :key="i"
      class="tile"
      :class="{ revealed: !!states && animate }"
      :style="{ '--i': i }"
    >
      <div class="face front">
        <span class="char" :class="{ filled: !!c && !states }">{{ c }}</span>
      </div>
      <div v-if="states" class="face back" :class="allExact ? 'tile-ok' : 'tile-gray'">
        <span class="char" :class="[states[i], { 'on-ok': allExact }]">{{ c }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 块无 margin，行内 gap 0.5rem → 4 字行总宽 21.5rem，与输入框边缘对齐 */
.tile-row {
  display: flex;
  gap: 0.5rem;
}
.tile {
  position: relative;
  width: 5rem;
  height: 5rem;
  perspective: 500px;
  user-select: none;
}
.face {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--c-border);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  transition: transform 0.6s;
  transition-delay: calc(var(--i, 0) * 0.3s);
  font-family: var(--font-serif);
  font-size: 2rem;
  line-height: 1;
}
.face.back {
  transform: rotateY(180deg);
}
.tile.revealed .face.front {
  transform: rotateY(180deg);
}
.tile.revealed .face.back {
  transform: rotateY(0deg);
}
.face.back.tile-gray {
  background: rgba(156, 163, 175, 0.08);
  border-color: transparent;
}
.face.back.tile-ok {
  background: var(--c-ok);
  border-color: transparent;
}
.char {
  font-family: var(--font-serif);
}
.char.exact {
  color: var(--c-ok);
}
.char.misplaced {
  color: var(--c-mis);
}
.char.none {
  opacity: 0.4;
}
.char.on-ok {
  color: #fff;
}
.char.filled {
  color: var(--c-text);
}
</style>
