import type { HintTag } from './types'

export const SITE_URL = 'himing.xyz/game/answer'

export interface ShareInfo {
  /** 期号（dayIndex + 1，第 1 天 = #1） */
  dayIndex: number
  won: boolean
  /** 使用的猜测次数（失败为 0 → 显示 X） */
  attempts: number
  attemptsMax: number
  /** 已亮提示数（含开局第 1 条，无提示获胜 = 1） */
  hintsUsed: number
  streak: number
  /** 仅已亮出的提示（防剧透：不含未亮的） */
  revealedHints: HintTag[]
}

/** 设计文档 §7 分享文案。不含答案、不含未亮的提示。 */
export function shareText(info: ShareInfo): string {
  const result = info.won ? `${info.attempts}/${info.attemptsMax}` : `X/${info.attemptsMax}`
  const lines = [
    `谜底 #${info.dayIndex + 1} ${result} 💡×${info.hintsUsed} 🔥${info.streak}`,
    '',
    ...info.revealedHints.map((h) => h.word),
    '',
    SITE_URL,
  ]
  return lines.join('\n')
}
