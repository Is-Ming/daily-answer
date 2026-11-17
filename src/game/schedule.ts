/**
 * 日期 → dayIndex（design D7）。
 *
 * 一律按 Asia/Shanghai 日历日计算，倒计时指向上海时间次日零点，
 * 避免海外用户提前换题导致分享的答案对不上。
 *
 * 纪元日不在此处写死：由调用方从产物 epochs.json 的 epochDate 注入，
 * 保证构建器（Python）与前端共用同一数据源。
 */

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

/** 上海日历日 → dayIndex（纪元日前钳制为 0）。epochDate 由装配层注入。 */
export function dayIndexOf(dateStr: string, epochDate: string): number {
  return Math.max(0, Math.round((parseDate(dateStr) - parseDate(epochDate)) / DAY_MS))
}

/** dayIndex → 对应的上海日历日（YYYY-MM-DD）。epochDate 由装配层注入。 */
export function dateOfIndex(dayIndex: number, epochDate: string): string {
  return new Date(parseDate(epochDate) + dayIndex * DAY_MS).toISOString().slice(0, 10)
}

/** 距上海时间次日零点的毫秒数（结算页倒计时用）。上海无夏令时，固定 UTC+8。 */
export function msToNextShanghaiMidnight(now: number = Date.now()): number {
  const nextMidnightShanghai = parseDate(shanghaiToday(now + DAY_MS)) - 8 * 3600000
  return nextMidnightShanghai - now
}
