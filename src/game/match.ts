import type { Puzzle } from './types'

/**
 * 归一化：去全部空白（含全角空格）+ NFKC（全角转半角）。
 * 玩家输入的不可控空白不应导致误判。
 */
export function normalize(input: string): string {
  return input.normalize('NFKC').replace(/\s+/g, '')
}

/** 全部为中文字符（输入校验之一，不满足不扣次数）。 */
export function isCjkWord(s: string): boolean {
  return s.length > 0 && /^[\u4e00-\u9fff]+$/.test(s)
}

/** 是否命中：全名或等长别名（aliases）完全一致；altNames 不参与判定。 */
export function isHit(guess: string, puzzle: Puzzle): boolean {
  const g = normalize(guess)
  if (g === normalize(puzzle.answer))
    return true
  return (puzzle.aliases ?? []).some((a) => normalize(a) === g)
}

export type CharState = 'exact' | 'misplaced' | 'none'

/**
 * 逐字判定（Wordle 语义，棋盘行着色用）：
 * exact = 与答案该位置相同（绿）；misplaced = 字在答案中但位置不对（橙）；none = 没有（灰）。
 * 重复字按标准算法：先锁定 exact，剩余答案字符按序配额给 misplaced。
 */
export function judgeWord(guess: string, answer: string): CharState[] {
  const states: CharState[] = Array.from({ length: guess.length }, () => 'none')
  const rest: Record<string, number> = {}
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) {
      states[i] = 'exact'
    }
    else {
      rest[answer[i]] = (rest[answer[i]] ?? 0) + 1
    }
  }
  for (let i = 0; i < guess.length; i++) {
    if (states[i] === 'exact')
      continue
    const ch = guess[i]
    if ((rest[ch] ?? 0) > 0) {
      states[i] = 'misplaced'
      rest[ch]--
    }
  }
  return states
}
