import { describe, expect, it } from 'vitest'
import bankJson from '../public/data/puzzles.json'
import epochsJson from '../public/data/epochs.json'
import { typeOf, validateEpochs } from '@/data/loader'
import type { Puzzle } from '@/game/types'

const bank = bankJson as Puzzle[]
const meta = epochsJson as { epochDate: string; epochs: { since: number; size: number }[] }

describe('脚手架与题库冒烟', () => {
  it('题库非空且与排期元数据一致', () => {
    expect(bank.length).toBeGreaterThan(0)
    validateEpochs(meta.epochs)
    expect(/^\d{4}-\d{2}-\d{2}$/.test(meta.epochDate)).toBe(true)
    expect(meta.epochs[meta.epochs.length - 1].size).toBe(bank.length)
  })

  it('题库仅含已注册题型且题型计数相符', () => {
    const idiom = bank.filter((p) => p.type === 'idiom').length
    const figure = bank.filter((p) => p.type === 'figure').length
    expect(idiom + figure).toBe(bank.length)
    expect(idiom).toBeGreaterThan(0)
    expect(figure).toBeGreaterThan(0)
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
