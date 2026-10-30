import { describe, expect, it } from 'vitest'
import { EPOCHS, mulberry32, puzzleIndexOfDay, shuffledOrder, xmur3 } from '@/game/order'

describe('PRNG 固定向量（跨引擎一致性的根基）', () => {
  it('xmur3', () => {
    const g = xmur3('mídǐ-2026-11-01:0:0')
    expect(g()).toBe(4140078768)
    expect(g()).toBe(4036936852)
    expect(g()).toBe(1884024852)
  })

  it('mulberry32', () => {
    const r = mulberry32(xmur3('vector-test')())
    expect(r()).toBeCloseTo(0.5036519011482596, 15)
    expect(r()).toBeCloseTo(0.5533521904144436, 15)
    expect(r()).toBeCloseTo(0.5562581394333392, 15)
  })

  it('Fisher–Yates 首轮洗牌头部固定', () => {
    expect(shuffledOrder(95, 'mídǐ-2026-11-01:0:0').slice(0, 10))
      .toEqual([76, 23, 21, 92, 58, 14, 6, 31, 0, 51])
  })
})

describe('每日出题', () => {
  it('dayIndex 0..9 推导结果固定', () => {
    const days = Array.from({ length: 10 }, (_, d) => puzzleIndexOfDay(d, 95))
    expect(days).toEqual([76, 23, 21, 92, 58, 14, 6, 31, 0, 51])
  })

  it('同一轮（95 天）内题目不重复', () => {
    const seq = Array.from({ length: 95 }, (_, d) => puzzleIndexOfDay(d, 95))
    expect(new Set(seq).size).toBe(95)
  })

  it('新一轮换种子重洗，与上一轮不同', () => {
    const c0 = shuffledOrder(95, 'mídǐ-2026-11-01:0:0')
    const c1 = shuffledOrder(95, 'mídǐ-2026-11-01:0:1')
    expect(c0).not.toEqual(c1)
  })

  it('追加 epoch 不改变历史推导', () => {
    const before = Array.from({ length: 130 }, (_, d) => puzzleIndexOfDay(d, 95))
    const extended = [...EPOCHS, { since: 130, size: 145 }]
    const after = Array.from({ length: 130 }, (_, d) => puzzleIndexOfDay(d, 95, extended))
    expect(after).toEqual(before)
  })

  it('新 epoch 使用新题库规模', () => {
    const extended = [...EPOCHS, { since: 130, size: 145 }]
    // dayIndex 130 落在新 epoch：local=0, cycle=0 → 新种子新序列
    const idx = puzzleIndexOfDay(130, 145, extended)
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(idx).toBeLessThan(145)
  })
})
