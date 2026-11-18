import { describe, expect, it } from 'vitest'
import type { Epoch } from '@/game/order'
import { mulberry32, puzzleIndexOfDay, shuffledOrder, xmur3 } from '@/game/order'
import { LEGACY_EPOCHS, parseScheduleMeta } from '@/data/loader'

/** 与退役代码常量等值的基准 epochs（现来源为产物 epochs.json） */
const BASE_EPOCHS: Epoch[] = [{ since: 0, size: 95 }]

/** 模拟题库答案有序数组（下标即答案名，便于断言） */
const ANSWERS95 = Array.from({ length: 95 }, (_, i) => `a${i}`)

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

describe('每日出题（无 seq：洗牌兜底路径）', () => {
  it('dayIndex 0..9 推导结果固定', () => {
    const days = Array.from({ length: 10 }, (_, d) => puzzleIndexOfDay(d, ANSWERS95, BASE_EPOCHS))
    expect(days).toEqual([76, 23, 21, 92, 58, 14, 6, 31, 0, 51])
  })

  it('同一轮（95 天）内题目不重复', () => {
    const seq = Array.from({ length: 95 }, (_, d) => puzzleIndexOfDay(d, ANSWERS95, BASE_EPOCHS))
    expect(new Set(seq).size).toBe(95)
  })

  it('新一轮换种子重洗，与上一轮不同', () => {
    const c0 = shuffledOrder(95, 'mídǐ-2026-11-01:0:0')
    const c1 = shuffledOrder(95, 'mídǐ-2026-11-01:0:1')
    expect(c0).not.toEqual(c1)
  })

  it('追加 epoch 不改变历史推导（0–129 场景）', () => {
    const before = Array.from({ length: 130 }, (_, d) => puzzleIndexOfDay(d, ANSWERS95, BASE_EPOCHS))
    const extended = [...BASE_EPOCHS, { since: 130, size: 145 }]
    const after = Array.from({ length: 130 }, (_, d) => puzzleIndexOfDay(d, ANSWERS95, extended))
    expect(after).toEqual(before)
  })

  it('新 epoch 使用新题库规模', () => {
    const extended = [...BASE_EPOCHS, { since: 130, size: 145 }]
    const answers145 = Array.from({ length: 145 }, (_, i) => `b${i}`)
    // dayIndex 130 落在新 epoch：local=0, cycle=0 → 新种子新序列
    const idx = puzzleIndexOfDay(130, answers145, extended)
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(idx).toBeLessThan(145)
  })

  it('切换日不打断当日题：since=N+1 时第 N 天仍按旧 epoch', () => {
    const extended = [...BASE_EPOCHS, { since: 100, size: 100 }]
    const answers100 = Array.from({ length: 100 }, (_, i) => `b${i}`)
    const day99 = puzzleIndexOfDay(99, ANSWERS95, extended)
    expect(day99).toBe(puzzleIndexOfDay(99, ANSWERS95, BASE_EPOCHS))
    const day100 = puzzleIndexOfDay(100, answers100, extended)
    expect(day100).toBeGreaterThanOrEqual(0)
    expect(day100).toBeLessThan(100)
  })
})

describe('每日出题（frozen-seq：冻结序列查表）', () => {
  // 95 题版真实历史快照（洗牌头部：76,23,21,… → 精卫填海为第 1 期的模拟等价物）
  const ORDER95 = shuffledOrder(95, 'mídǐ-2026-11-01:0:0')
  const SEQ0 = ORDER95.map((i) => ANSWERS95[i])
  const EPOCHS_SEQ: Epoch[] = [{ since: 0, size: 95, seq: SEQ0 }]

  it('seq 查表与洗牌推导逐日一致（同一坐标系下）', () => {
    const days = Array.from({ length: 95 }, (_, d) => puzzleIndexOfDay(d, ANSWERS95, EPOCHS_SEQ))
    expect(days).toEqual(ORDER95)
  })

  it('seq 轮次语义：第 96 天起重复 seq（slot = local % size）', () => {
    expect(puzzleIndexOfDay(95, ANSWERS95, EPOCHS_SEQ)).toBe(puzzleIndexOfDay(0, ANSWERS95, EPOCHS_SEQ))
    expect(puzzleIndexOfDay(97, ANSWERS95, EPOCHS_SEQ)).toBe(puzzleIndexOfDay(2, ANSWERS95, EPOCHS_SEQ))
  })

  it('seq 查表与题库排序解耦：插队加题后历史不变', () => {
    // 在答案数组中部插入 4 个新题（模拟新人物插进排序位置）
    const answers99 = [...ANSWERS95.slice(0, 50), '新甲', '新乙', '新丙', '新丁', ...ANSWERS95.slice(50)]
    const days = Array.from({ length: 95 }, (_, d) => puzzleIndexOfDay(d, answers99, EPOCHS_SEQ))
    // seq 冻结的是答案字符串：查表结果映射回原题，不受插入位移影响
    expect(days).toEqual(ORDER95.map((i) => (i < 50 ? i : i + 4)))
  })

  it('seq 答案不在题库中抛错（fail-closed）', () => {
    const bad: Epoch[] = [{ since: 0, size: 95, seq: [...SEQ0.slice(0, -1), '不存在的题'] }]
    expect(() => puzzleIndexOfDay(94, ANSWERS95, bad)).toThrow(/不在题库中/)
  })

  it('追加带 seq 的新 epoch 不改变历史推导', () => {
    const answers96 = [...ANSWERS95, '新题96']
    const seq1 = shuffledOrder(96, 'mídǐ-2026-11-01:1:0').map((i) => answers96[i])
    const extended: Epoch[] = [...EPOCHS_SEQ, { since: 19, size: 96, seq: seq1 }]
    const before = Array.from({ length: 19 }, (_, d) => puzzleIndexOfDay(d, ANSWERS95, EPOCHS_SEQ))
    const after = Array.from({ length: 19 }, (_, d) => puzzleIndexOfDay(d, answers96, extended))
    expect(after).toEqual(before)
    expect(puzzleIndexOfDay(19, answers96, extended)).toBe(answers96.indexOf(seq1[0]))
  })
})

describe('当日钉住（override）', () => {
  const DAY19: Epoch[] = [{ since: 0, size: 95 }, { since: 19, size: 96 }]
  const answers96 = Array.from({ length: 96 }, (_, i) => `c${i}`)

  it('命中日直接返回钉住答案的下标（当日不受扩题影响）', () => {
    // 扩题日钉住旧口径当日题：无论新洗牌把哪题排到 day19，钉住优先
    const idx = puzzleIndexOfDay(19, answers96, DAY19, { '19': 'c60' })
    expect(idx).toBe(60)
  })

  it('override 按答案查表，与题库排序解耦（插队后钉住不漂移）', () => {
    const shifted = [...answers96.slice(0, 50), '插队', ...answers96.slice(50)]
    expect(puzzleIndexOfDay(19, shifted, DAY19, { '19': 'c60' })).toBe(61)
  })

  it('未命中日不受 override 影响', () => {
    expect(puzzleIndexOfDay(20, answers96, DAY19, { '19': 'c60' }))
      .toBe(puzzleIndexOfDay(20, answers96, DAY19))
    expect(puzzleIndexOfDay(18, ANSWERS95, DAY19, { '19': 'c60' }))
      .toBe(puzzleIndexOfDay(18, ANSWERS95, DAY19))
  })

  it('override 答案不在题库中抛错（防御畸形产物）', () => {
    expect(() => puzzleIndexOfDay(19, answers96, DAY19, { '19': '不存在的题' })).toThrow()
    expect(() => puzzleIndexOfDay(19, answers96, DAY19, { '19': '' })).toThrow()
  })

  it('空 override 表等价于纯推导（兜底）', () => {
    expect(puzzleIndexOfDay(19, answers96, DAY19, {})).toBe(puzzleIndexOfDay(19, answers96, DAY19))
  })
})

describe('排期元数据解析（loader 纯函数）', () => {
  it('合法元数据解析通过', () => {
    const meta = parseScheduleMeta({ epochDate: '2026-10-30', epochs: [{ since: 0, size: 95 }] })
    expect(meta.epochDate).toBe('2026-10-30')
    expect(meta.epochs).toEqual([{ since: 0, size: 95 }])
  })

  it('携带合法 seq 的元数据解析通过', () => {
    const meta = parseScheduleMeta({
      epochDate: '2026-10-30',
      epochs: [{ since: 0, size: 3, seq: ['甲', '乙', '丙'] }],
    })
    expect(meta.epochs[0].seq).toEqual(['甲', '乙', '丙'])
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
    ['seq 非字符串数组', { epochDate: '2026-10-30', epochs: [{ since: 0, size: 2, seq: ['甲', 3] }] }],
    ['seq 长度与 size 不符', { epochDate: '2026-10-30', epochs: [{ since: 0, size: 3, seq: ['甲'] }] }],
    ['非对象', 'epochs.json'],
  ])('畸形数据红灯：%s', (_name, data) => {
    expect(() => parseScheduleMeta(data)).toThrow()
  })
})
