# -*- coding: utf-8 -*-
"""谜底题库构建器。

合并 seed/ 题源（成语批次 + 人物 + 难度评分），机器校验全部硬规则，
通过后产出 public/data/puzzles.json。

- 校验任一失败：非零退出码，不产出成品。
- 题目顺序在成品中无关紧要（每日出题由前端种子洗牌推导），这里按
  (type, answer) 稳定排序以便 diff。
- 人物别名拆分：与答案等长的进入 aliases（参与判赢），其余进入
  altNames（仅结算页展示）。
"""
import argparse
import json
import re
import sys
from pathlib import Path

from pypinyin import pinyin, Style

ROOT = Path(__file__).resolve().parents[1]
N_TAGS = {"idiom": 7, "figure": 8}
ATTEMPTS = {"idiom": 6, "figure": 7}


def no_tone(syl: str) -> str:
    return re.sub(r"\d+$", "", syl)


def banned_of(word: str) -> set:
    """答案的屏蔽音节集（声母韵母，忽略声调，含多音字全部读音）。"""
    banned = set()
    for ch in word:
        for x in pinyin(ch, style=Style.TONE3, strict=False, heteronym=True):
            banned.add(no_tone(x[0]))
    return banned


def load(ptype: str, seed_dir: Path) -> list:
    if ptype == "idiom":
        files = sorted(seed_dir.glob("batch*.json"))
    else:
        files = [seed_dir / "figures.json", seed_dir / "figures2.json"]
    out = []
    for f in files:
        for e in json.loads(f.read_text(encoding="utf-8")):
            e["_type"] = ptype
            out.append(e)
    return out


def validate_entries(entries: list, diff: dict) -> list:
    errors = []
    seen = set()
    for e in entries:
        answer, ptype = e["answer"], e["_type"]
        if answer in seen:
            errors.append(f"{answer}: 重复")
            continue
        seen.add(answer)
        banned = banned_of(answer)
        n = N_TAGS[ptype]
        if len(e["tags"]) != n:
            errors.append(f"{answer}: 标签数={len(e['tags'])} ≠{n}")
        for w, note in e["tags"]:
            if len(w) != 2:
                errors.append(f"{answer}: 标签'{w}'不是两字")
            if any(ch in answer for ch in w):
                errors.append(f"{answer}: 标签'{w}'含答案字")
            for ch in w:
                for x in pinyin(ch, style=Style.TONE3, strict=False, heteronym=True):
                    if no_tone(x[0]) in banned:
                        errors.append(f"{answer}: 标签'{w}'与答案同音({no_tone(x[0])})")
            if any(ch in answer for ch in note):
                errors.append(f"{answer}: 标签'{w}'解释含答案字: {note}")
            if len(note) > 30:
                errors.append(f"{answer}: 标签'{w}'解释超30字({len(note)})")
        if answer not in diff:
            errors.append(f"{answer}: 缺少难度评分")
        else:
            score, _ = diff[answer]
            if not (isinstance(score, int) and 1 <= score <= 5):
                errors.append(f"{answer}: 难度分非法 {score}")
    return errors


def build_bank(entries: list, diff: dict) -> list:
    bank = []
    for e in entries:
        answer, ptype = e["answer"], e["_type"]
        score, basis = diff[answer]
        item = {
            "type": ptype,
            "answer": answer,
            "pinyin": [no_tone(x[0]) for x in pinyin(answer, style=Style.TONE3, strict=False)],
            "banned": sorted(banned_of(answer)),
            "tags": [{"word": w, "note": no} for w, no in e["tags"]],
            "source": e["source"],
            "summary": e["summary"],
            "gloss": e["gloss"],
            "story": e["story"],
            "glossSource": "人工编写·参照《成语典》体例" if ptype == "idiom" else "人工编写",
            "difficulty": score,
            "difficultyBasis": basis,
        }
        if ptype == "figure":
            aliases = e.get("aliases", [])
            n = len(answer)
            item["aliases"] = [a for a in aliases if len(a) == n]   # 等长，参与判赢
            alt = [a for a in aliases if len(a) != n]
            if alt:
                item["altNames"] = alt                              # 不等长，仅展示
            item["nameLen"] = n
            item["attempts"] = ATTEMPTS[ptype]
        bank.append(item)
    bank.sort(key=lambda x: (x["type"], x["answer"]))
    return bank


def validate_bank(bank: list) -> list:
    """成品级校验：别名拆分不变量 + 注册表字段齐备。"""
    errors = []
    for p in bank:
        if p["type"] == "figure":
            for a in p.get("aliases", []):
                if len(a) != p["nameLen"]:
                    errors.append(f"{p['answer']}: 成品别名'{a}'长度≠{p['nameLen']}")
            if p["attempts"] != ATTEMPTS["figure"]:
                errors.append(f"{p['answer']}: attempts 非法")
        if p["difficulty"] not in (1, 2, 3, 4, 5):
            errors.append(f"{p['answer']}: 成品难度分非法")
    return errors


def build(seed_dir: Path):
    diff = json.loads((seed_dir / "difficulty.json").read_text(encoding="utf-8"))
    diff.pop("_rubric", None)
    entries = load("idiom", seed_dir) + load("figure", seed_dir)
    errors = validate_entries(entries, diff)
    bank = [] if errors else build_bank(entries, diff)
    if not errors:
        errors = validate_bank(bank)
    return bank, errors, len(entries)


def main() -> int:
    ap = argparse.ArgumentParser(description="谜底题库构建器")
    ap.add_argument("--seed", default=str(ROOT / "seed"), help="题源目录")
    ap.add_argument("--out", default=str(ROOT / "public" / "data" / "puzzles.json"), help="输出文件")
    args = ap.parse_args()

    bank, errors, total = build(Path(args.seed))
    print(f"载入 {total} 条（成语 {sum(1 for e in load('idiom', Path(args.seed)))} + "
          f"人物 {sum(1 for e in load('figure', Path(args.seed)))}），问题 {len(errors)} 个")
    for x in errors:
        print(" ✗", x)
    if errors:
        print("构建失败：校验未通过，不产出成品")
        return 1

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(bank, ensure_ascii=False, indent=1), encoding="utf-8")
    from collections import Counter
    dist = Counter(x["type"] for x in bank)
    print(f"输出 {out}（{len(bank)} 题：{dict(dist)}）")
    print("难度分布:", dict(sorted(Counter(x["difficulty"] for x in bank).items())))
    return 0


if __name__ == "__main__":
    sys.exit(main())
