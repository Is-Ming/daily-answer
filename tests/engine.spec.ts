import { describe, expect, it } from 'vitest'
import { createGame, submitGuess, useTip } from '@/game/engine'
import { isCjkWord, isHit, normalize } from '@/game/match'
import type { Puzzle, PuzzleType } from '@/game/types'

const IDIOM: PuzzleType = {
  id: 'idiom', label: '成语', attempts: 6, hintCount: 7, answerLen: [4, 4], showLen: true, allowAliases: false,
}
const FIGURE: PuzzleType = {
  id: 'figure', label: '历史人物', attempts: 7, hintCount: 8, answerLen: [2, 4], showLen: true, allowAliases: true,
}

function mkPuzzle(partial: Partial<Puzzle>): Puzzle {
  return {
    type: 'idiom', answer: '破釜沉舟', pinyin: [], banned: [],
    tags: Array.from({ length: 7 }, (_, i) => ({ word: `词${i}`, note: '注' })),
    source: '', summary: '', gloss: '', story: '', glossSource: '',
    difficulty: 2, difficultyBasis: '',
    ...partial,
  }
}

const IDIOM_PUZZLE = mkPuzzle({})
const FIGURE_PUZZLE = mkPuzzle({
  type: 'figure', answer: '曹操', aliases: ['孟德'], altNames: ['曹孟德'], nameLen: 2, attempts: 7,
})

/** 连续猜错 n 次的辅助（每轮换不同错词，避免触发重复拒绝） */
const WRONG_WORDS = ['画蛇添足', '对牛弹琴', '狐假虎威', '守株待兔', '井底之蛙', '叶公好龙', '指鹿为马']
function wrongN(state = createGame(0), puzzle = IDIOM_PUZZLE, type = IDIOM, n = 1) {
  let cur = state
  for (let i = 0; i < n; i++)
    cur = submitGuess(cur, WRONG_WORDS[(cur.guesses.length) % WRONG_WORDS.length], puzzle, type).state
  return cur
}

describe('输入三校验（均不扣次数不亮提示）', () => {
  it('字数不符', () => {
    const s = createGame(0)
    const { state, event } = submitGuess(s, '破釜', IDIOM_PUZZLE, IDIOM)
    expect(event).toEqual({ type: 'rejected', reason: 'length' })
    expect(state).toEqual(s)
  })

  it('非中文字符', () => {
    const s = createGame(0)
    const { state, event } = submitGuess(s, 'abcd', IDIOM_PUZZLE, IDIOM)
    expect(event).toEqual({ type: 'rejected', reason: 'charset' })
    expect(state).toEqual(s)
  })

  it('重复猜测', () => {
    const s = wrongN(createGame(0), IDIOM_PUZZLE, IDIOM, 1)
    const { state, event } = submitGuess(s, '画蛇添足', IDIOM_PUZZLE, IDIOM)
    expect(event).toEqual({ type: 'rejected', reason: 'duplicate' })
    expect(state).toEqual(s)
  })
})

describe('提示揭示序列', () => {
  it('开局亮 1 条；每错一条；上界为 attempts 而非 hintCount', () => {
    expect(createGame(0).revealed).toBe(1)
    const s5 = wrongN(createGame(0), IDIOM_PUZZLE, IDIOM, 5)
    expect(s5.revealed).toBe(6)
    expect(s5.status).toBe('playing')
    // 第 6 次错：判负，揭示数仍为 6（第 7 条只能靠锦囊）
    const s6 = wrongN(s5, IDIOM_PUZZLE, IDIOM, 1)
    expect(s6.status).toBe('lose')
    expect(s6.revealed).toBe(6)
  })

  it('第 3 次猜中：胜，attempts=3，hintsUsed=3', () => {
    let s = wrongN(createGame(0), IDIOM_PUZZLE, IDIOM, 2)
    const { state, event } = submitGuess(s, '破釜沉舟', IDIOM_PUZZLE, IDIOM)
    expect(state.status).toBe('win')
    expect(event).toEqual({ type: 'win', attempts: 3, hintsUsed: 3, usedTip: false })
    s = state
    expect(s.guesses).toHaveLength(2) // 猜中的词不入错词表
  })
})

describe('锦囊', () => {
  it('只多亮出一条、不扣机会、只此一次', () => {
    let r = useTip(createGame(0), IDIOM)
    expect(r.event).toEqual({ type: 'tip' })
    expect(r.state.revealed).toBe(2)
    expect(r.state.usedTip).toBe(true)
    r = useTip(r.state, IDIOM)
    expect(r.event).toEqual({ type: 'tipUnavailable' })
  })

  it('用锦囊后再猜错，揭示序列正常推进不缩回', () => {
    const tipped = useTip(createGame(0), IDIOM).state
    expect(tipped.revealed).toBe(2)
    const s = wrongN(tipped, IDIOM_PUZZLE, IDIOM, 2)
    // 第 1 错 → min(2,6)=2，第 2 错 → min(3,6)=3
    expect(s.revealed).toBe(3)
    expect(s.status).toBe('playing')
  })

  it('用锦囊后获胜：usedTip=true，hintsUsed 计入锦囊那条', () => {
    const tipped = useTip(createGame(0), IDIOM).state
    const { event } = submitGuess(tipped, '破釜沉舟', IDIOM_PUZZLE, IDIOM)
    expect(event).toEqual({ type: 'win', attempts: 1, hintsUsed: 2, usedTip: true })
  })
})

describe('别名判定（人物题）', () => {
  it('等长别名判胜', () => {
    const { state, event } = submitGuess(createGame(0), '孟德', FIGURE_PUZZLE, FIGURE)
    expect(state.status).toBe('win')
    expect(event.type).toBe('win')
  })

  it('不等长别名（altNames）被长度闸门拒绝且不扣次数', () => {
    const s = createGame(0)
    const { state, event } = submitGuess(s, '曹孟德', FIGURE_PUZZLE, FIGURE)
    expect(event).toEqual({ type: 'rejected', reason: 'length' })
    expect(state).toEqual(s)
  })
})

describe('match 归一化', () => {
  it('空白与全角被归一', () => {
    expect(normalize(' 破釜 沉舟\u3000')).toBe('破釜沉舟')
  })

  it('带空白的正确答案命中', () => {
    expect(isHit(' 破釜 沉舟 ', IDIOM_PUZZLE)).toBe(true)
  })

  it('isCjkWord', () => {
    expect(isCjkWord('破釜沉舟')).toBe(true)
    expect(isCjkWord('abc')).toBe(false)
    expect(isCjkWord('')).toBe(false)
  })
})
