import { dateDiffDays } from '@/game/schedule'
import { SCHEMA_VERSION, type Stats } from './persistence'

/** 结算一条战绩（spec player-progress）。
 *
 * 计数规则：一局结束才 +1（调用方保证只在 status 变为 win/lose 时调用
 * 一次）；同日重复结算不重复计；与上次游玩不连续（漏天）则连胜归零。
 */
export function applyResult(
  stats: Stats,
  info: { date: string; won: boolean; usedTip: boolean; attempts: number; durationMs: number },
): Stats {
  if (stats.lastPlayedDate === info.date)
    return stats // 同日只计一次

  // 连胜（Wordle 惯例）：连胜日必须是胜局；败局或漏天都断
  const gap = stats.lastPlayedDate ? dateDiffDays(stats.lastPlayedDate, info.date) : 0
  const streak = info.won ? (gap === 1 ? stats.streak + 1 : 1) : 0

  const histogram = [...stats.histogram]
  if (info.won)
    histogram[info.attempts] = (histogram[info.attempts] ?? 0) + 1

  return {
    v: SCHEMA_VERSION,
    played: stats.played + 1,
    wins: stats.wins + (info.won ? 1 : 0),
    noHintWins: stats.noHintWins + (info.won && !info.usedTip ? 1 : 0),
    streak,
    maxStreak: Math.max(stats.maxStreak, streak),
    totalDurationMs: stats.totalDurationMs + Math.max(0, info.durationMs),
    histogram,
    firstPlayedDate: stats.firstPlayedDate ?? info.date,
    lastPlayedDate: info.date,
  }
}

/** 本地快照（设计文档 §4.5，上报用，不可信仅作分析维度）。 */
export function localSnapshot(stats: Stats, date: string) {
  return {
    played: stats.played,
    streak: stats.streak,
    winRate: stats.played > 0 ? stats.wins / stats.played : 0,
    firstPlayedAt: stats.firstPlayedDate ?? date,
  }
}
