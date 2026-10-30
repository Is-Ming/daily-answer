/**
 * 匿名统计上报接缝（design D5、spec stats-reporting）。
 *
 * 本仓库只保留事件出口与运行时探测，零上报实现：
 * 部署机由 ming-hub 私有仓库提供 public/report.js，注册
 * window.__midiReporter 并负责组装 §5.3 payload 与 POST（含失败重试 1 次）。
 * 探测不到（开源克隆部署）→ 什么也不发生，游戏功能零影响。
 */
import type { DayRecord } from '@/store/persistence'

/** 对局结束上下文：原始游戏数据，wire 格式由部署机私有脚本决定。 */
export interface GameEndContext {
  dayIndex: number
  date: string
  clientId: string
  puzzle: { type: string; difficulty: number }
  result: 'win' | 'lose'
  attempts: number
  hintsUsed: number
  usedTip: boolean
  durationSec: number
  local: {
    played: number
    streak: number
    winRate: number
    firstPlayedAt: string
  }
}

export type MidiReporter = (ctx: GameEndContext) => void

declare global {
  interface Window {
    // 由部署机的 public/report.js 注入（ming-hub 私有仓库，见 README）
    __midiReporter?: MidiReporter
  }
}

export function detectReporter(): MidiReporter | undefined {
  const r = (globalThis as { __midiReporter?: MidiReporter }).__midiReporter
  return typeof r === 'function' ? r : undefined
}

/** 对局结束：有 reporter 则交给它，无则什么也不发生。绝不抛错。 */
export function emitGameEnd(ctx: GameEndContext): void {
  try {
    detectReporter()?.(ctx)
  }
  catch {
    // 上报失败静默：不影响游戏
  }
}

/** 同日只上报一次（服务端唯一索引兜底，这里省流量）。 */
export function shouldReport(record: DayRecord): boolean {
  return record.status !== 'playing' && !record.reported
}
