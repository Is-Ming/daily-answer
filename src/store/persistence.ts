/**
 * localStorage 持久化（design D8、spec player-progress）。
 *
 * 键设计（设计文档 §4.4）：
 *   ma:clientId     随机 UUID，首次生成，匿名去重
 *   ma:stats        记分板
 *   ma:prefs        偏好（暗色模式等）
 *   ma:day:<日期>   当日进度
 *
 * schema 携带版本号 v；读到不认识的旧版本走迁移钩子（v1 起步，
 * 当前策略：丢弃重置，不抛错）。
 */

const KEY_CLIENT = 'ma:clientId'
const KEY_STATS = 'ma:stats'
const KEY_PREFS = 'ma:prefs'
const keyDay = (date: string) => `ma:day:${date}`

export const SCHEMA_VERSION = 1

export interface DayRecord {
  v: number
  dayIndex: number
  date: string
  guesses: string[]
  revealed: number
  usedTip: boolean
  startedAt: number
  status: 'playing' | 'win' | 'lose'
  reported: boolean
}

export interface Stats {
  v: number
  played: number
  wins: number
  noHintWins: number
  streak: number
  maxStreak: number
  totalDurationMs: number
  /** 直方图下标 = 猜中所用次数（1 起） */
  histogram: number[]
  firstPlayedDate?: string
  lastPlayedDate?: string
}

export interface Prefs {
  v: number
  theme: 'auto' | 'light' | 'dark'
}

// ---- 底层安全封装（隐私模式/禁用 localStorage 时不抛错） ----

function readJson(key: string): unknown | undefined {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : undefined
  }
  catch {
    return undefined
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  }
  catch {
    // 存储不可用时静默降级：游戏功能不依赖持久化
  }
}

/** 版本迁移钩子：非当前版本一律重置（v1 起步，无历史负担）。 */
function migrate<T>(parsed: unknown, fallback: T): T {
  if (parsed && typeof parsed === 'object' && (parsed as { v?: number }).v === SCHEMA_VERSION)
    return parsed as T
  return fallback
}

// ---- clientId ----

export function getClientId(): string {
  let id = readJson(KEY_CLIENT) as string | undefined
  if (!id || typeof id !== 'string') {
    id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `cid-${Date.now()}-${Math.random().toString(36).slice(2)}`
    writeJson(KEY_CLIENT, id)
  }
  return id
}

// ---- 当日进度 ----

export function loadDay(date: string): DayRecord | undefined {
  const parsed = readJson(keyDay(date))
  if (!parsed)
    return undefined
  const rec = migrate<DayRecord | undefined>(parsed, undefined)
  if (!rec)
    return undefined
  // 字段健全性兜底
  if (typeof rec.dayIndex !== 'number' || !Array.isArray(rec.guesses))
    return undefined
  return rec
}

export function saveDay(record: DayRecord): void {
  writeJson(keyDay(record.date), record)
}

// ---- 记分板 ----

export function emptyStats(): Stats {
  return {
    v: SCHEMA_VERSION,
    played: 0,
    wins: 0,
    noHintWins: 0,
    streak: 0,
    maxStreak: 0,
    totalDurationMs: 0,
    histogram: [],
  }
}

export function loadStats(): Stats {
  return migrate(readJson(KEY_STATS), emptyStats())
}

export function saveStats(stats: Stats): void {
  writeJson(KEY_STATS, stats)
}

// ---- 偏好 ----

export function loadPrefs(): Prefs {
  return migrate(readJson(KEY_PREFS), { v: SCHEMA_VERSION, theme: 'auto' })
}

export function savePrefs(prefs: Prefs): void {
  writeJson(KEY_PREFS, prefs)
}
