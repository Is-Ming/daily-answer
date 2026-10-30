<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from '@/components/Icon.vue'
import TileRow from '@/components/TileRow.vue'
import { useGame } from '@/store/game'

const game = useGame()
const state = game.state

const input = ref('')
const toast = ref('')
const shaking = ref(false)
let toastTimer: ReturnType<typeof setTimeout> | undefined
let shakeTimer: ReturnType<typeof setTimeout> | undefined

const answerLen = computed(() => state.puzzle?.answer.length ?? 4)
const typed = computed(() => Array.from(input.value.trim()).slice(0, answerLen.value))

const REJECT_MSG: Record<string, string> = {
  length: `答案应为 ${answerLen.value} 个字`,
  charset: '请输入中文',
  duplicate: '这个词已经猜过了',
}

function showInvalid(msg: string) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 1500)
}

function shakeNow() {
  shaking.value = true
  clearTimeout(shakeTimer)
  shakeTimer = setTimeout(() => (shaking.value = false), 500)
}

function onSubmit() {
  if (!input.value.trim())
    return
  game.guess(input.value)
  const e = state.lastEvent
  if (e.type === 'rejected') {
    showInvalid(REJECT_MSG[e.reason] ?? '无效输入')
    shakeNow()
  }
  else {
    input.value = ''
    if (e.type === 'wrong')
      shakeNow()
  }
}

function onTip() {
  game.tip()
  if (state.lastEvent.type === 'tip')
    showInvalid('锦囊已多亮出一条提示')
}

/** 错误行逐字着色已移交 TileRow（与首页示例共用同一渲染） */
function diffStars(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}
</script>

<template>
  <div v-if="state.puzzle && state.record" class="play">
    <p class="meta">{{ state.type!.label }} 难度：<span class="stars" :title="state.puzzle.difficultyBasis">{{ diffStars(state.puzzle.difficulty) }}</span></p>

    <!-- 提示词行：标签固定左对齐，提示词在剩余空间居中 -->
    <p class="hint-line">
      <span class="hint-label">提示词</span>
      <TransitionGroup tag="span" name="fade" class="hint-words">
        <b v-for="h in game.revealedHints.value" :key="h.word">{{ h.word }}</b>
      </TransitionGroup>
    </p>

    <!-- 棋盘：字块行，最后为活动输入行 -->
    <div class="board" :class="{ shake: shaking }">
      <TileRow
        v-for="(g, gi) in state.record.guesses"
        :key="gi"
        :word="g"
        :answer="state.puzzle.answer"
      />
      <TileRow :word="typed.join('')" :len="answerLen" />
    </div>

    <!-- 输入区：方角粗边框输入框 + 居中确定按钮 + 框内覆盖提示） -->
    <div v-if="state.record.status === 'playing'" class="controls">
      <div class="input-wrap">
        <input
          v-model="input"
          class="guess-input"
          type="text"
          autocomplete="off"
          :maxlength="answerLen + 4"
          placeholder="输入答案..."
          @keydown.enter="onSubmit"
        >
        <div class="invalid-overlay" :class="{ show: !!toast }">{{ toast }}</div>
      </div>

      <button class="btn ok-btn" :disabled="typed.length !== answerLen" @click="onSubmit">
        确 定
      </button>

      <p v-if="state.record.guesses.length > 4" class="rest">
        剩余 {{ game.remaining.value }} 次机会
      </p>

      <!-- 底部图标链接：锦囊 -->
      <div class="actions-row">
        <button class="link-btn" :disabled="state.record.usedTip" @click="onTip">
          <Icon name="idea" /> 锦囊
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.play {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  max-width: 26rem;
  margin: 0 auto;
  padding: 1rem 1rem 3rem;
}
.meta {
  margin: 0;
  font-size: 0.8rem;
  color: var(--c-text-light);
}
.stars {
  color: var(--c-mis);
}

/* 提示词行：与输入框同宽；标签左对齐固定，词在剩余空间居中 */
.hint-line {
  margin: 0 0 0.4rem;
  border: 2px solid var(--c-border);
  border-radius: 0;
  padding: 0.45rem 0.75rem;
  display: flex;
  align-items: center;
  min-height: 2.6rem;
  width: min(100%, 21.5rem);
}
.hint-label {
  font-size: 0.85rem;
  color: var(--c-text-light);
  flex-shrink: 0;
}
.hint-words {
  flex: 1;
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.45rem;
}
.hint-words b {
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--c-primary);
  border: 1.5px solid var(--c-primary);
  border-radius: var(--radius);
  padding: 0.05rem 0.5rem;
}

/* 棋盘（字块样式统一在 TileRow 组件内） */
.board {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 0.5rem;
}

/* 输入区 */
.controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 0.75rem;
  width: 100%;
}
.input-wrap {
  position: relative;
  width: min(100%, 21.5rem);
}
.guess-input {
  width: 100%;
  background: transparent;
  border: 2px solid var(--c-border);
  border-radius: 0;
  padding: 0.75rem;
  text-align: center;
  font-size: 1.05rem;
  color: var(--c-text);
  outline: none;
}
.guess-input::placeholder {
  color: var(--c-text-light);
  opacity: 0.6;
}
.invalid-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--c-bg);
  color: var(--c-mis);
  letter-spacing: 0.1em;
  pointer-events: none;
  opacity: 0;
  transform: translateY(-0.25rem);
  transition: all 300ms;
}
.invalid-overlay.show {
  opacity: 1;
  transform: translateY(0);
}
.ok-btn {
  margin-top: 0.75rem;
  padding: 0.5rem 1.5rem;
}
.ok-btn:disabled {
  opacity: 0.5;
}
.rest {
  margin: 0.5rem 0 0;
  font-size: 0.85rem;
  color: var(--c-text-light);
}
.actions-row {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 1rem;
}
.link-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.95rem;
  color: var(--c-text);
  padding: 0 0.5rem 0.25rem;
  opacity: 0.75;
  transition: all 200ms ease-in-out;
}
.link-btn:hover:not(:disabled) {
  opacity: 1;
  color: var(--c-primary);
}
.link-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
</style>
