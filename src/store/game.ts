/**
 * 应用组装层：引擎（纯函数）× 持久化 × 上报 在此汇合。
 * UI 组件只读本 store，不直接触碰引擎与 localStorage。
 */
import { computed, reactive, readonly } from 'vue'
import { createGame, submitGuess, useTip, type GameState, type StepEvent, type TipEvent } from '@/game/engine'
import { EPOCH_DATE, dayIndexOf, parseDate, shanghaiToday } from '@/game/schedule'
import { puzzleIndexOfDay } from '@/game/order'
import { attemptsOf } from '@/game/rules'
import { shareText, type ShareInfo } from '@/game/share'
import { loadPuzzles, typeOf } from '@/data/loader'
import type { Puzzle, PuzzleType } from '@/game/types'
import { getClientId, loadDay, loadStats, saveDay, saveStats, type DayRecord, type Stats } from './persistence'
import { applyResult, localSnapshot } from './stats'
import { emitGameEnd, shouldReport } from '@/report'

type Phase = 'loading' | 'error' | 'home' | 'playing' | 'result'

interface Store {
  phase: Phase
  /** 加载/运行错误信息 */
  error: string
  /** URL 调试模式（?d= / ?word=）：内存态、不写存储、不计分、不上报 */
  debug: boolean
  dayIndex: number
  date: string
  puzzle: Puzzle | null
  type: PuzzleType | null
  record: DayRecord | null
  stats: Stats
  /** 最近一次引擎事件，驱动抖动/拒绝提示 */
  lastEvent: StepEvent | TipEvent | { type: 'none' }
}

const DAY_MS = 86400000

/** dayIndex → 对应的上海日历日（YYYY-MM-DD）。 */
function dateForDayIndex(dayIndex: number): string {
  return new Date(parseDate(EPOCH_DATE) + dayIndex * DAY_MS).toISOString().slice(0, 10)
}

const state = reactive<Store>({
  phase: 'loading',
  error: '',
  debug: false,
  dayIndex: 0,
  date: '',
  puzzle: null,
  type: null,
  record: null,
  stats: loadStats(),
  lastEvent: { type: 'none' },
})

/** record ↔ 引擎状态互转（DayRecord 是 GameState 的持久化超集） */
function toGameState(rec: DayRecord): GameState {
  return {
    dayIndex: rec.dayIndex,
    guesses: rec.guesses,
    revealed: rec.revealed,
    usedTip: rec.usedTip,
    startedAt: rec.startedAt,
    status: rec.status,
  }
}

function persist(): void {
  if (!state.debug && state.record)
    saveDay(state.record)
}

function settle(next: GameState, event: StepEvent): void {
  const rec = state.record!
  rec.status = next.status
  rec.revealed = next.revealed
  rec.guesses = next.guesses

  if (event.type === 'win' || event.type === 'lose') {
    // 记分板：一局结束才 +1（stats.applyResult 内含同日去重）
    state.stats = applyResult(state.stats, {
      date: rec.date,
      won: event.type === 'win',
      usedTip: rec.usedTip,
      attempts: event.type === 'win' ? event.attempts : rec.guesses.length,
      durationMs: Date.now() - rec.startedAt,
    })
    if (!state.debug)
      saveStats(state.stats)

    // 匿名上报：同日一次；无 reporter 时零网络请求
    if (shouldReport(rec)) {
      emitGameEnd({
        dayIndex: rec.dayIndex,
        date: rec.date,
        clientId: getClientId(),
        puzzle: { type: state.puzzle!.type, difficulty: state.puzzle!.difficulty },
        result: event.type === 'win' ? 'win' : 'lose',
        attempts: event.type === 'win' ? event.attempts : rec.guesses.length,
        hintsUsed: rec.revealed,
        usedTip: rec.usedTip,
        durationSec: Math.round((Date.now() - rec.startedAt) / 1000),
        local: localSnapshot(state.stats, rec.date),
      })
      rec.reported = true
    }
    state.phase = 'result'
  }
  persist()
}

export function useGame() {
  async function init() {
    state.phase = 'loading'
    try {
      const bank = await loadPuzzles()
      if (bank.length === 0)
        throw new Error('题库为空')

      const params = new URLSearchParams(window.location.search)
      const dParam = params.get('d')
      const wordParam = params.get('word')
      state.debug = dParam !== null || wordParam !== null

      const today = shanghaiToday()
      state.date = today
      state.dayIndex = dParam !== null ? Math.max(0, Number(dParam) || 0) : dayIndexOf(today)
      if (state.date !== dateForDayIndex(state.dayIndex))
        state.date = dateForDayIndex(state.dayIndex) // 调试历史日时以该日为存储键

      state.puzzle = bank[puzzleIndexOfDay(state.dayIndex, bank.length)]
      if (wordParam)
        state.puzzle = { ...state.puzzle, answer: wordParam } // 调试：指定答案
      state.type = typeOf(state.puzzle)

      state.record = loadDay(state.date) ?? null
      state.phase
        = state.record?.status === 'playing' ? 'playing'
          : state.record ? 'result'
            : 'home'
    }
    catch (e) {
      state.error = e instanceof Error ? e.message : String(e)
      state.phase = 'error'
    }
  }

  function start() {
    if (!state.puzzle || !state.type)
      return
    if (!state.record) {
      state.record = {
        ...createGame(state.dayIndex),
        v: 1,
        date: state.date,
        reported: false,
      }
      persist()
    }
    // 已玩完的日 子从首页「查看今日结果」直达结算页（§4.1）
    state.phase = state.record.status === 'playing' ? 'playing' : 'result'
  }

  function guess(raw: string): void {
    if (!state.record || !state.puzzle || !state.type || state.record.status !== 'playing')
      return
    const { state: next, event } = submitGuess(toGameState(state.record), raw, state.puzzle, state.type)
    state.record = { ...state.record, ...next, reported: state.record.reported }
    state.lastEvent = event
    settle(next, event)
  }

  function tip(): void {
    if (!state.record || !state.puzzle || !state.type || state.record.status !== 'playing')
      return
    const { state: next, event } = useTip(toGameState(state.record), state.type)
    state.record = { ...state.record, ...next, reported: state.record.reported }
    state.lastEvent = event
    persist()
  }

  function backHome(): void {
    state.phase = 'home'
  }

  // ---- 派生数据 ----

  const revealedHints = computed(() =>
    state.puzzle ? state.puzzle.tags.slice(0, state.record?.revealed ?? 0) : [],
  )
  const attemptsMax = computed(() =>
    state.puzzle && state.type ? attemptsOf(state.puzzle, state.type) : 6,
  )
  const attemptsUsed = computed(() => state.record?.guesses.length ?? 0)
  const remaining = computed(() => Math.max(0, attemptsMax.value - attemptsUsed.value))

  function buildShare(): string {
    if (!state.puzzle || !state.record)
      return ''
    const info: ShareInfo = {
      dayIndex: state.dayIndex,
      won: state.record.status === 'win',
      attempts: state.record.guesses.length + (state.record.status === 'win' ? 1 : 0),
      attemptsMax: attemptsMax.value,
      hintsUsed: state.record.revealed,
      streak: state.stats.streak,
      revealedHints: revealedHints.value,
    }
    return shareText(info)
  }

  return {
    state: readonly(state),
    init,
    start,
    guess,
    tip,
    backHome,
    revealedHints,
    attemptsMax,
    attemptsUsed,
    remaining,
    buildShare,
    /** 供占位条渲染：未亮的提示槽位总数 */
    totalHints: computed(() => state.type?.hintCount ?? 0),
  }
}
