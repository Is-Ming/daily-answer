# -*- coding: utf-8 -*-
"""谜底题库构建器。

读取 seed/ 题源（idioms.json + figures.json，难度内联），机器校验全部硬规则，
通过后产出 public/data/puzzles.json（题目，纯数组）与 public/data/epochs.json
（排期元数据：纪元日 + epoch 沿革表）。

- 校验任一失败：非零退出码，不产出成品。
- 题目顺序在成品中无关紧要（每日出题由前端种子洗牌推导），这里按
  (type, answer) 稳定排序以便 diff。
- 人物别名拆分：与答案等长的进入 aliases（参与判赢），其余进入
  altNames（仅结算页展示）。
- 扩题：题数多于上一版成品时立即锚定（since=当天）并追加 epoch，同日多次
  扩题合并；删题（题数减少）与篡改历史 epoch/seq 一律红灯。
- 排期冻结：每个 epoch 携带 seq（与 size 等长的答案字符串数组），创建时
  一次洗牌冻结，此后历史出题与题库排序/增删彻底解耦（frozen-seq）。
  一次性迁移可用 --legacy-seq 注入历史真实序列。
"""
import argparse
import json
import re
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from pypinyin import pinyin, Style

ROOT = Path(__file__).resolve().parents[1]
N_TAGS = {"idiom": 7, "figure": 8}
ATTEMPTS = {"idiom": 6, "figure": 7}

# 缺省纪元日（第 0 天 = 首题上线日）。仅首次构建（无上一版成品）时使用，
# 此后以 epochs.json 中的 epochDate 为单一数据源，永不改变。
EPOCH_DATE_LEGACY = "2026-10-30"

# 出题种子（与 src/game/order.ts 的 BASE_SEED 同源，仅 Python 推导旧口径当日题使用）
BASE_SEED = "mídǐ-2026-11-01"

# ---- 洗牌算法 Python 移植（与 src/game/order.ts 严格同源，仅供"旧口径当日题"推导）----
# 模块加载即断言固定向量，移植漂移时直接拒绝构建（宁停不错）。


def _xmur3(str_input: str):
    h = 1779033703 ^ len(str_input)
    for ch in str_input:
        h = _imul(h ^ ord(ch), 3432918353)
        h = ((h << 13) | (h >> 19)) & 0xFFFFFFFF
    state = h

    def step():
        nonlocal state
        state = _imul(state ^ (state >> 16), 2246822507)
        state = _imul(state ^ (state >> 13), 3266489909)
        state ^= state >> 16
        return state & 0xFFFFFFFF

    return step


def _imul(a: int, b: int) -> int:
    """32 位有符号乘法截断（等价 JS Math.imul）。"""
    return (a * b) & 0xFFFFFFFF


def _mulberry32(a: int):
    a &= 0xFFFFFFFF

    def step():
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = a
        t = _imul(t ^ (t >> 15), t | 1)
        t = ((t + _imul(t ^ (t >> 7), 61 | t)) & 0xFFFFFFFF) ^ t
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return step


def shuffled_order_py(size: int, seed: str) -> list:
    rand = _mulberry32(_xmur3(seed)())
    arr = list(range(size))
    for i in range(size - 1, 0, -1):
        j = int(rand() * (i + 1))
        arr[i], arr[j] = arr[j], arr[i]
    return arr


def _self_check() -> None:
    probe = shuffled_order_py(95, f"{BASE_SEED}:0:0")[:10]
    expect = [76, 23, 21, 92, 58, 14, 6, 31, 0, 51]
    if probe != expect:
        raise RuntimeError(f"PRNG 移植漂移：得到 {probe}，期望 {expect}。禁止构建。")


_self_check()


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
    file = seed_dir / ("idioms.json" if ptype == "idiom" else "figures.json")
    out = []
    for e in json.loads(file.read_text(encoding="utf-8")):
        e["_type"] = ptype
        out.append(e)
    return out


def validate_entries(entries: list) -> list:
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
            # note 为结算页内容（对局中不显示），不校验是否含答案字；仅约束长度
            if len(note) > 30:
                errors.append(f"{answer}: 标签'{w}'解释超30字({len(note)})")
        score = e.get("difficulty")
        if "difficultyBasis" not in e:
            errors.append(f"{answer}: 缺少难度依据")
        if not (isinstance(score, int) and 1 <= score <= 5):
            errors.append(f"{answer}: 难度分非法 {score}")
    return errors


def build_bank(entries: list) -> list:
    bank = []
    for e in entries:
        answer, ptype = e["answer"], e["_type"]
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
            "difficulty": e["difficulty"],
            "difficultyBasis": e["difficultyBasis"],
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


def load_prev_meta(prev_dir: Path) -> dict:
    """读取上一版排期元数据/题数/答案表/override（译为 day→答案）。缺失时回退缺省。"""
    epoch_date = EPOCH_DATE_LEGACY
    epochs = None
    overrides_raw = None
    prev_count = None
    prev_answers = None
    meta_path = prev_dir / "epochs.json"
    bank_path = prev_dir / "puzzles.json"
    if meta_path.exists():
        data = json.loads(meta_path.read_text(encoding="utf-8"))
        epoch_date = data["epochDate"]
        epochs = data["epochs"]
        overrides_raw = data.get("overrides", {})
    if bank_path.exists():
        prev_bank = json.loads(bank_path.read_text(encoding="utf-8"))
        prev_count = len(prev_bank)
        prev_answers = [p["answer"] for p in prev_bank]
    if epochs is None:
        epochs = [{"since": 0, "size": prev_count}] if prev_count is not None else []

    override_answers = {}
    for day_s, val in (overrides_raw or {}).items():
        day = int(day_s)
        if isinstance(val, str):
            override_answers[day] = val  # 新格式：答案字符串，原样沿用
        elif isinstance(val, int) and prev_answers is not None and 0 <= val < len(prev_answers):
            override_answers[day] = prev_answers[val]  # 旧格式：下标重译
        else:
            override_answers[day] = None  # 无法解析 → 校验红灯

    return {"epochDate": epoch_date, "epochs": epochs, "prevCount": prev_count,
            "prevAnswers": prev_answers, "overrideAnswers": override_answers}


def shanghai_today() -> date:
    """上海日历日（UTC+8，无夏令时）。"""
    return datetime.now(timezone(timedelta(hours=8))).date()


def _old_derive(day_idx: int, epochs: list, bank_size: int) -> int:
    """旧口径推导（与 src/game/order.ts 旧洗牌路径同源）。"""
    picked_i, picked_e = 0, epochs[0]
    for i, e in enumerate(epochs):
        if day_idx >= e["since"]:
            picked_i, picked_e = i, e
    local = day_idx - picked_e["since"]
    cycle = local // picked_e["size"]
    slot = local % picked_e["size"]
    order = shuffled_order_py(picked_e["size"], f"{BASE_SEED}:{picked_i}:{cycle}")
    return order[slot] % bank_size


def _answers_of(new_answer_index: dict) -> list:
    """answer→index 映射还原为答案有序列表。"""
    answers = [None] * len(new_answer_index)
    for a, i in new_answer_index.items():
        answers[i] = a
    return answers


def _freeze_seq(epoch_idx: int, epoch: dict, answers: list) -> list:
    """洗牌一次并把下标译成答案，冻结为 seq（仅 epoch 创建/迁移时调用）。"""
    order = shuffled_order_py(epoch["size"], f"{BASE_SEED}:{epoch_idx}:0")
    n = len(answers)
    return [answers[ix % n] for ix in order]


def resolve_meta(prev: dict, new_count: int, new_answer_index: dict,
                 today: date | None = None) -> tuple[dict, list[str]]:
    """now-anchor：扩题立即锚定当天 + 当日钉住，附带全部校验。"""
    errors: list[str] = []
    epoch_date = prev["epochDate"]
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", epoch_date):
        errors.append(f"epochDate 非法: {epoch_date}")
        return {"epochDate": epoch_date, "epochs": [], "overrides": {}}, errors

    old_epochs: list = prev["epochs"]
    for e in old_epochs:
        if not (isinstance(e.get("since"), int) and isinstance(e.get("size"), int)
                and e["since"] >= 0 and e["size"] >= 1):
            errors.append(f"上一版 epoch 条目非法: {e}")
            return {"epochDate": epoch_date, "epochs": [], "overrides": {}}, errors

    today_d = today or shanghai_today()
    epoch = date.fromisoformat(epoch_date)
    today_idx = max(0, (today_d - epoch).days)

    epochs = [dict(e) for e in old_epochs]
    prev_count = prev["prevCount"]
    new_answers = _answers_of(new_answer_index)

    # now-anchor：禁止预排未来 epoch
    if any(e["since"] > today_idx for e in old_epochs):
        errors.append(f"存在 since 大于今天({today_idx}) 的 epoch：现在锚点下禁止预排未来")

    # frozen-seq：无 seq 的旧 epoch 补齐（legacy 注入优先，否则按当前题库冻结）；
    # 已带 seq 的只做结构校验，内容是否被改动在下面冻结校验里对账。
    legacy_seq = prev.get("legacySeq") or {}
    for i, e in enumerate(epochs):
        seq = e.get("seq")
        if seq is not None:
            if (not isinstance(seq, list) or len(seq) != e["size"]
                    or not all(isinstance(a, str) for a in seq)):
                errors.append(f"epoch(since={e['since']}) seq 非法：须为长度==size 的字符串数组")
                return {"epochDate": epoch_date, "epochs": [], "overrides": {}}, errors
            continue
        legacy = legacy_seq.get(str(e["since"]))
        if legacy is not None:
            if not isinstance(legacy, list) or len(legacy) != e["size"]:
                errors.append(f"epoch(since={e['since']}) legacy-seq 长度不符："
                              f"{len(legacy)} ≠ size={e['size']}")
                continue
            e["seq"] = [str(a) for a in legacy]
        else:
            e["seq"] = _freeze_seq(i, e, new_answers)

    # frozen-seq：已生效（since < 今天）epoch 的冻结序列逐字对账，改动即红灯
    for oe, ne in zip(old_epochs, epochs):
        if oe.get("seq") is not None and oe["since"] < today_idx and ne.get("seq") != oe["seq"]:
            errors.append(f"epoch(since={oe['since']}) 已冻结 seq 被改动：历史出题不可重写")

    # seq 引用的答案必须存在于新题库（删除已出答案的既有红线延伸到 seq）
    for e in epochs:
        for a in e.get("seq") or []:
            if a not in new_answer_index:
                errors.append(f"epoch(since={e['since']}) seq 答案 {a} 在新题库中缺失")

    # 历史 override：直接以答案字符串落盘（与题库排序/下标彻底解耦）
    overrides: dict = {}
    for day, ans in prev["overrideAnswers"].items():
        if ans is None or ans not in new_answer_index:
            errors.append(f"override(day {day}) 答案 {ans} 在新题库中缺失（不得删除当日已出答案）")
            continue
        overrides[day] = ans

    if prev_count is None:
        # 首次构建：产出首个 epoch（创建即冻结）
        epochs = [{"since": 0, "size": new_count}]
        epochs[0]["seq"] = _freeze_seq(0, epochs[0], new_answers)
    elif new_count < prev_count:
        errors.append(f"题数减少（{prev_count} → {new_count}）：禁止删题，规模是排期根基")
    elif new_count > prev_count:
        since = today_idx  # ← 立即锚定：since = 推送当天
        last = epochs[-1]
        if since == last["since"]:
            last["size"] = new_count  # 同日多推合并
            last["seq"] = _freeze_seq(len(epochs) - 1, last, new_answers)  # 当日由 override 钉住，seq 可按新规模重建
        elif since > last["since"]:
            e = {"since": since, "size": new_count}
            e["seq"] = _freeze_seq(len(epochs), e, new_answers)  # 创建即冻结，此后不重算
            epochs.append(e)
        else:
            errors.append(f"epoch since={since} 未严格大于上一条（{last['since']}）：系统日期异常？")

        # 当日钉住：沿袭同日已有钉住，否则用旧口径推导今日题
        if today_idx in prev["overrideAnswers"]:
            pinned = prev["overrideAnswers"][today_idx]
            if pinned is None or pinned not in new_answer_index:
                errors.append(f"当日钉住答案 {pinned} 在新题库中缺失（不得删除当日已出答案）")
            else:
                overrides[today_idx] = pinned
        else:
            if prev["prevAnswers"] is None:
                errors.append("旧口径当日题推导失败：上一版题库缺失")
            else:
                old_idx = _old_derive(today_idx, old_epochs, prev_count)
                if old_idx is None or old_idx >= len(prev["prevAnswers"]):
                    errors.append("旧口径当日题推导失败（下标越界）")
                else:
                    pinned = prev["prevAnswers"][old_idx]
                    if pinned not in new_answer_index:
                        errors.append(f"当日已出答案 {pinned} 在新题库中缺失（不得删除当日已出答案）")
                    else:
                        overrides[today_idx] = pinned

    # 冻结校验：since < 今天的 epoch 的 since/size 不可变（seq 冻结由上方专设校验负责）
    frozen = [{"since": e["since"], "size": e["size"]} for e in old_epochs if e["since"] < today_idx]
    now = [{"since": e["since"], "size": e["size"]} for e in epochs[:len(frozen)]]
    if now != frozen:
        errors.append("epochs 已生效条目被改动（只增不改，历史题号必须可复算）")
    sizes = [e["size"] for e in epochs]
    if any(b <= a for a, b in zip(sizes, sizes[1:])):
        errors.append(f"epochs size 必须严格递增: {sizes}")
    if prev_count is not None and epochs and epochs[-1]["size"] != new_count and new_count >= prev_count:
        errors.append(f"末条 epoch size={epochs[-1]['size']} ≠ 成品题数 {new_count}")

    meta = {"epochDate": epoch_date, "epochs": epochs,
            "overrides": {str(k): v for k, v in sorted(overrides.items())}}
    return meta, errors


def build(seed_dir: Path):
    entries = load("idiom", seed_dir) + load("figure", seed_dir)
    errors = validate_entries(entries)
    bank = [] if errors else build_bank(entries)
    if not errors:
        errors = validate_bank(bank)
    return bank, errors, len(entries)


def main() -> int:
    ap = argparse.ArgumentParser(description="谜底题库构建器")
    ap.add_argument("--seed", default=str(ROOT / "seed"), help="题源目录")
    ap.add_argument("--out", default=str(ROOT / "public" / "data" / "puzzles.json"), help="输出文件")
    ap.add_argument("--prev", default=str(ROOT / "public" / "data"), help="上一版成品目录（读题数与 epochs）")
    ap.add_argument("--legacy-seq", default=None,
                    help='一次性迁移：{"<since>": [答案...]} JSON 文件，为无 seq 的旧 epoch 注入历史真实序列')
    args = ap.parse_args()

    bank, errors, total = build(Path(args.seed))
    meta = None
    if not errors:
        answer_index = {p["answer"]: i for i, p in enumerate(bank)}
        prev = load_prev_meta(Path(args.prev))
        if args.legacy_seq:
            prev["legacySeq"] = json.loads(Path(args.legacy_seq).read_text(encoding="utf-8"))
        meta, meta_errors = resolve_meta(prev, len(bank), answer_index)
        errors = list(errors) + meta_errors
    print(f"载入 {total} 条（成语 {sum(1 for e in load('idiom', Path(args.seed)))} + "
          f"人物 {sum(1 for e in load('figure', Path(args.seed)))}），问题 {len(errors)} 个")
    for x in errors:
        print(" ✗", x)
    if errors or meta is None:
        print("构建失败：校验未通过，不产出成品")
        return 1

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(bank, ensure_ascii=False, indent=1), encoding="utf-8")
    epochs_path = out.parent / "epochs.json"
    epochs_path.write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    from collections import Counter
    dist = Counter(x["type"] for x in bank)
    print(f"输出 {out}（{len(bank)} 题：{dict(dist)}）")
    print("难度分布:", dict(sorted(Counter(x["difficulty"] for x in bank).items())))
    brief = [{"since": e["since"], "size": e["size"], "seq": f"{len(e.get('seq') or [])} 条"} for e in meta["epochs"]]
    print(f"输出 {epochs_path}（epochDate={meta['epochDate']}，epochs={brief}，overrides={meta['overrides']}）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
