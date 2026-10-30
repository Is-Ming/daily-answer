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
 * 时期表：扩题时追加 { since: 换题日 dayIndex, size: 新题库总量 }。
 * 历史时期的 since/size 永不改动，保证历史题号永远可复算。
 */
export interface Epoch {
  since: number
  size: number
}

export const EPOCHS: Epoch[] = [{ since: 0, size: 95 }]

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
 * bankSize 用于安全兜底（正常应等于当前 epoch.size）；
 * epochs 可注入以便测试扩题不重排历史。
 */
export function puzzleIndexOfDay(
  dayIndex: number,
  bankSize: number,
  epochs: Epoch[] = EPOCHS,
): number {
  let picked = { idx: 0, epoch: epochs[0] }
  for (let i = epochs.length - 1; i >= 0; i--) {
    if (dayIndex >= epochs[i].since) {
      picked = { idx: i, epoch: epochs[i] }
      break
    }
  }
  const { idx, epoch } = picked
  const local = dayIndex - epoch.since
  const cycle = Math.floor(local / epoch.size)
  const slot = local % epoch.size
  const order = shuffledOrder(epoch.size, `${BASE_SEED}:${idx}:${cycle}`)
  return order[slot] % bankSize
}
