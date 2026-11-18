# -*- coding: utf-8 -*-
"""epochs 机制自测（now-anchor + frozen-seq）：立即锚定 / seq 冻结 / 各类红灯路径。

直接调用 build_bank 的解析函数，不依赖 git 与真实成品。
用法：python tools/epochs_selftest.py（静默通过，任何断言失败以非零退出）
"""
import json
import sys
import tempfile
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_bank import load_prev_meta, resolve_meta, shuffled_order_py, BASE_SEED  # noqa: E402

# 与 build_bank 的"立即锚定"对齐：2026-10-30 + 19 天 = 自测基准日 2026-11-18（dayIndex 19）
TODAY = date(2026, 11, 18)
TODAY_IDX = 19


def write_prev(dir_path: Path, answers: list, epoch_date: str, epochs: list,
               overrides: dict | None = None) -> Path:
    """answers 为答案有序列表（模拟题库排序）；epochs 为上一版 epoch 表。"""
    dir_path.mkdir(parents=True, exist_ok=True)
    (dir_path / "puzzles.json").write_text(
        json.dumps([{"answer": a} for a in answers]), encoding="utf-8")
    meta = {"epochDate": epoch_date, "epochs": epochs}
    if overrides is not None:
        meta["overrides"] = overrides
    (dir_path / "epochs.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
    return dir_path


def expect_seq(answers: list, epoch_idx: int, size: int) -> list:
    """构建器补齐 seq 的期望值：按当前题库洗牌一次冻结。"""
    order = shuffled_order_py(size, f"{BASE_SEED}:{epoch_idx}:0")
    return [answers[ix % len(answers)] for ix in order]


def old_day_answer(answers: list, day: int, epochs: list, bank_size: int) -> str:
    """按旧口径推导 day 的答案（当日钉住期望值用）。"""
    picked_i, picked_e = 0, epochs[0]
    for i, e in enumerate(epochs):
        if day >= e["since"]:
            picked_i, picked_e = i, e
    local = day - picked_e["since"]
    order = shuffled_order_py(picked_e["size"], f"{BASE_SEED}:{picked_i}:{local // picked_e['size']}")
    return answers[order[local % picked_e["size"]] % bank_size]


def expect_ok(name: str, prev: dict, new_answers: list, want: dict) -> None:
    new_idx = {a: i for i, a in enumerate(new_answers)}
    meta, errors = resolve_meta(prev, len(new_answers), new_idx, TODAY)
    assert not errors, f"{name}: unexpected red {errors}"
    assert meta == want, f"{name}: {json.dumps(meta, ensure_ascii=False)[:400]} != want"
    print(f"  ok {name} -> overrides={meta['overrides']}")
    return meta


def expect_red(name: str, prev: dict, new_answers: list, frag: str) -> None:
    new_idx = {a: i for i, a in enumerate(new_answers)}
    _, errors = resolve_meta(prev, len(new_answers), new_idx, TODAY)
    assert errors and any(frag in e for e in errors), f"{name}: expect red({frag}), got {errors}"
    print(f"  ok {name} -> red: {errors[0]}")


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        old95 = [f"a{i:02d}" for i in range(95)]
        ep95 = [{"since": 0, "size": 95}]
        seq0 = expect_seq(old95, 0, 95)

        # 路径一：立即锚定——扩题 epoch since=当天 + 当日钉住 + 新 epoch 冻结 seq
        prev = load_prev_meta(write_prev(root / "a", old95, "2026-10-30", ep95))
        pinned = old_day_answer(old95, TODAY_IDX, ep95, 95)
        new100 = old95 + [f"new{i:02d}" for i in range(5)]
        seq1 = expect_seq(new100, 1, 100)
        m1 = expect_ok("立即锚定 since=当天+当日钉住+seq 冻结", prev, new100,
                       {"epochDate": "2026-10-30",
                        "epochs": [{"since": 0, "size": 95, "seq": seq0},
                                   {"since": TODAY_IDX, "size": 100, "seq": seq1}],
                        "overrides": {str(TODAY_IDX): pinned}})
        print(f"     （当日钉住答案 = {pinned}）")

        # 路径一b：同日二次扩题——当日答案沿袭（答案字符串直接透传），末条 seq 重建
        prev2 = load_prev_meta(write_prev(root / "b", new100, "2026-10-30", m1["epochs"],
                                          {str(TODAY_IDX): pinned}))
        new110 = new100 + [f"new{i:02d}" for i in range(5, 15)]
        seq1b = expect_seq(new110, 1, 110)
        expect_ok("同日二次扩题沿袭当日答案+末条 seq 重建", prev2, new110,
                  {"epochDate": "2026-10-30",
                   "epochs": [{"since": 0, "size": 95, "seq": seq0},
                              {"since": TODAY_IDX, "size": 110, "seq": seq1b}],
                   "overrides": {str(TODAY_IDX): pinned}})

        # 路径二：已冻结 seq 不被构建器重算（内容原样透传；真源即上一版产物，
        # 对真源的手工篡改无法在构建期检出——这正是"只增不改"靠流程保障的部分）
        frozen = load_prev_meta(write_prev(root / "c2", old95, "2026-10-30",
                                           [{"since": 0, "size": 95, "seq": seq0}]))
        expect_ok("已冻结 seq 原样保留", frozen, old95,
                  {"epochDate": "2026-10-30",
                   "epochs": [{"since": 0, "size": 95, "seq": seq0}],
                   "overrides": {}})

        # 路径三：篡改历史 epoch size → 红灯
        tampered = load_prev_meta(write_prev(root / "c", old95, "2026-10-30", [{"since": 0, "size": 94}]))
        expect_red("篡改历史 epoch size", tampered, old95, "≠ 成品题数")

        # 路径四：删题 → 红灯
        shrink = load_prev_meta(write_prev(root / "d", new100, "2026-10-30", m1["epochs"]))
        expect_red("删题 100→95", shrink, old95, "禁止删题")

        # 路径五：seq 引用的答案被删 → 红灯
        miss_seq = load_prev_meta(write_prev(root / "d2", old95, "2026-10-30",
                                             [{"since": 0, "size": 95, "seq": seq0[:-1] + ["不存在"]}]))
        expect_red("seq 答案缺失", miss_seq, old95, "seq 答案")

        # 路径六：历史 override 答案缺失 → 红灯
        miss = load_prev_meta(write_prev(root / "e", new100, "2026-10-30", m1["epochs"],
                                         {str(TODAY_IDX): "不存在"}))
        expect_red("当日钉住答案缺失", miss, new100, "缺失")

        # 路径七：未来 since → 红灯（now-anchor 禁止预排未来）
        future = load_prev_meta(write_prev(root / "f", old95, "2026-10-30",
                                           [{"since": 0, "size": 95}, {"since": 25, "size": 100}]))
        expect_red("预排未来 epoch", future, new100, "禁止预排未来")

        # 路径八：legacy-seq 长度不符 → 红灯
        legacy_bad = load_prev_meta(write_prev(root / "h", old95, "2026-10-30", ep95))
        legacy_bad["legacySeq"] = {"0": ["a", "b"]}
        expect_red("legacy-seq 长度不符", legacy_bad, old95, "legacy-seq 长度不符")

        # 路径九：legacy-seq 注入历史真实序列 → epoch0 seq 以注入值为准
        legacy_ok = load_prev_meta(write_prev(root / "i", old95, "2026-10-30", ep95))
        legacy_ok["legacySeq"] = {"0": old95}
        expect_ok("legacy-seq 注入历史序列", legacy_ok, old95,
                  {"epochDate": "2026-10-30",
                   "epochs": [{"since": 0, "size": 95, "seq": old95}],
                   "overrides": {}})

        # 路径十：首次构建 → 首 epoch + 冻结 seq + 空钉住
        first = load_prev_meta(root / "empty")
        expect_ok("首次构建产出首个 epoch+seq", first, old95,
                  {"epochDate": "2026-10-30",
                   "epochs": [{"since": 0, "size": 95, "seq": seq0}],
                   "overrides": {}})

        # 路径十一：旧版产物（无 overrides 字段）→ 无钉住正常运行
        legacy_dir = root / "legacy"
        legacy_dir.mkdir(parents=True)
        (legacy_dir / "puzzles.json").write_text(json.dumps([{"answer": i} for i in range(95)]), encoding="utf-8")
        legacy = load_prev_meta(legacy_dir)
        assert legacy["overrideAnswers"] == {}, legacy
        print("  ok 旧版产物（无 overrides 字段）正常运行")

        # 路径十二：无扩题（内容日）→ 元数据原样保留（补齐 seq）
        nochange = load_prev_meta(write_prev(root / "g", old95, "2026-10-30", ep95))
        expect_ok("无扩题时元数据原样+seq 补齐", nochange, old95,
                  {"epochDate": "2026-10-30",
                   "epochs": [{"since": 0, "size": 95, "seq": seq0}],
                   "overrides": {}})

    print("epochs 自测全部通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
