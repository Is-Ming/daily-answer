/**
 * 每日出题推导（design D1）。
 *
 * 无明文排期表：当日题 = puzzles[order[slot]]，order 由公开种子在运行时
 * 洗牌得出。全部使用 32 位整数运算（xmur3 + mulberry32），任何 JS 引擎
 * 推导出同一序列——这是「全网同题」的根基，禁止引入 Math.random 或浮点。
 *
 * 已知边界（用户已接受）：题库随包分发，本机制防「读源码/看列表」，
 * 不防「执行同一段算法的人」。
 */

/** 基础种子。公开常量；更换即整体重新洗牌（历史题号将变，慎改）。 */
export const BASE_SEED = 'mídǐ-2026-11-01'

/**
 * 时期表：扩题时追加 { since: 换题日 dayIndex, size: 新题库总量, seq: 冻结序列 }。
 * 历史时期的 since/size/seq 永不改动，保证历史题号永远可复算。
 * seq 为构建期一次洗牌冻结的答案序列（长度==size）；缺省时回落洗牌推导（旧产物兜底）。
 * 数据来源：public/data/epochs.json（构建器维护，只增不改），由加载器注入。
 */
export interface Epoch {
  since: number
  size: number
  seq?: string[]
}

/** xmur3：字符串 → uint32 序列发生器。 */
export function xmur3(str: string): () => number {
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

/** mulberry32：uint32 种子 → [0,1) 均匀序列。 */
export function mulberry32(a: number): () => number {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fisher–Yates 洗牌：同一轮（cycle）内每道题恰好出现一次。 */
export function shuffledOrder(size: number, seed: string): number[] {
  const rand = mulberry32(xmur3(seed)())
  const arr = Array.from({ length: size }, (_, i) => i)
  for (let i = size - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * dayIndex → 题库下标。
 * answers 为当前题库答案有序数组（seq 查表与安全兜底都要用）；
 * epochs 必传（来自产物 epochs.json）；overrides 命中的日子直接返回钉住下标。
 * epoch 带 seq 时查冻结序列（frozen-seq：历史出题与题库排序/增删解耦），
 * seq[slot] 不在题库中抛错（fail-closed）；无 seq 回落洗牌推导（旧产物兜底）。
 */
export function puzzleIndexOfDay(
  dayIndex: number,
  answers: readonly string[],
  epochs: Epoch[],
  overrides: Record<string, string> = {},
): number {
  const bankSize = answers.length
  const pinnedAnswer = overrides[String(dayIndex)]
  if (pinnedAnswer != null) {
    const at = answers.indexOf(pinnedAnswer)
    if (at < 0)
      throw new Error(`override 非法: day${dayIndex} → 「${pinnedAnswer}」（题库中不存在）`)
    return at
  }
  let picked = { idx: 0, epoch: epochs[0] }
  for (let i = epochs.length - 1; i >= 0; i--) {
    if (dayIndex >= epochs[i].since) {
      picked = { idx: i, epoch: epochs[i] }
      break
    }
  }
  const { idx, epoch } = picked
  const local = dayIndex - epoch.since
  const slot = local % epoch.size
  if (epoch.seq) {
    const answer = epoch.seq[slot]
    const at = answers.indexOf(answer)
    if (at < 0)
      throw new Error(`epoch${idx} seq[${slot}] 答案「${answer}」不在题库中（产物不一致）`)
    return at
  }
  const cycle = Math.floor(local / epoch.size)
  const order = shuffledOrder(epoch.size, `${BASE_SEED}:${idx}:${cycle}`)
  return order[slot] % bankSize
}
