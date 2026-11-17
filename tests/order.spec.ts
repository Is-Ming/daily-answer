import { describe, expect, it } from 'vitest'
import type { Epoch } from '@/game/order'
import { mulberry32, puzzleIndexOfDay, shuffledOrder, xmur3 } from '@/game/order'
import { LEGACY_EPOCHS, parseScheduleMeta } from '@/data/loader'

/** 与退役代码常量等值的基准 epochs（现来源为产物 epochs.json） */
const BASE_EPOCHS: Epoch[] = [{ since: 0, size: 95 }]

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
    const days = Array.from({ length: 10 }, (_, d) => puzzleIndexOfDay(d, 95, BASE_EPOCHS))
    expect(days).toEqual([76, 23, 21, 92, 58, 14, 6, 31, 0, 51])
  })

  it('同一轮（95 天）内题目不重复', () => {
    const seq = Array.from({ length: 95 }, (_, d) => puzzleIndexOfDay(d, 95, BASE_EPOCHS))
    expect(new Set(seq).size).toBe(95)
  })

  it('新一轮换种子重洗，与上一轮不同', () => {
    const c0 = shuffledOrder(95, 'mídǐ-2026-11-01:0:0')
    const c1 = shuffledOrder(95, 'mídǐ-2026-11-01:0:1')
    expect(c0).not.toEqual(c1)
  })

  it('epochs 注入推导与历史代码常量推导一致', () => {
    // 旧实现：EPOCHS 常量（[{since:0,size:95}]）默认注入；固定向量即当时快照
    const days = Array.from({ length: 10 }, (_, d) => puzzleIndexOfDay(d, 95, [{ since: 0, size: 95 }]))
    expect(days).toEqual([76, 23, 21, 92, 58, 14, 6, 31, 0, 51])
  })

  it('追加 epoch 不改变历史推导（0–129 场景）', () => {
    const before = Array.from({ length: 130 }, (_, d) => puzzleIndexOfDay(d, 95, BASE_EPOCHS))
    const extended = [...BASE_EPOCHS, { since: 130, size: 145 }]
    const after = Array.from({ length: 130 }, (_, d) => puzzleIndexOfDay(d, 95, extended))
    expect(after).toEqual(before)
  })

  it('新 epoch 使用新题库规模', () => {
    const extended = [...BASE_EPOCHS, { since: 130, size: 145 }]
    // dayIndex 130 落在新 epoch：local=0, cycle=0 → 新种子新序列
    const idx = puzzleIndexOfDay(130, 145, extended)
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(idx).toBeLessThan(145)
  })

  it('切换日不打断当日题：since=N+1 时第 N 天仍按旧 epoch', () => {
    // 扩题次日生效：第 99 天属旧 epoch（末位），第 100 天起属新 epoch
    const extended = [...BASE_EPOCHS, { since: 100, size: 100 }]
    const day99 = puzzleIndexOfDay(99, 95, extended)
    expect(day99).toBe(puzzleIndexOfDay(99, 95, BASE_EPOCHS))
    const day100 = puzzleIndexOfDay(100, 100, extended)
    expect(day100).toBeGreaterThanOrEqual(0)
    expect(day100).toBeLessThan(100)
  })
})

describe('排期元数据解析（loader 纯函数）', () => {
  it('合法元数据解析通过', () => {
    const meta = parseScheduleMeta({ epochDate: '2026-10-30', epochs: [{ since: 0, size: 95 }] })
    expect(meta.epochDate).toBe('2026-10-30')
    expect(meta.epochs).toEqual([{ since: 0, size: 95 }])
  })

  it('加载器兜底常量与退役代码常量等值', () => {
    expect(LEGACY_EPOCHS).toEqual(BASE_EPOCHS)
    expect(LEGACY_EPOCHS[0].size).toBe(95)
  })

  it.each([
    ['epochs 为空', { epochDate: '2026-10-30', epochs: [] }],
    ['epochs 缺失', { epochDate: '2026-10-30' }],
    ['since 非整数', { epochDate: '2026-10-30', epochs: [{ since: 0.5, size: 95 }] }],
    ['size 非法', { epochDate: '2026-10-30', epochs: [{ since: 0, size: 0 }] }],
    ['since 未递增', { epochDate: '2026-10-30', epochs: [{ since: 10, size: 95 }, { since: 10, size: 100 }] }],
    ['epochDate 格式非法', { epochDate: '20261030', epochs: [{ since: 0, size: 95 }] }],
    ['非对象', 'epochs.json'],
  ])('畸形数据红灯：%s', (_name, data) => {
    expect(() => parseScheduleMeta(data)).toThrow()
  })
})
