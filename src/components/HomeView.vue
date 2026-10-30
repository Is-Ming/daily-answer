<script setup lang="ts">
import { computed } from 'vue'
import { detectReporter } from '@/report'
import { SITE_URL } from '@/game/share'
import TileRow from '@/components/TileRow.vue'
import { useGame } from '@/store/game'

const game = useGame()
const state = game.state

const dateLabel = computed(() => state.date)
const hasReporter = computed(() => !!detectReporter())

const rules = [
  '每天一题，全网同题，次日零点换题。',
  '玩法灵感来自《中国成语大会》的「双音节对抗」环节。',
  '题目会给出一组两字提示词，每条都指向同一个答案。',
  '答案只有两种：成语，或者历史人物。',
  '每猜错一次，多亮一条提示；用完机会仍未猜中即失败。',
  '卡住时可以点「锦囊」，会给一条提示。',
  '题目按难度分五级，一星最易，五星最难。',
]

// 规则页示例（设计文档 §4.1：必须用示例题，不能用今日题）
const exampleHints = ['秦末', '凿船', '项羽', '决心', '巨鹿']

function start() {
  game.start()
}
</script>

<template>
  <div class="home">
    <h1 class="brand">谜底</h1>
    <p class="sub">第 {{ state.dayIndex + 1 }} 期 · {{ dateLabel }}</p>

    <section class="card">
      <h2>玩法</h2>
      <ol>
        <li v-for="(r, i) in rules" :key="i">{{ r }}</li>
      </ol>
    </section>

    <section class="card example">
      <h2>示例</h2>
      <div class="ex-hints">
        <span v-for="w in exampleHints" :key="w" class="ex-word">{{ w }}</span>
      </div>
      <p class="ex-note">这些词都指向同一个答案。假设你猜了「沉着冷静」：</p>
      <TileRow word="沉着冷静" answer="破釜沉舟" />
      <p class="ex-note">
        「沉」在答案里但位置不对，是<b class="t-mis">橙色</b>；没有的字是<b class="t-gray">灰色</b>。
      </p>
      <TileRow word="破釜沉舟" answer="破釜沉舟" />
      <p class="ex-note">
        字和位置全部对上，<b class="t-ok">整行变绿</b>——就是这样猜中的。释义与典故在结算页揭晓。
      </p>
    </section>

    <button class="btn start" @click="start">
      {{ state.record ? '查看今日结果' : '开始' }}
    </button>

    <footer class="foot">
      <p v-if="hasReporter">本站收集匿名统计数据，不包含任何个人信息。</p>
      <p><a href="https://github.com/your-name/daily-answer" target="_blank" rel="noopener">Source Code</a> · {{ SITE_URL }}</p>
    </footer>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem 1rem 3rem;
  max-width: 30rem;
  margin: 0 auto;
}
.brand {
  font-size: 3rem;
  margin: 0;
  letter-spacing: 0.3em;
  text-indent: 0.3em;
  color: var(--c-primary);
}
.sub {
  margin: -0.5rem 0 0;
  color: var(--c-text-light);
  font-size: 0.9rem;
}
.card {
  width: 100%;
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: 1rem 1.25rem;
  text-align: left;
}
.card h2 {
  font-size: 1rem;
  margin: 0 0 0.5rem;
}
.card ol {
  margin: 0;
  padding-left: 1.25rem;
  line-height: 1.9;
  font-size: 0.95rem;
}
.tip {
  margin: 0.75rem 0 0;
  font-size: 0.85rem;
  color: var(--c-text-light);
}
.example {
  text-align: center;
}
/* 字块行是块级 flex，需收缩宽度后才能用 auto margin 居中 */
.example :deep(.tile-row) {
  width: fit-content;
  margin: 0.6rem auto;
}
.ex-hints {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
}
.ex-word {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--c-primary);
  border: 1.5px solid var(--c-primary);
  border-radius: var(--radius);
  padding: 0.1rem 0.5rem;
}
.ex-note {
  font-size: 0.9rem;
  color: var(--c-text-light);
  margin: 0.3rem 0;
  line-height: 1.7;
  text-align: center; /* 压过 base.css 的 p{text-align:left} */
}
.ex-note b.t-ok {
  color: var(--c-ok);
}
.ex-note b.t-mis {
  color: var(--c-mis);
}
.ex-note b.t-gray {
  opacity: 0.5;
}
.start {
  font-size: 1.1rem;
  padding: 0.75rem 3rem;
}
.foot {
  margin-top: auto;
  font-size: 0.75rem;
  color: var(--c-text-light);
  text-align: center;
  line-height: 1.8;
}
.foot a {
  color: var(--c-primary);
  text-decoration: none;
}
</style>
