#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
字幕纠错 - 确定性后处理脚本
职责（仅做机械、可复现的部分）：
  1. 上下文感知地删除口语填充词（默认清单，可自定义）
  2. 轻度清理残留的重复标点
说明：专有名词的「错写→正字」归一、以及其他音近错别字修正，由 AI 在调用本脚本前完成；
本脚本只负责把 AI 已纠错后的文本再做一遍填充词清理与标点规整。
输入文件只读，绝不修改；输出为新文件（默认 原名_corrected.txt）。
仅依赖 Python 标准库，可直接用任意 python3 运行。
"""
import argparse
import json
import re
from pathlib import Path

# 默认安全填充词（边界感知删除，基本不会破坏正常语法）
DEFAULT_FILLERS = [
    "啊", "额", "嗯", "呃", "诶", "恩", "噢", "哦", "唉", "呀", "嘛", "哇", "嘞", "呗",
]

PUNCT = "，。！？；：、…—（）()“”‘’《》【】\"'"


def read_text(path):
    """尽可能用常见中文编码读取，原文件只读。"""
    for enc in ("utf-8-sig", "utf-8", "gbk", "gb18030"):
        try:
            return Path(path).read_text(encoding=enc)
        except (UnicodeDecodeError, UnicodeError):
            continue
    return Path(path).read_text(encoding="utf-8", errors="replace")


def remove_fillers(text, fillers):
    """边界感知地删除填充词：仅当其前后为 行首/标点/中文/空白 时才删。"""
    counts = {}
    ctx = set(PUNCT) | {" ", "\t", "\n", "\r", "　", " "}
    alt = "|".join(re.escape(f) for f in sorted(fillers, key=len, reverse=True))
    pat = re.compile("(" + alt + ")")

    def repl(m):
        f = m.group(1)
        start, end = m.start(), m.end()
        prev = text[start - 1] if start > 0 else ""
        nxt = text[end] if end < len(text) else ""
        ok_prev = (start == 0) or (prev in ctx) or ("\u4e00" <= prev <= "\u9fff")
        ok_next = (end >= len(text)) or (nxt in ctx) or ("\u4e00" <= nxt <= "\u9fff")
        if ok_prev and ok_next:
            counts[f] = counts.get(f, 0) + 1
            return ""
        return f

    new_text = pat.sub(repl, text)
    return new_text, counts


def cleanup_punct(text):
    """清理因删填充词产生的重复/行首标点。"""
    text = re.sub(r"([，。！？；：、])\1+", r"\1", text)
    text = re.sub(r"[，。！？；：、]{2,}", lambda m: m.group()[-1], text)
    text = re.sub(r"(?m)^[，。！？；：、\s]+", "", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text


def main():
    ap = argparse.ArgumentParser(description="字幕纠错 - 填充词清理与标点规整")
    ap.add_argument("-i", "--input", required=True, help="待处理文本路径（AI 已做过语义纠错）")
    ap.add_argument("-o", "--output", default=None, help="输出路径，默认 原名_corrected.txt")
    ap.add_argument("--fillers", nargs="*", default=None, help="自定义填充词清单")
    ap.add_argument("--no-filler", action="store_true", help="跳过填充词删除")
    ap.add_argument("--encoding-out", default="utf-8-sig", help="输出编码，默认 utf-8-sig")
    args = ap.parse_args()

    text = read_text(args.input)

    fillers = DEFAULT_FILLERS if args.fillers is None else args.fillers
    report = {}
    if not args.no_filler and fillers:
        text, fc = remove_fillers(text, fillers)
        report["fillers"] = fc

    text = cleanup_punct(text)

    out = args.output
    if not out:
        p = Path(args.input)
        out = str(p.parent / (p.stem + "_corrected" + p.suffix))
    Path(out).write_text(text, encoding=args.encoding_out)

    print("OUTPUT:" + out)
    print("REPORT:" + json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
