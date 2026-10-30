# -*- coding: utf-8 -*-
"""谜底题库校验器（CI 门禁）。

独立于构建产物运行：校验 seed/ 全部硬规则 + 成品不变量。
任一失败以非零退出码终止。

用法：python tools/check.py [--seed <目录>]
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_bank import build  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description="谜底题库校验器")
    ap.add_argument("--seed", default=str(Path(__file__).resolve().parents[1] / "seed"))
    args = ap.parse_args()

    _, errors, total = build(Path(args.seed))
    print(f"校验 {total} 条题源，问题 {len(errors)} 个")
    for x in errors:
        print(" ✗", x)
    if errors:
        print("FAIL")
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
