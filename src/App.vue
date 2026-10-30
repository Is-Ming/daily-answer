<script setup lang="ts">
import { onMounted, ref, watchEffect } from 'vue'
import { useWindowSize } from './composables/useWindowSize'
import { useGame } from '@/store/game'
import { useTheme } from '@/store/theme'
import Icon from '@/components/Icon.vue'
import HomeView from '@/components/HomeView.vue'
import PlayView from '@/components/PlayView.vue'
import ResultView from '@/components/ResultView.vue'
import ScoreboardModal from '@/components/ScoreboardModal.vue'

const game = useGame()
const state = game.state
const theme = useTheme()

const showBoard = ref(false)

onMounted(() => {
  game.init()
})

// 移动端视口高度修正（Safari 地址栏伸缩）
const { height } = useWindowSize()
watchEffect(() => {
  document.documentElement.style.setProperty('--vh', `${height.value / 100}px`)
})
</script>

<template>
  <main class="app" select-none>
    <header class="nav">
      <div class="nav-inner">
        <div class="side">
          <button class="icon-btn" title="玩法说明" @click="game.backHome()"><Icon name="help" /></button>
          <button class="icon-btn" title="记分板" @click="showBoard = true"><Icon name="catalog" /></button>
        </div>
        <div class="brand">谜底</div>
        <div class="side">
          <button class="icon-btn" title="切换深浅色" @click="theme.toggle()"><Icon :name="theme.isDark.value ? 'sun' : 'moon'" /></button>
        </div>
      </div>
    </header>

    <div v-if="state.debug" class="debug-banner">
      调试模式（?d= / ?word=）：不写入进度、不计分、不上报
    </div>

    <div v-if="state.phase === 'loading'" class="center">
      <p>加载中…</p>
    </div>

    <div v-else-if="state.phase === 'error'" class="center">
      <p>题库加载失败：{{ state.error }}</p>
      <button class="btn" @click="game.init()">重试</button>
    </div>

    <HomeView v-else-if="state.phase === 'home'" />
    <PlayView v-else-if="state.phase === 'playing'" />
    <ResultView v-else-if="state.phase === 'result'" />

    <ScoreboardModal v-model="showBoard" />
  </main>
</template>

<style scoped>
.app {
  height: calc(var(--vh, 1vh) * 100);
  display: flex;
  flex-direction: column;
  user-select: none;
  overflow-y: auto;
}
.nav {
  border-bottom: 1px solid var(--c-border);
}
.nav-inner {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 28rem;
  margin: 0 auto;
  padding: 0.75rem 0.5rem;
}
.brand {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-serif);
  font-size: 1.5rem;
  letter-spacing: 0.5rem;
  text-indent: 0.5rem;
  pointer-events: none;
}
.side {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  z-index: 1;
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.2rem;
  height: 2.2rem;
  border: none;
  background: none;
}
.center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}
.debug-banner {
  background: var(--c-hover);
  color: var(--c-mis);
  text-align: center;
  font-size: 0.8rem;
  padding: 0.25rem;
}
</style>
