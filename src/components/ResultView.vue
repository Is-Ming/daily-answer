<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGame } from '@/store/game'
import CountdownBar from './CountdownBar.vue'
import ConfettiBurst from './ConfettiBurst.vue'

const game = useGame()
const state = game.state

const won = computed(() => state.record?.status === 'win')
const altNames = computed(() => state.puzzle?.altNames ?? [])
const altLabel = computed(() => (altNames.value.length ? `又名 ${altNames.value.join('、')}` : ''))

const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

async function onShare() {
  const text = game.buildShare()
  try {
    await navigator.clipboard.writeText(text)
  }
  catch {
    // 剪贴板不可用（http 环境）时的兜底
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
  copied.value = true
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => (copied.value = false), 2000)
}
</script>

<template>
  <div v-if="state.puzzle && state.record" class="result">
    <ConfettiBurst v-if="won" />

    <h1 class="title" :class="won ? 'win' : 'lose'">
      {{ won ? '猜中了！' : '差一点' }}
    </h1>

    <div class="answer-card" :class="{ win: won }">
      <Transition name="fade" appear>
        <b class="answer">{{ state.puzzle.answer }}</b>
      </Transition>
    </div>

    <p class="figures">
      {{ game.attemptsUsed.value + (won ? 1 : 0) }}/{{ game.attemptsMax.value }} 次
      · 提示 {{ state.record.revealed }} 条
      <template v-if="state.record.usedTip"> · 用了锦囊</template>
      · 连胜 {{ state.stats.streak }}
    </p>

    <section class="lore">
      <p class="summary">{{ state.puzzle.summary }}</p>
      <p v-if="altLabel" class="alt">{{ altLabel }}</p>
      <p class="gloss"><b>释义</b> {{ state.puzzle.gloss }}</p>
      <p class="story"><b>典故</b> {{ state.puzzle.story }}</p>
      <p class="source">{{ state.puzzle.source }} · {{ state.puzzle.glossSource }}</p>
    </section>

    <section class="replay">
      <h3>今日提示</h3>
      <p v-for="h in game.revealedHints.value" :key="h.word" class="replay-item">
        <b>{{ h.word }}</b>
        <span>{{ h.note }}</span>
      </p>
    </section>

    <div class="actions">
      <button class="btn" @click="onShare">{{ copied ? '已复制' : '复制战绩' }}</button>
      <button class="btn ghost" @click="game.backHome()">返回首页</button>
    </div>

    <p class="next">
      <CountdownBar />
    </p>
  </div>
</template>

<style scoped>
.result {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: 100%;
  max-width: 26rem;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
}
.title {
  margin: 0;
  font-size: 1.6rem;
}
.title.win {
  color: var(--c-ok);
}
.title.lose {
  color: var(--c-text-light);
}
.answer-card {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 1.25rem 0;
  border: 2px solid var(--c-border);
  border-radius: var(--radius);
  perspective: 600px;
}
.answer-card.win {
  border-color: var(--c-ok);
}
.answer {
  font-size: 2rem;
  letter-spacing: 0.25em;
  text-indent: 0.25em;
}
.figures {
  margin: 0;
  color: var(--c-text-light);
  font-size: 0.95rem;
}
.lore {
  width: 100%;
  text-align: left;
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: 1rem 1.25rem;
}
.lore p {
  margin: 0.4rem 0;
  line-height: 1.8;
}
.summary {
  font-size: 1.15rem;
  font-weight: 600;
}
.alt {
  color: var(--c-text-light);
  font-size: 0.9rem;
}
.gloss b,
.story b {
  color: var(--c-primary);
  margin-right: 0.4rem;
}
.story {
  font-size: 0.95rem;
}
.source {
  font-size: 0.8rem;
  color: var(--c-text-light);
}
.replay {
  width: 100%;
  text-align: left;
}
.replay h3 {
  font-size: 0.95rem;
  margin: 0 0 0.4rem;
}
.replay-item {
  display: flex;
  gap: 0.75rem;
  margin: 0.3rem 0;
  font-size: 0.9rem;
}
.replay-item b {
  color: var(--c-primary);
  white-space: nowrap;
}
.replay-item span {
  color: var(--c-text-light);
}
.actions {
  display: flex;
  gap: 0.75rem;
}
.ghost {
  background: transparent;
  color: var(--c-primary);
  border: 1px solid var(--c-primary);
}
.next {
  margin: 0;
}
</style>
