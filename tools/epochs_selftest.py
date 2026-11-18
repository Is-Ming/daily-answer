# -*- coding: utf-8 -*-
"""epochs 机制自测（now-anchor）：立即锚定 / 同日沿袭 / 各类红灯路径。

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


def old_day_answer(answers: list, day: int, epochs: list, bank_size: int) -> str:
    """按旧口径推导 day 的答案（selftest 期望值用）。"""
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
    assert meta == want, f"{name}: {meta} != {want}"
    print(f"  ok {name} -> overrides={meta['overrides']}")


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

        # 路径一：立即锚定——扩题 epoch since=当天，当日钉住 = 旧口径当日题
        prev = load_prev_meta(write_prev(root / "a", old95, "2026-10-30", ep95))
        pinned = old_day_answer(old95, TODAY_IDX, ep95, 95)
        new100 = old95 + [f"new{i:02d}" for i in range(5)]
        expect_ok("立即锚定 since=当天+当日钉住", prev, new100,
                  {"epochDate": "2026-10-30",
                   "epochs": [{"since": 0, "size": 95}, {"since": TODAY_IDX, "size": 100}],
                   "overrides": {str(TODAY_IDX): new100.index(pinned)}})
        print(f"     （当日钉住答案 = {pinned}）")

        # 路径一b：同日二次扩题沿袭当日答案（下标重译）
        prev2 = load_prev_meta(write_prev(root / "b", new100, "2026-10-30",
                                          [{"since": 0, "size": 95}, {"since": TODAY_IDX, "size": 100}],
                                          {str(TODAY_IDX): new100.index(pinned)}))
        new110 = new100 + [f"new{i:02d}" for i in range(5, 15)]
        expect_ok("同日二次扩题沿袭当日答案", prev2, new110,
                  {"epochDate": "2026-10-30",
                   "epochs": [{"since": 0, "size": 95}, {"since": TODAY_IDX, "size": 110}],
                   "overrides": {str(TODAY_IDX): new110.index(pinned)}})

        # 路径二：篡改历史 epoch → 红灯（size 一致性校验拦截）
        tampered = load_prev_meta(write_prev(root / "c", old95, "2026-10-30", [{"since": 0, "size": 94}]))
        expect_red("篡改历史 epoch size", tampered, old95, "≠ 成品题数")

        # 路径三：删题 → 红灯
        shrink = load_prev_meta(write_prev(root / "d", new100, "2026-10-30",
                                           [{"since": 0, "size": 95}, {"since": TODAY_IDX, "size": 100}]))
        expect_red("删题 100→95", shrink, old95, "禁止删题")

        # 路径四：历史 override 答案缺失 → 红灯
        miss = load_prev_meta(write_prev(root / "e", new100, "2026-10-30",
                                         [{"since": 0, "size": 95}, {"since": TODAY_IDX, "size": 100}],
                                         {str(TODAY_IDX): "不存在"}))
        expect_red("当日钉住答案缺失", miss, new100, "缺失")

        # 路径五：未来 since → 红灯（now-anchor 禁止预排未来）
        future = load_prev_meta(write_prev(root / "f", old95, "2026-10-30",
                                           [{"since": 0, "size": 95}, {"since": 25, "size": 100}]))
        expect_red("预排未来 epoch", future, new100, "禁止预排未来")

        # 路径六：首次构建 → 首 epoch + 空钉住
        first = load_prev_meta(root / "empty")
        expect_ok("首次构建产出首个 epoch", first, old95,
                  {"epochDate": "2026-10-30", "epochs": [{"since": 0, "size": 95}], "overrides": {}})

        # 路径七：旧版产物（无 overrides 字段）→ 无钉住正常运行
        legacy_dir = root / "legacy"
        legacy_dir.mkdir(parents=True)
        (legacy_dir / "puzzles.json").write_text(json.dumps([{"answer": i} for i in range(95)]), encoding="utf-8")
        legacy = load_prev_meta(legacy_dir)
        assert legacy["overrideAnswers"] == {}, legacy
        print("  ok 旧版产物（无 overrides 字段）正常运行")

        # 路径八：无扩题（内容日）→ 元数据原样保留
        nochange = load_prev_meta(write_prev(root / "g", old95, "2026-10-30", ep95))
        expect_ok("无扩题时元数据原样", nochange, old95,
                  {"epochDate": "2026-10-30", "epochs": [{"since": 0, "size": 95}], "overrides": {}})

    print("epochs 自测全部通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
