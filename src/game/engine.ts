import { isCjkWord, isHit, normalize } from './match'
import { attemptsOf, isCorrectLength, revealedAfter } from './rules'
import type { Puzzle, PuzzleType } from './types'

/** 对局状态——纯数据，可整体序列化进 localStorage（design D4）。 */
export interface GameState {
  dayIndex: number
  /** 已猜错的词（猜中的词不入列，§4.2 历史区只列错词） */
  guesses: string[]
  /** 已亮提示数 */
  revealed: number
  usedTip: boolean
  startedAt: number
  status: 'playing' | 'win' | 'lose'
}

export type RejectReason = 'length' | 'charset' | 'duplicate'

export type StepEvent =
  | { type: 'rejected'; reason: RejectReason }
  | { type: 'wrong'; remaining: number; newHint: boolean }
  | { type: 'win'; attempts: number; hintsUsed: number; usedTip: boolean }
  | { type: 'lose' }

export type TipEvent = { type: 'tip' } | { type: 'tipUnavailable' }

export interface StepResult {
  state: GameState
  event: StepEvent
}

export function createGame(dayIndex: number, now: number = Date.now()): GameState {
  return {
    dayIndex,
    guesses: [],
    revealed: 1,
    usedTip: false,
    startedAt: now,
    status: 'playing',
  }
}

/**
 * 提交一次猜测。三条本地校验（字数/字符集/重复）不扣次数不亮提示；
 * 猜错扣 1 次机会并按揭示序列亮提示；机会用尽判负。
 */
export function submitGuess(
  state: GameState,
  raw: string,
  puzzle: Puzzle,
  type: PuzzleType,
): StepResult {
  if (state.status !== 'playing')
    throw new Error('对局已结束')

  const guess = normalize(raw)
  if (!isCjkWord(guess))
    return { state, event: { type: 'rejected', reason: 'charset' } }
  if (!isCorrectLength(guess, puzzle))
    return { state, event: { type: 'rejected', reason: 'length' } }
  if (state.guesses.some((g) => normalize(g) === guess))
    return { state, event: { type: 'rejected', reason: 'duplicate' } }

  const attempts = attemptsOf(puzzle, type)

  if (isHit(guess, puzzle)) {
    const next = { ...state, status: 'win' as const }
    return {
      state: next,
      event: { type: 'win', attempts: state.guesses.length + 1, hintsUsed: state.revealed, usedTip: state.usedTip },
    }
  }

  const guesses = [...state.guesses, guess]
  const wrongCount = guesses.length
  // 已亮数只增不减：先用过锦囊（revealed = hintCount）后猜错，不得缩回
  const revealed = Math.max(state.revealed, revealedAfter(wrongCount, attempts))
  const next: GameState = { ...state, guesses, revealed }

  if (wrongCount >= attempts)
    return { state: { ...next, status: 'lose' }, event: { type: 'lose' } }

  return {
    state: next,
    event: { type: 'wrong', remaining: attempts - wrongCount, newHint: revealed > state.revealed },
  }
}

/**
 * 锦囊：全局一次，多亮出一条提示（不一次全放），不扣机会，计入提示数。
 * 已用或对局已结束时不产生任何变化。
 */
export function useTip(
  state: GameState,
  type: PuzzleType,
): { state: GameState; event: TipEvent } {
  if (state.status !== 'playing' || state.usedTip)
    return { state, event: { type: 'tipUnavailable' } }
  return {
    state: { ...state, revealed: Math.min(state.revealed + 1, type.hintCount), usedTip: true },
    event: { type: 'tip' },
  }
}
