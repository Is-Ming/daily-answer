/**
 * 日期 → dayIndex（design D7）。
 *
 * 一律按 Asia/Shanghai 日历日计算，倒计时指向上海时间次日零点，
 * 避免海外用户提前换题导致分享的答案对不上。
 */

/** 纪元日：第 0 天（首题上线日）。2026-10-30 实际上线日（当初按 11-01 规划，提前上线改为真实日期）。 */
export const EPOCH_DATE = '2026-10-30'

const DAY_MS = 86400000

/** 上海时区的今日日期串（YYYY-MM-DD）。 */
export function shanghaiToday(now: number = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(now))
}

/** 'YYYY-MM-DD' → UTC 零点毫秒（纯日期运算，与时区无关）。 */
export function parseDate(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** a → b 相差的天数（b 在后为正）。 */
export function dateDiffDays(a: string, b: string): number {
  return Math.round((parseDate(b) - parseDate(a)) / DAY_MS)
}

/** 上海日历日 → dayIndex（纪元日前钳制为 0）。 */
export function dayIndexOf(dateStr: string = shanghaiToday()): number {
  return Math.max(0, Math.round((parseDate(dateStr) - parseDate(EPOCH_DATE)) / DAY_MS))
}

/** 距上海时间次日零点的毫秒数（结算页倒计时用）。上海无夏令时，固定 UTC+8。 */
export function msToNextShanghaiMidnight(now: number = Date.now()): number {
  const nextMidnightShanghai = parseDate(shanghaiToday(now + DAY_MS)) - 8 * 3600000
  return nextMidnightShanghai - now
}
