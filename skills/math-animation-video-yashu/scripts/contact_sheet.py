#!/usr/bin/env python
"""把视频抽帧拼成一张联系表（contact sheet），用于渲染后的自检。

必须先跑本脚本再看图核对，不要只凭"命令没报错"就交付。

用法:
    python contact_sheet.py <video.mp4> [--out sheet.png] [--every 3]
                            [--cols 3] [--rows 4] [--width 480]
                            [--start 0] [--auto] [--duration 0]

典型用法:
    # 全片概览：--auto 会按视频总长自动算every，保证 cols*rows 张图覆盖全片
    python contact_sheet.py out.mp4 --auto --cols 3 --rows 5 --out all.png

    # 只看结尾几帧（结尾卡片/ 闪白最容易漏检）
    python contact_sheet.py out.mp4 --start 28.5 --every 1.2 --cols 3 --rows 2
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys

FFMPEG_FALLBACK = (
    r"D:\software\ffmpeg\ffmpeg-2024-09-26-git-f43916e217-full_build\bin\ffmpeg.exe"
)
FFPROBE_FALLBACK = (
    r"D:\software\ffmpeg\ffmpeg-2024-09-26-git-f43916e217-full_build\bin\ffprobe.exe"
)


def _tool(name: str, fallback: str) -> str:
    found = shutil.which(name)
    if found:
        return found
    if os.path.exists(fallback):
        return fallback
    raise SystemExit(f"找不到 {name}：加入 PATH 或安装到 {fallback}")


def _duration(ffprobe: str, path: str) -> float:
    proc = subprocess.run(
        [ffprobe, "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", path],
        capture_output=True, text=True,
    )
    try:
        return float((proc.stdout or "0").strip())
    except ValueError:
        return 0.0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--out", default=None)
    ap.add_argument("--every", type=float, default=3.0,
                    help="每隔几秒取一帧（默认 3s；--auto 时自动计算）")
    ap.add_argument("--cols", type=int, default=3)
    ap.add_argument("--rows", type=int, default=4)
    ap.add_argument("--width", type=int, default=480, help="单帧宽度")
    ap.add_argument("--start", type=float, default=0.0,
                    help="从第几秒开始取帧（默认 0）。检查结尾段落必用")
    ap.add_argument("--duration", type=float, default=0.0,
                    help="配合 --start，限定取到第几秒（默认到片尾）")
    ap.add_argument("--auto", action="store_true",
                    help="按--start/--duration 之后的实际长度自动算 --every，"
                         "让 cols*rows 张图刚好覆盖该区间")
    args = ap.parse_args()

    if not os.path.exists(args.video):
        print(f"FAILED: 文件不存在 {args.video}", file=sys.stderr)
        return 1

    ffmpeg = _tool("ffmpeg", FFMPEG_FALLBACK)
    ffprobe = _tool("ffprobe", FFPROBE_FALLBACK)
    out = args.out or os.path.splitext(args.video)[0] + "_sheet.png"

    dur = _duration(ffprobe, args.video)
    if dur <= 0:
        print("FAILED: 读不出视频时长，先确认文件完整", file=sys.stderr)
        return 1

    span = args.duration if args.duration > 0 else max(dur - args.start, 0.1)
    every = args.every
    if args.auto:
        slots = max(args.cols * args.rows, 1)
        every = max(span / slots, 0.05)
    # 取帧区间不足时不要给出误导性的整片覆盖错觉
    covered = min(span, every * args.cols * args.rows)

    pre = []
    if args.start > 0:
        pre = ["-ss", f"{args.start:.3f}"]
    if args.duration > 0:
        pre += ["-t", f"{args.duration:.3f}"]

    vf = f"fps=1/{every:.4f},scale={args.width}:-1,tile={args.cols}x{args.rows}"
    proc = subprocess.run(
        [ffmpeg, "-y", "-v", "error", *pre, "-i", args.video, "-vf", vf,
         "-frames:v", "1", out],
        capture_output=True, text=True,
    )

    if proc.returncode != 0 or not os.path.exists(out):
        print(f"FAILED: {(proc.stderr or '')[-500:]}", file=sys.stderr)
        return 1

    print(f"duration={dur:.1f}s  区间=[{args.start:.1f}s, "
          f"{args.start + span:.1f}s)  every={every:.2f}s")
    print(f"覆盖={covered:.1f}s / 目标={span:.1f}s"
          + ("  ⚠️ 未覆盖全片，请调大 --rows 或减小 --every"
             if covered < span - 0.05 else ""))
    print(f"sheet={os.path.abspath(out)}")
    print("下一步：用读图工具打开这张图，逐项核对中文、公式可见性、元素重叠、运动是否真实。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
