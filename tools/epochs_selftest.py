# -*- coding: utf-8 -*-
"""epochs 机制自测：扩题追加 / 篡改历史 / 删题 三条路径。

直接调用 build_bank 的解析函数，不依赖 git 与真实成品。
用法：python tools/epochs_selftest.py（静默通过，任何断言失败以非零退出）
"""
import json
import sys
import tempfile
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_bank import load_prev_meta, resolve_meta  # noqa: E402

# 与 build_bank 的"次日生效"对齐：2026-10-30 + 18 天 = 自测基准日 2026-11-17
TODAY = date(2026, 11, 17)
NEXT_DAY_INDEX = 19


def write_prev(dir_path: Path, count: int, epoch_date: str, epochs: list) -> Path:
    dir_path.mkdir(parents=True, exist_ok=True)
    (dir_path / "puzzles.json").write_text(json.dumps([{"answer": i} for i in range(count)]), encoding="utf-8")
    (dir_path / "epochs.json").write_text(
        json.dumps({"epochDate": epoch_date, "epochs": epochs}, ensure_ascii=False), encoding="utf-8")
    return dir_path


def expect_ok(name: str, prev: dict, new_count: int, want: dict) -> None:
    meta, errors = resolve_meta(prev, new_count, TODAY)
    assert not errors, f"{name}: unexpected red {errors}"
    assert meta == want, f"{name}: {meta} != {want}"
    print(f"  ok {name} -> {meta['epochs']}")


def expect_red(name: str, prev: dict, new_count: int, frag: str) -> None:
    _, errors = resolve_meta(prev, new_count, TODAY)
    assert errors and any(frag in e for e in errors), f"{name}: expect red({frag}), got {errors}"
    print(f"  ok {name} -> red: {errors[0]}")


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)

        # 路径一：95 → 100 扩题，自动追加次日 epoch
        prev = load_prev_meta(write_prev(root / "a", 95, "2026-10-30", [{"since": 0, "size": 95}]))
        expect_ok("扩题 95→100 追加次日 epoch", prev, 100,
                  {"epochDate": "2026-10-30",
                   "epochs": [{"since": 0, "size": 95}, {"since": NEXT_DAY_INDEX, "size": 100}]})

        # 路径一b：同日多次扩题合并（size 已是 100 再扩到 110，since 不变）
        prev2 = load_prev_meta(write_prev(root / "b", 100, "2026-10-30",
                                          [{"since": 0, "size": 95}, {"since": NEXT_DAY_INDEX, "size": 100}]))
        expect_ok("同日二次扩题合并", prev2, 110,
                  {"epochDate": "2026-10-30",
                   "epochs": [{"since": 0, "size": 95}, {"since": NEXT_DAY_INDEX, "size": 110}]})

        # 路径二：篡改历史 epoch（上一版元数据与题数不一致）→ 红灯（size 一致性校验拦截）
        tampered = load_prev_meta(write_prev(root / "c", 95, "2026-10-30", [{"since": 0, "size": 95}]))
        tampered["epochs"] = [{"since": 0, "size": 94}]
        expect_red("篡改历史 epoch size", tampered, 95, "≠ 成品题数")

        # 路径三：删题（题数减少）→ 红灯
        shrink = load_prev_meta(write_prev(root / "d", 100, "2026-10-30",
                                           [{"since": 0, "size": 95}, {"since": NEXT_DAY_INDEX, "size": 100}]))
        expect_red("删题 100→95", shrink, 95, "禁止删题")

        # 附加：首次构建（无上一版）→ 首个 epoch + 缺省纪元日
        first = load_prev_meta(root / "empty")
        expect_ok("首次构建产出首个 epoch", first, 95,
                  {"epochDate": "2026-10-30", "epochs": [{"since": 0, "size": 95}]})

        # 附加：旧版产物（无 epochs.json）→ 按题数回构首 epoch
        legacy_dir = root / "legacy"
        legacy_dir.mkdir(parents=True)
        (legacy_dir / "puzzles.json").write_text(json.dumps([{"answer": i} for i in range(95)]), encoding="utf-8")
        legacy = load_prev_meta(legacy_dir)
        assert legacy == {"epochDate": "2026-10-30", "epochs": [{"since": 0, "size": 95}], "prevCount": 95}, legacy
        print("  ok 旧版产物（无 epochs.json）回构首 epoch")

        # 附加：since 未严格递增（系统日期回拨）→ 红灯
        back = load_prev_meta(write_prev(root / "e", 95, "2026-10-30", [{"since": 100, "size": 95}]))
        expect_red("since 时间回拨", back, 100, "未严格大于上一条")

    print("epochs 自测全部通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
