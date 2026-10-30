import { describe, expect, it } from 'vitest'
import bankJson from '../public/data/puzzles.json'
import { typeOf } from '@/data/loader'
import type { Puzzle } from '@/game/types'

const bank = bankJson as Puzzle[]

describe('脚手架与题库冒烟', () => {
  it('题库为 95 题（成语 70 + 人物 25）', () => {
    expect(bank).toHaveLength(95)
    expect(bank.filter((p) => p.type === 'idiom')).toHaveLength(70)
    expect(bank.filter((p) => p.type === 'figure')).toHaveLength(25)
  })

  it('题型注册表覆盖题库中出现的所有题型', () => {
    for (const p of bank) {
      const t = typeOf(p)
      expect(t.attempts).toBeGreaterThan(0)
      expect(t.hintCount).toBe(t.attempts + 1)
    }
  })

  it('人物题成品别名全部与答案等长', () => {
    for (const p of bank.filter((x) => x.type === 'figure')) {
      for (const a of p.aliases ?? []) {
        expect(a).toHaveLength(p.nameLen!)
      }
      for (const a of p.altNames ?? []) {
        expect(a).not.toHaveLength(p.nameLen!)
      }
    }
  })
})
