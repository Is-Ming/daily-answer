# 谜底 · 每日一猜

> 看一组两字提示词，猜今日唯一答案。成语、历史人物，一天一题，全网同题。

**在线体验：<https://himing.xyz/game/answer/>**

---

## 玩法

- 每天一题，全网统一，次日零点换题。
- 玩法灵感来自《中国成语大会》的「双音节对抗」环节。
- 开局亮 1 条两字提示词；每猜错一次多亮一条；用完机会即失败。
- 答案只有两种：成语（6 次机会、7 条提示），或者历史人物（7 次机会、8 条提示、显示字数）。
- 字数从开局就告诉你（字数方框），只接受完整全名（人物题别名也算中）。
- 卡住可以点「锦囊」要最后一条提示，不消耗机会，但计入战绩（「无提示获胜」作废）。
- 题目按难度分五级，一星最易，五星最难。
- 猜中或失败后，结算页有答案科普（总述/释义/典故/出处）、提示回放与一键分享。

## 技术栈与硬约束

- Vite + Vue 3 + TypeScript，运行时零第三方依赖（Vue 本身除外，不引 UI 库/路由/工具库），样式手写 CSS。
- JS + CSS gzip 控制在 150KB 以内（当前约 45KB）。
- 构建产物是纯静态文件，`base: './'` 相对路径，可挂载在任意子路径。
- 换题一律按北京时间（Asia/Shanghai）的日期计算，避免海外用户提前换题。
- 游戏规则全部是 `src/game/` 下的纯函数（零 DOM / 零持久化），vitest 全覆盖。
- 本仓库不包含任何上报/统计的服务端实现。如需匿名统计，由部署方在页面注入
  `window.__midiReporter` 运行时钩子即可（见 [统计接缝](#统计接缝)）；没有这个钩子，游戏不发出任何网络请求。

## 快速开始

环境要求：Node.js 18+、Python 3.10+（题库工具链）。

```bash
git clone <仓库地址>
cd daily-answer

# 前端
npm install
npm run dev         # 开发服务器（默认 http://localhost:5173）

# 题库工具链（一次性）
pip install -r tools/requirements.txt   # 仅 pypinyin
```

### 常用命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发服务器，热更新 |
| `npm run test` | vitest 单测（游戏内核 / 排期 / 分享 / 上报字段） |
| `npm run typecheck` | vue-tsc 类型检查 |
| `npm run build` | 产线构建，产物在 `dist/` |
| `npm run preview` | 本地预览构建产物 |
| `npm run check` | 题库校验器（与 CI 同款），任一违规非零退出 |
| `python tools/build_bank.py` | 重建题库产物（见下文） |
| `node tools/locate.mjs <答案>` | 反查某道题未来排到哪几期 |

## 目录结构

```
daily-answer/
├── seed/                      # ★ 题源唯一维护点（改题只改这里）
│   ├── idioms.json            #   成语题源
│   └── figures.json           #   人物题源（含 aliases）
├── public/data/               # 构建产物（勿手改，由 build_bank.py 生成）
│   ├── puzzles.json           #   题库成品（纯数组，顺序无意义）
│   └── epochs.json            #   排期元数据：纪元日 + epoch 表 + 冻结序列 + 钉住表
├── src/
│   ├── game/                  # ★ 游戏规则纯函数内核（零 DOM/零存储，vitest 覆盖）
│   │   ├── engine.ts          #   对局状态机：猜错亮提示、锦囊、判赢判负
│   │   ├── order.ts           #   排期推导：种子洗牌 + 冻结序列查表（全网同题的根基）
│   │   ├── schedule.ts        #   上海时区日历日 ↔ dayIndex
│   │   ├── rules.ts           #   题型规则（机会数/提示数，读自 types.json 注册表）
│   │   ├── match.ts           #   判定：全名/别名命中
│   │   ├── share.ts           #   战绩分享文本
│   │   └── types.ts           #   类型定义
│   ├── data/
│   │   ├── types.json         #   题型注册表（机会数/提示数/字数区间/是否收别名）
│   │   └── loader.ts          #   题库与排期元数据加载 + 结构校验
│   ├── store/                 # 应用组装层（引擎 × 持久化 × 主题）
│   │   ├── game.ts            #   对局装配：当日题解析、进度恢复、结算
│   │   ├── persistence.ts     #   localStorage 当日进度
│   │   ├── stats.ts           #   本地记分板（连胜等）
│   │   └── theme.ts           #   明暗主题
│   ├── components/            # 页面组件（首页/答题/结算/弹层）
│   ├── report/                # 统计接缝：只定义 window.__midiReporter 钩子，无网络代码
│   └── styles/                # 设计令牌与基础样式
├── tools/                     # Python 题库流水线（仅依赖 pypinyin）
│   ├── build_bank.py          #   构建器：seed/ → puzzles.json + epochs.json
│   ├── check.py               #   校验器（CI 同款门禁）
│   ├── epochs_selftest.py     #   排期机制自测（13 条路径）
│   └── locate.mjs             #   排期反查：按答案查未来期号（内置自校验向量）
├── tests/                     # vitest 用例
└── .github/workflows/check.yml# CI：题库校验 + 产物可复现 + 测试/类型检查
```

## 出题与题库流水线

### 1. 编辑题源

在 `seed/idioms.json` 或 `seed/figures.json` 中增删改题目，条目结构：

```jsonc
{
  "answer": "破釜沉舟",
  "tags": [                        // 成语 7 条 / 人物 8 条，按覆盖范围从大到小排
    ["项羽", "典故人物：巨鹿之战破釜"],   // [两字提示词, 该词与答案的关系说明]
    ["锅", "字面动作：砸锅"]           //   关系说明只在结算页回放，可含答案字
  ],
  "summary": "一句话总述（结算页大字）",
  "gloss": "释义：本义 + 引申义",
  "story": "历史典故叙事",
  "source": "《史记·项羽本纪》",
  "difficulty": 2,                 // 1-5
  "difficultyBasis": "常见成语，典故妇孺皆知",
  "aliases": ["破釜沉舟"]           // 仅人物题：与答案等长的参与判赢
}
```

完整出题规则（同音屏蔽、标签来源等）见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

### 2. 校验

```bash
npm run check     # 即 python tools/check.py
```

硬规则（任一失败非零退出、不产出成品）：

- 提示词为两字真词、不含答案用字、拼音声母韵母不与答案任一字同音（忽略声调）；
- 提示词的关系说明 ≤ 30 字（结算页内容，不查是否含答案字）；
- 每题必有 1-5 难度分与依据；成语 7 条提示、人物 8 条；答案不重复；
- 人物别名按是否与答案等长拆分为 `aliases`（判赢）/ `altNames`（仅展示）。

### 3. 构建产物

```bash
python tools/build_bank.py
```

一次产出两个文件：

- `public/data/puzzles.json`：题库成品，按 (类型, 拼音) 稳定排序以便 diff；
- `public/data/epochs.json`：排期元数据（结构见下节）。

### 扩题流程

直接往 `seed/` 加题 → 校验 → 构建。构建器自动完成：

- 追加新 epoch（`since` = 构建当天），当日题目自动钉住不变；
- 历史出题随冻结序列永久锁定，加题插队也不会重写历史；
- 禁止删题、禁止改动已生效的 epoch/钉住（一律红灯）。

### 4. build_bank.py 参数

| 参数 | 默认 | 说明 |
|---|---|---|
| `--seed <目录>` | `seed/` | 题源目录 |
| `--out <文件>` | `public/data/puzzles.json` | 题库输出路径（epochs.json 写在同目录） |
| `--prev <目录>` | `public/data/` | 上一版成品目录（读取题数与既有排期元数据） |
| `--legacy-seq <文件>` | 无 | 一次性迁移：`{"<since>": [答案...]}`，为无冻结序列的旧 epoch 注入历史真实序列，长度必须等于对应 size |

## 排期机制

当日题 = `puzzles.json` 中的某一条，由 `src/game/order.ts` 的
`puzzleIndexOfDay(dayIndex, answers, epochs, overrides)` 推导：

1. `dayIndex` = 当天（按北京时间）与 `epochDate` 的天数差；
2. 找到最后一个 `since ≤ dayIndex` 的 epoch；
3. 若该 epoch 带 `seq`（冻结的答案序列），直接查表：`seq[(dayIndex - since) % size]`；
4. 旧产物无 `seq` 时回落 Fisher–Yates 洗牌推导（`xmur3` + `mulberry32` 纯整数运算）；
5. `overrides` 命中的日子直接出钉住的题（当日扩题时自动写入）。

`epochs.json` 结构：

```jsonc
{
  "epochDate": "2026-10-30",          // 纪元日：第 0 天
  "epochs": [
    { "since": 0,  "size": 95,  "seq": ["精卫填海", "..."] },  // seq 与 size 等长
    { "since": 19, "size": 101, "seq": ["邯郸学步", "..."] }
  ],
  "overrides": { "19": "邯郸学步" }    // dayIndex → 答案；优先级最高
}
```

性质与红线：

- `seq` 是构建期一次洗牌冻结的答案字符串序列，与题库排序/增删彻底解耦：
  加题随便插，已出历史一个字都不会变；
- 每轮（cycle）= `size` 天，轮内每题恰好出现一次，轮次循环复用同一序列；
- 已生效 epoch 的 `since/size/seq` 永不改动（构建器红灯拦截）；
- 答案一旦被 seq/override 引用即不可删除（禁删题）；
- 调试核对：`node tools/locate.mjs <答案>` 可反查未来期号（第 N 期 = dayIndex N-1）。

## 调试参数

| 参数 | 作用 |
|---|---|
| `?d=42` | 玩第 42 天（dayIndex）的题，即第 43 期 |
| `?word=破釜沉舟` | 强制指定今日答案 |

调试模式不写进度、不计分、不上报，可用于预览未来期号。

## 构建与部署

```bash
npm run build      # 产物在 dist/（index.html + assets/）+ public/data/ 原样拷贝
npm run preview    # 本地预览
```

- 产物为纯静态文件，可部署在任意静态服务器/对象存储的任意子路径（如 `/game/answer/`）。
- 上线内容 = `dist/`（页面与 JS/CSS）+ `public/data/`（题库与排期元数据），
  两者需保持同一版本。
- 数据文件变更（加题）只需替换 `data/` 下两个 JSON，无需重发页面；
  页面变更则两者一起发，避免新旧错配。

### 统计接缝（可选）

本仓库默认零上报、零网络请求。部署方如需匿名统计（局数/胜负/用时/提示数），
在页面注入一个实现 `window.__midiReporter(ctx)` 的脚本即可。对局结束时前端会把
上下文（期号、结果、次数等）传给它，是否上报、发往何处完全由部署方决定。
接口失败静默，不影响游戏。字段白名单见 `src/report/index.ts`。

## 质量门禁

- CI 对每次 push/PR 执行：题库校验 → 产物可复现比对 → vitest → 类型检查；
- 修改 `seed/` 后本地必须跑过 `npm run check`；
- 玩法规则（机会数、提示数、锦囊）变更需先更新 `src/data/types.json` 与规格，勿散落硬编码。

## License

[MIT](./LICENSE)
