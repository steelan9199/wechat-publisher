#!/usr/bin/env python
"""Manim 版本守���校验 —— 确认本机仍是「社区版 0.21.0」且文档结论依然成立。

为什么需要这个脚本：
    本技能文档里所有 API 结论都是在 0.21.0 上实测的。一旦本机升级到0.22+，
    这些结论会**静默失效**——代码照样能跑，但写法可能已经不是官方推荐，
    或者反过来：文档说「某 API 不存在」，新版本却加上了。
    本脚本把「版本」和「关键 API 事实」变成可执行的断言，
    一旦漂移立刻报警，而不是等到渲染失败才发现。

用法:
    python check_manim_version.py            # 人读格式
    python check_manim_version.py --json     # 机器可读

退出码:
    0 = 全部通过（版本与来源正确，且所有锚点符合文档记录）
    1 = 有锚点漂移（API 事实与文档不符，必须更新文档）
    2 = 版本或来源不符（不再是社区版 0.21.0，文档需整体复核）
"""
from __future__ import annotations

import argparse
import json
import sys

# ---------------------------------------------------------------- 期望值
EXPECTED_VERSION = "0.21.0"
EXPECTED_DIST = "manim-0.21.0.dist-info"
# 社区版 METADATA 里的 Author 字段（3b1b 版不含 "Manim Community Developers"）
COMMUNITY_AUTHOR_MARK = "Manim Community Developers"

# ---------------------------------------------------------------- 版本锚点
# 每条 = (编号, 说明, 实际值, 期望值)
# 期望值True/False 表示「该名字/属性 应该 / 不应该 存在」
ANCHORS: list[tuple[str, str, object, object]] = [
    ("A1", "manim 命名空间不含 CYAN（3D 霓虹色须自定义十六进制）",
     None, False),
    ("A2", "manim 命名空间不含 MAGENTA",
     None, False),
    ("A3", "manim 命名空间含 TEAL（对照项：并非所有颜色都缺）",
     None, True),
    ("A4", "Scene 无 time_since_start（用了必崩）",
     None, False),
    ("A5", "Scene 有 self.time（float，随play 推进）",
     None, True),
    ("A6", "interpolate_color 第三参数名为 alpha（不是 f）",
     None, "alpha"),
]


def _probe() -> dict:
    """采集实际状态。全部用 try 包裹，任一探测失败不应让脚本崩掉。"""
    out: dict = {"probes": {}, "anchors": {}, "errors": []}

    try:
        import manim
        from manim import Scene
        import inspect
        try:
            import importlib.metadata as md
            out["probes"]["dist_version"] = md.version("manim")
        except Exception as exc:                      # pragma: no cover
            out["errors"].append(f"读 dist 版本失败: {exc}")
        out["probes"]["__version__"] = getattr(manim, "__version__", "?")
        out["probes"]["file"] = getattr(manim, "__file__", "?")
        out["probes"]["dist_info_present"] = any(
            p.name == EXPECTED_DIST
            for p in __import__("pathlib").Path(manim.__file__).parent.parent
            .glob("manim-*.dist-info")
        )
        # 社区版来源识别
        try:
            import pathlib
            di = next(pathlib.Path(manim.__file__).parent.parent
                      .glob("manim-*.dist-info"), None)
            if di is not None:
                meta = (di / "METADATA")
                if meta.exists():
                    txt = meta.read_text(encoding="utf-8", errors="replace")
                    author = next((l.split(":", 1)[1].strip()
                                   for l in txt.splitlines()
                                   if l.startswith("Author:")), "")
                    out["probes"]["author"] = author
                    out["probes"]["is_community"] = \
                        COMMUNITY_AUTHOR_MARK in author
        except Exception as exc:
            out["errors"].append(f"读 METADATA 失败: {exc}")

        ns = set(dir(manim))
        out["anchors"]["A1"] = "CYAN" in ns
        out["anchors"]["A2"] = "MAGENTA" in ns
        out["anchors"]["A3"] = "TEAL" in ns
        out["anchors"]["A4"] = hasattr(Scene, "time_since_start")
        out["anchors"]["A5"] = hasattr(Scene, "time")
        try:
            from manim import interpolate_color
            params = list(inspect.signature(interpolate_color).parameters)
            out["anchors"]["A6"] = params[2] if len(params) > 2 else "?"
        except Exception as exc:
            out["errors"].append(f"读 interpolate_color 签名失败: {exc}")
            out["anchors"]["A6"] = "?"
    except Exception as exc:
        out["errors"].append(f"导入 manim 失败: {exc}")
    return out


def _judge(data: dict) -> tuple[int, list[str], list[str], list[str]]:
    """返回 (exit_code, 版本问题, 锚点漂移, 错误)"""
    p = data["probes"]
    a = data["anchors"]
    ver_issues: list[str] = []
    drift: list[str] = []

    dv = p.get("dist_version")
    if dv != EXPECTED_VERSION:
        ver_issues.append(
            f"版本不符：期望 {EXPECTED_VERSION}，实际 {dv}")
    if not p.get("dist_info_present"):
        ver_issues.append(f"未找到 {EXPECTED_DIST}")
    if p.get("is_community") is not True:
        ver_issues.append(
            f"来源非社区版：Author={p.get('author', '?')!r} "
            f"（不含 {COMMUNITY_AUTHOR_MARK!r}）")

    for code, desc, _, expect in ANCHORS:
        actual = a.get(code)
        if actual != expect:
            drift.append(f"[{code}] {desc}：期望 {expect!r}，实际 {actual!r}")
    return (0 if not (ver_issues or drift) else (1 if not ver_issues else 2),
            ver_issues, drift, data["errors"])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true", help="输出 JSON")
    args = ap.parse_args()

    data = _probe()
    code, ver_issues, drift, errors = _judge(data)
    p = data["probes"]

    if args.json:
        print(json.dumps({
            "exit_code": code, "probes": p, "anchors": data["anchors"],
            "version_issues": ver_issues, "anchor_drift": drift,
            "errors": errors,
        }, ensure_ascii=False, indent=2))
        return code

    print("=" * 62)
    print("Manim 版本守门校验（期望：社区版 0.21.0）")
    print("=" * 62)
    print(f"  版本        : {p.get('dist_version', '?')}")
    print(f"  库来源      : {p.get('author', '?')[:60]}")
    print(f"  社区版      : {'是' if p.get('is_community') else '否'}")
    print(f"  安装路径    : {p.get('file', '?')}")
    print("-" * 62)

    print("版本锚点：")
    for c, desc, _, expect in ANCHORS:
        actual = data["anchors"].get(c)
        flag = "OK  " if actual == expect else "DRIFT"
        print(f"  [{flag}] {c}  {desc}")
        print(f"           期望 {expect!r} / 实际 {actual!r}")
    print("-" * 62)

    for e in errors:
        print(f"  [ERROR] {e}")

    if code == 0:
        print("结论：通过。文档中的 0.21.0 结论依然成立，可放心使用。")
    elif code == 1:
        print("结论：锚点漂移！API 事实已变，请更新 references/ 下的文档。")
    else:
        print("结论：版本或来源不符！本技能文档需整体复核，")
        print("      请逐条重跑 30秒自查法并更新已实测结论表。")
    return code


if __name__ == "__main__":
    raise SystemExit(main())
