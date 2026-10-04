#!/usr/bin/env python3
"""
列出 Windows 回收站中的文件。

口径：严格对齐资源管理器 GUI —— 只统计「元数据($I) + 内容($R)」双全的有效条目。
这与 Shell 的 SHQueryRecycleBin / 资源管理器显示的数字一致。

纯标准库，不依赖 COM，不使用 PowerShell，因此不会向回收站投递临时脚本。

用法：
    python list_recycle_bin.py                 # 默认最多显示 6 个
    python list_recycle_bin.py --all           # 显示全部
    python list_recycle_bin.py --limit 20      # 自定义上限
    python list_recycle_bin.py --drive D       # 只看某个盘
    python list_recycle_bin.py --json          # 输出 JSON
"""

import argparse
import ctypes
import ctypes.wintypes as wt
import datetime
import json
import os
import struct
import sys

# $I 元数据：8 字节版本号(恒为2) + 8 字节原大小 + 8 字节删除时间(FILETIME) + 原始路径(UTF-16LE, 以 \0\0 结尾)
_I_HEADER = 24
_FILETIME_EPOCH_DELTA = 11644473600


def list_drives():
    """返回本机所有已就绪的盘符（含可移动盘），保持 C: D: E: F: 顺序。"""
    out = []
    mask = ctypes.windll.kernel32.GetLogicalDrives()
    for i, ch in enumerate("ABCDEFGHIJKLMNOPQRSTUVWXYZ"):
        if mask & (1 << i):
            out.append(f"{ch}:")
    return out


def filetime_to_str(ft):
    """FILETIME 转 'YYYY-MM-DD HH:MM'；无效值返回 '?'。"""
    if not ft or ft <= 0:
        return "?"
    try:
        return datetime.datetime.fromtimestamp(
            ft / 1e7 - _FILETIME_EPOCH_DELTA
        ).strftime("%Y-%m-%d %H:%M")
    except (ValueError, OSError, OverflowError):
        return "?"


def parse_meta(meta_path):
    """解析一个 $I 文件，返回 (原始路径, 原大小, 删除时间字符串)；失败返回 None。"""
    try:
        with open(meta_path, "rb") as f:
            raw = f.read()
    except OSError:
        return None
    if len(raw) < _I_HEADER + 2:
        return None
    try:
        size = struct.unpack_from("<q", raw, 8)[0]
        ftime = struct.unpack_from("<q", raw, 16)[0]
        orig = raw[_I_HEADER:].decode("utf-16-le", "replace").rstrip("\x00")
    except (struct.error, UnicodeDecodeError):
        return None
    if not orig:
        return None
    return orig, size, filetime_to_str(ftime)


def scan_drive(drive):
    """扫描单个盘的真实回收站条目。

    返回 (valid, orphan)：
      valid  = [(原始路径, 实际占用字节, 删除时间, 内容是否目录), ...]  GUI 会显示的项
      orphan = 原始大小（内容已丢失的幽灵元数据条数统计用）

    仅统计当前用户 SID 目录；S-1-5-18 等系统 SID 目录是 desktop.ini，跳过。
    """
    # 注意：os.path.join("D:", "$Recycle.BIN") 会得到 "D:$Recycle.BIN"（缺反斜杠，
    # 因为 "D:" 被当作驱动器相对路径），必须显式补分隔符。
    root = drive if drive.endswith("\\") else drive + "\\"
    base = os.path.join(root, "$Recycle.BIN")
    if not os.path.isdir(base):
        return [], 0

    valid, orphan = [], 0
    try:
        sids = os.listdir(base)
    except OSError:
        return [], 0

    for sid in sids:
        if not sid.startswith("S-1-5-21"):  # 跳过 S-1-5-18(系统) 等
            continue
        sdir = os.path.join(base, sid)
        try:
            names = os.listdir(sdir)
        except OSError:
            continue

        for name in names:
            if not name.startswith("$I"):
                continue
            parsed = parse_meta(os.path.join(sdir, name))
            if parsed is None:
                continue
            orig, osize, when = parsed

            # 配对的 $R 内容文件决定该条目是否真实存在于 GUI
            payload = os.path.join(sdir, "$R" + name[2:])
            if not os.path.exists(payload):
                orphan += 1
                continue

            is_dir = os.path.isdir(payload)
            if is_dir:
                real = folder_size(payload)
            else:
                try:
                    real = os.path.getsize(payload)
                except OSError:
                    real = 0
            valid.append((orig, real, when, is_dir))

    valid.sort(key=lambda x: x[2], reverse=True)  # 删除时间倒序：新的在前
    return valid, orphan


def folder_size(path):
    """递归计算目录占用字节数；失败返回 0。"""
    total = 0
    for root, _dirs, files in os.walk(path):
        for fn in files:
            try:
                total += os.path.getsize(os.path.join(root, fn))
            except OSError:
                pass
    return total


def human(n):
    """字节数转易读字符串。"""
    if n < 1024:
        return f"{n}B"
    for unit in ("KB", "MB", "GB"):
        n /= 1024.0
        if n < 1024 or unit == "GB":
            return f"{n:.1f}{unit}"
    return f"{n}B"


def query_gui_counts(drives):
    """用 SHQueryRecycleBinW 取 GUI 权威数字，用于交叉校验。失败返回 None。"""
    try:
        fn = ctypes.windll.shell32.SHQueryRecycleBinW
    except AttributeError:
        return None

    class RBINFO(ctypes.Structure):
        _fields_ = [
            ("cbSize", wt.DWORD),
            ("i64Size", ctypes.c_longlong),
            ("i64NumItems", ctypes.c_longlong),
        ]

    result = {}
    for d in drives:
        info = RBINFO()
        info.cbSize = ctypes.sizeof(RBINFO)
        try:
            if fn(d, ctypes.byref(info)) == 0:
                result[d] = (info.i64NumItems, info.i64Size)
        except OSError:
            continue
    return result or None


def main():
    ap = argparse.ArgumentParser(
        description="列出 Windows 回收站文件（口径对齐资源管理器）"
    )
    ap.add_argument("--all", action="store_true", help="显示全部条目")
    ap.add_argument("--limit", type=int, default=6, help="默认显示条数（默认 6）")
    ap.add_argument("--drive", help="只查指定盘，如 D")
    ap.add_argument("--json", action="store_true", help="输出 JSON")
    ap.add_argument(
        "--out", default="recycle_bin_report.txt", help="输出文件路径"
    )
    args = ap.parse_args()

    if args.all:
        limit = None
    elif args.limit >= 0:
        limit = args.limit
    else:
        limit = 6

    if args.drive:
        d = args.drive.rstrip("\\/:").upper()
        drives = [d if d.endswith(":") else d + ":"]
    else:
        drives = list_drives()

    entries, orphans, scanned = [], 0, []
    for d in drives:
        root = d if d.endswith("\\") else d + "\\"
        if not os.path.isdir(root):
            continue
        scanned.append(d)
        v, o = scan_drive(d)
        entries.extend((d, *item) for item in v)
        orphans += o

    # 删除时间已是字符串，倒序排一次让全局也按时间新→旧
    entries.sort(key=lambda x: x[3], reverse=True)
    total = len(entries)
    total_bytes = sum(e[2] for e in entries)

    gui = query_gui_counts(scanned)
    show = entries if limit is None else entries[:limit]

    if args.json:
        payload = {
            "total_items": total,
            "total_bytes": total_bytes,
            "orphan_meta_entries": orphans,
            "gui_counts": {k: {"items": v[0], "bytes": v[1]} for k, v in gui.items()}
            if gui
            else None,
            "items": [
                {
                    "drive": e[0],
                    "original_path": e[1],
                    "size": e[2],
                    "deleted_at": e[3],
                    "is_dir": e[4],
                }
                for e in show
            ],
        }
        text = json.dumps(payload, ensure_ascii=False, indent=2)
    else:
        L = []
        L.append("=" * 56)
        L.append("Windows 回收站清单（口径：与资源管理器一致）")
        L.append("=" * 56)
        L.append(f"有效条目总数：{total}")
        L.append(f"占用空间合计：{human(total_bytes)}（{total_bytes} 字节）")
        L.append(f"不可恢复残留：{orphans} 条（有元数据、内容已丢失，GUI 不显示）")
        L.append("")

        L.append("— 各盘分布 " + "-" * 40)
        for d in scanned:
            n = sum(1 for e in entries if e[0] == d)
            b = sum(e[2] for e in entries if e[0] == d)
            g = f"，GUI 报告 {gui[d][0]} 项" if gui and d in gui else ""
            L.append(f"  {d:<4} {n:>4} 项  {human(b):>10}{g}")
        L.append("")

        shown_label = "全部条目" if limit is None else f"前 {len(show)} 项（默认上限 6，用 --all 看全部）"
        L.append(f"— {shown_label} " + "-" * 40)
        if not entries:
            L.append("  （回收站为空）")
        for i, e in enumerate(entries if limit is None else show, 1):
            kind = "[目录]" if e[4] else "      "
            L.append(f"  {i:>3}. {kind} {e[3]}  {human(e[2]):>9}  {e[1]}")
        if limit is not None and total > limit:
            L.append(f"  …… 另有 {total - limit} 项未显示（--all 查看全部）")
        L.append("")

        if gui:
            mismatched = [
                (d, sum(1 for e in entries if e[0] == d), gui[d][0])
                for d in scanned
                if d in gui and sum(1 for e in entries if e[0] == d) != gui[d][0]
            ]
            L.append("— 交叉校验 " + "-" * 40)
            if mismatched:
                for d, mine, g in mismatched:
                    L.append(f"  ⚠ {d}：脚本 {mine} 项 vs GUI {g} 项")
            else:
                L.append("  ✓ 与 Shell 报告数字一致")
        L.append("")
        L.append("说明：回收站按盘隔离，此处已扫描 " + " ".join(scanned))
        text = "\n".join(L)

    # 始终写文件：stdout 在本机常常不回传
    try:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text)
    except OSError as e:
        print(f"[warn] 写文件失败：{e}")
    print(text)


if __name__ == "__main__":
    main()
