// 排期反查：按答案查它未来出现哪一期。
// 用法: node tools/locate.mjs <答案>   （如：node tools/locate.mjs 张居正）
// 内置固定向量自校验：推导逻辑与 src/game/order.ts 漂移时拒绝输出。
import { readFileSync } from 'node:fs'

const expect = '76,23,21,92,58,14,6,31,0,51'
const BASE_SEED = 'mídǐ-2026-11-01' // 与 src/game/order.ts 保持同步

function xmur3(str) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return (h ^= h >>> 16) >>> 0
  }
}
function mulberry32(a) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function shuffledOrder(size, seed) {
  const rand = mulberry32(xmur3(seed)())
  const arr = Array.from({ length: size }, (_, i) => i)
  for (let i = size - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

const probe = shuffledOrder(95, `${BASE_SEED}:0:0`).slice(0, 10).join(',')
if (probe !== expect) {
  console.error(`自校验失败（得到 ${probe}）：本脚本的算法与 src/game/order.ts 漂移，禁止使用。`)
  process.exit(1)
}

const answer = process.argv[2]
const bank = JSON.parse(readFileSync(new URL('../public/data/puzzles.json', import.meta.url), 'utf8'))
const meta = JSON.parse(readFileSync(new URL('../public/data/epochs.json', import.meta.url), 'utf8'))
const idx = bank.findIndex((p) => p.answer === answer)
if (idx < 0) {
  console.error(`题库中找不到「${answer}」。现有答案：${bank.map((p) => p.answer).join('、')}`)
  process.exit(1)
}

const dateOf = (day) => new Date(Date.UTC(2026, 9, 30) + day * 86400000).toISOString().slice(0, 10)
const shanghaiToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const today = Math.max(0, Math.round((Date.parse(shanghaiToday() + 'T00:00Z') - Date.UTC(2026, 9, 30)) / 86400000))
const MAX_CYCLE = 3

let found = 0
for (let e = meta.epochs.length - 1; e >= 0; e--) {
  const epoch = meta.epochs[e]
  for (let cycle = 0; cycle < MAX_CYCLE; cycle++) {
    const order = shuffledOrder(epoch.size, `${BASE_SEED}:${e}:${cycle}`)
    for (let slot = 0; slot < epoch.size; slot++) {
      if (order[slot] % bank.length !== idx) continue
      const day = epoch.since + cycle * epoch.size + slot
      if (day < today) continue
      console.log(`${answer} → d=${day}（${dateOf(day)}）epoch${e} cycle${cycle} 槽位${slot} | 题型=${bank[idx].type} 难度=${bank[idx].difficulty}`)
      found++
      if (found >= 3) process.exit(0)
    }
  }
}
if (!found) console.log(`未来 ${MAX_CYCLE} 轮内未排到「${answer}」`)
