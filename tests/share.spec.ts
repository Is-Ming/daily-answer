import { describe, expect, it } from 'vitest'
import { shareText, SITE_URL } from '@/game/share'

const hints = [
  { word: '秦末', note: '年代' },
  { word: '凿船', note: '字面' },
]

describe('分享文案（§7）', () => {
  it('胜利：次数/上限 + 提示数 + 连胜 + 已亮提示 + 地址，不含答案', () => {
    const text = shareText({
      dayIndex: 41, won: true, attempts: 3, attemptsMax: 6,
      hintsUsed: 2, streak: 5, revealedHints: hints.slice(0, 2),
    })
    const lines = text.split('\n')
    expect(lines[0]).toBe('谜底 #42 3/6 💡×2 🔥5')
    expect(lines[2]).toBe('秦末')
    expect(lines[3]).toBe('凿船')
    expect(lines[lines.length - 1]).toBe(SITE_URL)
    expect(text).not.toContain('破釜沉舟')
    expect(text).not.toContain('note')
  })

  it('失败：结果为 X，只含已亮出的提示', () => {
    const text = shareText({
      dayIndex: 0, won: false, attempts: 6, attemptsMax: 6,
      hintsUsed: 6, streak: 0, revealedHints: [{ word: '秦末', note: '' }],
    })
    expect(text).toContain('谜底 #1 X/6 💡×6 🔥0')
    expect(text).toContain('秦末')
  })

  it('未亮的提示绝不出现', () => {
    const all = [
      { word: '秦末', note: '' },
      { word: '巨鹿', note: '' },
      { word: '砸锅', note: '' },
    ]
    const text = shareText({
      dayIndex: 0, won: true, attempts: 1, attemptsMax: 6,
      hintsUsed: 1, streak: 1, revealedHints: all.slice(0, 1),
    })
    expect(text).toContain('秦末')
    expect(text).not.toContain('巨鹿')
    expect(text).not.toContain('砸锅')
  })
})
