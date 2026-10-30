import { afterEach, describe, expect, it, vi } from 'vitest'
import { SCHEMA_VERSION, type DayRecord } from '@/store/persistence'
import { emitGameEnd, shouldReport } from '@/report'

function dayRecord(overrides: Partial<DayRecord> = {}): DayRecord {
  return {
    v: SCHEMA_VERSION, dayIndex: 0, date: '2026-11-01', guesses: [],
    revealed: 1, usedTip: false, startedAt: 0, status: 'playing', reported: false,
    ...overrides,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  delete (globalThis as { __midiReporter?: unknown }).__midiReporter
})

describe('上报接缝', () => {
  it('无 reporter：完整走一局零网络请求', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    // 引擎直接走一局（纯函数，本就不碰网络）
    emitGameEnd({
      dayIndex: 0, date: '2026-11-01', clientId: 'cid',
      puzzle: { type: 'idiom', difficulty: 2 },
      result: 'win', attempts: 3, hintsUsed: 3, usedTip: false,
      durationSec: 95,
      local: { played: 1, streak: 1, winRate: 1, firstPlayedAt: '2026-11-01' },
    })

    await new Promise(r => setTimeout(r, 10))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('有 reporter：收到完整上下文且只回调一次', () => {
    const report = vi.fn()
    ;(globalThis as { __midiReporter?: unknown }).__midiReporter = report

    const ctx = {
      dayIndex: 0, date: '2026-11-01', clientId: 'cid',
      puzzle: { type: 'idiom', difficulty: 2 },
      result: 'win' as const, attempts: 3, hintsUsed: 3, usedTip: false,
      durationSec: 95,
      local: { played: 1, streak: 1, winRate: 1, firstPlayedAt: '2026-11-01' },
    }
    emitGameEnd(ctx)
    emitGameEnd(ctx)
    expect(report).toHaveBeenCalledTimes(2) // 去重由 shouldReport + 服务端索引负责
    expect(report).toHaveBeenLastCalledWith(ctx)
  })

  it('reporter 抛错不影响调用方', () => {
    ;(globalThis as { __midiReporter?: unknown }).__midiReporter = () => {
      throw new Error('network down')
    }
    expect(() =>
      emitGameEnd({
        dayIndex: 0, date: '2026-11-01', clientId: 'cid',
        puzzle: { type: 'idiom', difficulty: 2 },
        result: 'lose', attempts: 6, hintsUsed: 6, usedTip: false, durationSec: 100,
        local: { played: 0, streak: 0, winRate: 0, firstPlayedAt: '2026-11-01' },
      }),
    ).not.toThrow()
  })

  it('同日只上报一次的判定', () => {
    expect(shouldReport(dayRecord())).toBe(false) // 还没结束
    expect(shouldReport(dayRecord({ status: 'win' }))).toBe(true)
    expect(shouldReport(dayRecord({ status: 'win', reported: true }))).toBe(false)
    expect(shouldReport(dayRecord({ status: 'lose', reported: true }))).toBe(false)
  })
})
