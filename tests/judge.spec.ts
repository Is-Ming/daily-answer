import { describe, expect, it } from 'vitest'
import { judgeWord } from '@/game/match'

describe('逐字判定（棋盘行着色）', () => {
  it('全部位置一致 = 全绿', () => {
    expect(judgeWord('破釜沉舟', '破釜沉舟')).toEqual([
      'exact', 'exact', 'exact', 'exact',
    ])
  })

  it('位置一致绿、存在但错位橙、没有灰', () => {
    // 「舟」位置对；「沉」在答案里但错位；「天」不在
    expect(judgeWord('一沉天舟', '破釜沉舟')).toEqual([
      'none', 'misplaced', 'none', 'exact',
    ])
  })

  it('重复字按标准算法配额', () => {
    // 答案「沉舟沉舟」：猜「沉沉舟舟」
    // idx0 沉 exact；idx1 沉 vs 舟 → 剩余答案有 idx2 的沉 → misplaced；
    // idx2 舟 vs 沉 → misplaced（吃掉 idx3 舟的配额）；idx3 舟 exact
    expect(judgeWord('沉沉舟舟', '沉舟沉舟')).toEqual([
      'exact', 'misplaced', 'misplaced', 'exact',
    ])
    // 猜「沉沉沉沉」：多余的两个沉没有答案配额 → none
    expect(judgeWord('沉沉沉沉', '沉舟沉舟')).toEqual([
      'exact', 'none', 'exact', 'none',
    ])
  })

  it('猜测比答案长（人物别名宽度场景防御）', () => {
    expect(judgeWord('一二三四五', '一二')).toEqual([
      'exact', 'exact', 'none', 'none', 'none',
    ])
  })
})
