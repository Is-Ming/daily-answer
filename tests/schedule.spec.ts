import { describe, expect, it } from 'vitest'
import { dayIndexOf, msToNextShanghaiMidnight, shanghaiToday } from '@/game/schedule'

describe('上海时区日历日', () => {
  it('纪元日为 dayIndex 0，逐日递增', () => {
    expect(dayIndexOf('2026-10-30')).toBe(0)
    expect(dayIndexOf('2026-10-31')).toBe(1)
    expect(dayIndexOf('2026-11-01')).toBe(2)
    expect(dayIndexOf('2027-01-01')).toBe(63)
  })

  it('纪元日之前钳制为 0', () => {
    expect(dayIndexOf('2026-10-01')).toBe(0)
  })

  it('shanghaiToday 按 UTC+8 换日', () => {
    // UTC 2026-10-29 15:59 = 上海 23:59，仍是 29 日
    expect(shanghaiToday(Date.UTC(2026, 9, 29, 15, 59))).toBe('2026-10-29')
    // UTC 2026-10-29 16:00 = 上海 30 日零点，已换日
    expect(shanghaiToday(Date.UTC(2026, 9, 29, 16, 0))).toBe('2026-10-30')
  })

  it('倒计时指向上海次日零点', () => {
    // 上海 23:00（UTC 15:00）→ 距零点 1 小时
    expect(msToNextShanghaiMidnight(Date.UTC(2026, 9, 29, 15, 0))).toBe(3600000)
    // 上海零点整（UTC 16:00 前一刻附近）→ 约 24 小时
    expect(msToNextShanghaiMidnight(Date.UTC(2026, 9, 29, 16, 0))).toBe(86400000)
  })

  it('dayIndexOf 默认取上海今日', () => {
    expect(dayIndexOf()).toBe(dayIndexOf(shanghaiToday()))
  })
})
