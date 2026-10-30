/** 题库条目（public/data/puzzles.json 的元素，由 tools/build_bank.py 产出） */
export interface HintTag {
  word: string
  note: string
}

export interface Puzzle {
  type: string
  answer: string
  pinyin: string[]
  banned: string[]
  tags: HintTag[]
  source: string
  summary: string
  gloss: string
  story: string
  glossSource: string
  difficulty: number
  difficultyBasis: string
  /** 人物题：与答案等长、参与判赢的别名 */
  aliases?: string[]
  /** 人物题：本名/字号/外文全名，仅结算页展示 */
  altNames?: string[]
  nameLen?: number
  attempts?: number
}

/** 题型注册表条目（src/data/types.json，§2.4） */
export interface PuzzleType {
  id: string
  label: string
  attempts: number
  hintCount: number
  answerLen: [number, number]
  showLen: boolean
  allowAliases: boolean
}
