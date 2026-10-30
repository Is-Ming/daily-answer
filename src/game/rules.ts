import type { Puzzle, PuzzleType } from './types'

/** 实际生效的机会数（人物题条目自带 attempts 覆盖注册表默认值）。 */
export function attemptsOf(puzzle: Puzzle, type: PuzzleType): number {
  return puzzle.attempts ?? type.attempts
}

/** 自然揭示上界 = 机会数（不是提示总数）：最后一条只能靠锦囊（design D4）。 */
export function revealedAfter(wrongCount: number, attempts: number): number {
  return Math.min(1 + wrongCount, attempts)
}

/** 输入校验：字数必须等于答案长度（字数方框数）。 */
export function isCorrectLength(guess: string, puzzle: Puzzle): boolean {
  return guess.length === puzzle.answer.length
}
