# 谜底 · 每日一猜

> 看一组两字提示词，猜今日唯一答案。成语、历史人物，一天一题，全网同题。

**在线体验：<https://himing.xyz/game/answer/>**

## 玩法

- 每天一题，全网统一，次日零点换题。
- 玩法灵感来自《中国成语大会》的「双音节对抗」环节。
- 开局亮 1 条两字提示词；每猜错一次多亮一条；用完机会即失败。
- 答案只有两种：成语，或者历史人物。字数从开局就告诉你（字数方框），只接受完整全名。
- 卡住可以点「锦囊」要最后一条提示，不消耗机会，但计入战绩。
- 题目按难度分五级，一星最易，五星最难。
- 猜中或失败后，结算页有答案科普、提示回放与一键分享。

## 本地开发

```bash
npm install        # 前端依赖
npm run dev        # 开发服务器

# 题库工具链（Python 3.10+）
pip install -r tools/requirements.txt
python tools/check.py        # 校验 seed/，任一违规非零退出
python tools/build_bank.py   # 重建 public/data/puzzles.json
```

### 调试参数

- `?d=42` 玩第 42 天（dayIndex）的历史题
- `?word=破釜沉舟` 指定今日答案

调试模式不写进度、不计分、不上报。

## 构建与部署

```bash
npm run build      # 产物在 dist/（纯静态，base 为相对路径，可挂任意子路径）
npm run preview    # 本地预览构建产物
```

体积预算：JS+CSS gzip < 150KB（设计文档 §5.2）。

## 出题

1. 在 `seed/` 编辑题源（出题规则见 [CONTRIBUTING.md](./CONTRIBUTING.md)）；
2. `python tools/check.py` 校验通过；
3. `python tools/build_bank.py` 重建 `public/data/puzzles.json`。

每日题目不做明文排期：由公开种子在运行时洗牌推导（`src/game/order.ts`），
95 天一轮、轮内不重复。扩题时在 `EPOCHS` 追加 `{ since, size }` 即可，
历史题号永远可复算。

## License

[MIT](./LICENSE)
