<script setup lang="ts">
import { computed } from 'vue'
import { useGame } from '@/store/game'
import AppModal from './AppModal.vue'
import Icon from './Icon.vue'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const game = useGame()
const state = game.state

const winRate = computed(() => {
  const s = state.stats
  return s.played > 0 ? `${Math.round((s.wins / s.played) * 100)}%` : '—'
})
const avgDuration = computed(() => {
  const s = state.stats
  return s.wins > 0 ? `${Math.round(s.totalDurationMs / s.wins / 1000)}秒` : '—'
})
const histogram = computed(() => {
  const h = state.stats.histogram
  const rows = Array.from({ length: game.attemptsMax.value }, (_, i) => ({
    label: String(i + 1),
    count: h[i + 1] ?? 0,
  }))
  rows.push({ label: 'X', count: state.stats.played - state.stats.wins })
  const peak = Math.max(1, ...rows.map(r => r.count))
  return rows.map(r => ({
    ...r,
    /** 按峰值占比，零计数给 1% 残条 */
    pct: r.count > 0 ? Math.max((r.count / peak) * 100, 12) : 1,
  }))
})
</script>

<template>
  <AppModal
    direction="top"
    :model-value="props.modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="dash">
      <button class="close" aria-label="关闭" @click="emit('update:modelValue', false)">
        <Icon name="close" />
      </button>

      <p class="title">记分板</p>

      <!-- 猜测次数分布 -->
      <div class="dist">
        <p class="dist-title">猜测分布</p>
        <div v-for="r in histogram" :key="r.label" class="row">
          <span class="n">{{ r.label }}</span>
          <div class="bar" :style="{ width: `${r.pct}%` }">
            <span class="cnt">{{ r.count }}</span>
          </div>
        </div>
      </div>

      <!-- 统计项：大数字 + 弱化标签 -->
      <div class="stats">
        <div class="item">
          <b>{{ state.stats.played }}</b><span>已玩</span>
        </div>
        <div class="item">
          <b>{{ state.stats.wins }}</b><span>获胜</span>
        </div>
        <div class="item">
          <b>{{ state.stats.noHintWins }}</b><span>无提示胜</span>
        </div>
        <div class="item">
          <b>{{ winRate }}</b><span>胜率</span>
        </div>
      </div>
      <div class="stats">
        <div class="item">
          <b>{{ state.stats.streak }}</b><span>当前连胜</span>
        </div>
        <div class="item">
          <b>{{ state.stats.maxStreak }}</b><span>最长连胜</span>
        </div>
        <div class="item">
          <b>{{ avgDuration }}</b><span>平均用时</span>
        </div>
      </div>

      <p class="note">统计仅存于本机浏览器</p>
    </div>
  </AppModal>
</template>

<style scoped>
.dash {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 25rem;
  margin: 0 auto;
  padding: 1rem 0 1.5rem;
}
.close {
  position: absolute;
  top: 0.4rem;
  right: 0;
  border: none;
  background: none;
  cursor: pointer;
  padding: 0.25rem;
  font-size: 1.2em;
  color: var(--c-text);
  opacity: 0.75;
  transition: all 200ms ease-in-out;
}
.close:hover {
  opacity: 1;
  color: var(--c-primary);
}
.title {
  margin: 0 0 0.5rem;
  font-family: var(--font-serif);
  font-size: 1.25rem;
  font-weight: 700;
  text-align: center;
}

/* 猜测分布：灰底容器 + 编号 + 主色条内数字右对齐） */
.dist {
  width: 100%;
  margin: 1rem 0;
  padding: 1rem;
  background: var(--c-hover);
  border-radius: var(--radius);
}
.dist-title {
  margin: 0 0 0.5rem;
  font-family: var(--font-serif);
  font-size: 1.05rem;
  text-align: center;
  letter-spacing: 0.2em;
  text-indent: 0.2em;
}
.row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.n {
  width: 1.25rem;
  flex-shrink: 0;
  text-align: right;
  color: var(--c-text-light);
  font-size: 0.85rem;
}
.bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: 1.25rem;
  min-width: 1.5rem;
  background: var(--c-primary);
  color: #fff;
  font-size: 0.8rem;
}
.cnt {
  margin-right: 0.25rem;
}

/* 统计项 */
.stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem 2.5rem;
  padding: 0.5rem 0;
}
.item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
}
.item b {
  font-size: 1.9rem;
  font-weight: 600;
  line-height: 1.2;
}
.item span {
  font-size: 0.8rem;
  color: var(--c-text-light);
}
.note {
  margin: 0.5rem 0 0;
  font-size: 0.75rem;
  color: var(--c-text-light);
  text-align: center;
}
</style>
