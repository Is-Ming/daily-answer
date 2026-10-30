import typesJson from './types.json'
import type { Puzzle, PuzzleType } from '@/game/types'

export const puzzleTypes = typesJson as PuzzleType[]

export function typeOf(puzzle: Puzzle): PuzzleType {
  const t = puzzleTypes.find((t) => t.id === puzzle.type)
  if (!t)
    throw new Error(`未注册的题型: ${puzzle.type}`)
  return t
}

/** 加载题库。失败抛错，由调用方渲染重试（没有题库游戏无法开始）。 */
export async function loadPuzzles(): Promise<Puzzle[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/puzzles.json`)
  if (!res.ok)
    throw new Error(`题库加载失败: HTTP ${res.status}`)
  return res.json() as Promise<Puzzle[]>
}
