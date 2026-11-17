import typesJson from './types.json'
import type { Puzzle, PuzzleType } from '@/game/types'
import type { Epoch } from '@/game/order'

export const puzzleTypes = typesJson as PuzzleType[]

/** 旧版产物兜底（与退役的历史常量一致） */
export const LEGACY_EPOCH_DATE = '2026-10-30'
export const LEGACY_EPOCHS: Epoch[] = [{ since: 0, size: 95 }]

/** 排期元数据：纪元日 + epoch 沿革表（来自 epochs.json） */
export interface ScheduleMeta {
  epochDate: string
  epochs: Epoch[]
}

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

/** epochs 结构校验（纯函数，防御畸形产物）。非法抛错。 */
export function validateEpochs(epochs: unknown): asserts epochs is Epoch[] {
  if (!Array.isArray(epochs) || epochs.length === 0)
    throw new Error('epochs 非法：不能为空')
  for (const e of epochs) {
    if (!Number.isInteger(e.since) || e.since < 0)
      throw new Error('epochs 非法：since 必须为非负整数')
    if (!Number.isInteger(e.size) || e.size < 1)
      throw new Error('epochs 非法：size 必须为正整数')
  }
  for (let i = 1; i < epochs.length; i++) {
    if (epochs[i].since <= epochs[i - 1].since)
      throw new Error('epochs 非法：since 必须严格递增')
  }
}

/** 解析排期元数据（纯函数）。非法抛错。 */
export function parseScheduleMeta(data: unknown): ScheduleMeta {
  if (typeof data !== 'object' || data === null)
    throw new Error('排期元数据非法')
  const { epochDate, epochs } = data as Record<string, unknown>
  if (typeof epochDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(epochDate))
    throw new Error('排期元数据非法：epochDate 必须为 YYYY-MM-DD')
  validateEpochs(epochs)
  return { epochDate, epochs }
}

/**
 * 加载排期元数据。epochs.json 缺失（旧版产物，HTTP 404）时按缺省值兜底；
 * 其余失败抛错，由调用方渲染重试。
 */
export async function loadScheduleMeta(): Promise<ScheduleMeta> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/epochs.json`)
  if (res.status === 404)
    return { epochDate: LEGACY_EPOCH_DATE, epochs: LEGACY_EPOCHS }
  if (!res.ok)
    throw new Error(`排期元数据加载失败: HTTP ${res.status}`)
  return parseScheduleMeta(await res.json())
}
