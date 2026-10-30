import { describe, expect, it } from 'vitest'
import { emptyStats } from '@/store/persistence'
import { applyResult, localSnapshot } from '@/store/stats'

const WIN = { won: true, usedTip: false, attempts: 3, durationMs: 60_000 }

describe('记分板', () => {
  it('连续三天获胜：连胜累加、直方图计数', () => {
    let s = emptyStats()
    s = applyResult(s, { date: '2026-11-01', ...WIN, attempts: 3 })
    s = applyResult(s, { date: '2026-11-02', ...WIN, attempts: 4 })
    s = applyResult(s, { date: '2026-11-03', ...WIN, attempts: 3 })
    expect(s.played).toBe(3)
    expect(s.wins).toBe(3)
    expect(s.streak).toBe(3)
    expect(s.maxStreak).toBe(3)
    expect(s.histogram[3]).toBe(2)
    expect(s.histogram[4]).toBe(1)
    expect(s.firstPlayedDate).toBe('2026-11-01')
  })

  it('漏一天：连胜归零重计，最长连胜保持', () => {
    let s = emptyStats()
    for (const d of ['2026-11-01', '2026-11-02', '2026-11-03'])
      s = applyResult(s, { date: d, ...WIN })
    s = applyResult(s, { date: '2026-11-05', ...WIN })
    expect(s.streak).toBe(1)
    expect(s.maxStreak).toBe(3)
  })

  it('同日只计一次', () => {
    let s = emptyStats()
    s = applyResult(s, { date: '2026-11-01', ...WIN })
    const twice = applyResult(s, { date: '2026-11-01', ...WIN })
    expect(twice).toEqual(s)
  })

  it('败局日断连胜，次日胜从 1 重计', () => {
    let s = emptyStats()
    for (const d of ['2026-11-01', '2026-11-02'])
      s = applyResult(s, { date: d, ...WIN })
    expect(s.streak).toBe(2)
    s = applyResult(s, { date: '2026-11-03', won: false, usedTip: false, attempts: 6, durationMs: 30_000 })
    expect(s.streak).toBe(0)
    expect(s.wins).toBe(2)
    expect(s.played).toBe(3)
    s = applyResult(s, { date: '2026-11-04', ...WIN })
    expect(s.streak).toBe(1)
    expect(s.maxStreak).toBe(2)
  })

  it('无提示胜单独计数', () => {
    let s = emptyStats()
    s = applyResult(s, { date: '2026-11-01', ...WIN })
    s = applyResult(s, { date: '2026-11-02', won: true, usedTip: true, attempts: 5, durationMs: 10_000 })
    expect(s.wins).toBe(2)
    expect(s.noHintWins).toBe(1)
  })

  it('本地快照（上报维度，不可信）', () => {
    let s = emptyStats()
    s = applyResult(s, { date: '2026-11-01', ...WIN })
    s = applyResult(s, { date: '2026-11-02', ...WIN })
    expect(localSnapshot(s, '2026-11-02')).toEqual({
      played: 2,
      streak: 2,
      winRate: 1,
      firstPlayedAt: '2026-11-01',
    })
  })
})
