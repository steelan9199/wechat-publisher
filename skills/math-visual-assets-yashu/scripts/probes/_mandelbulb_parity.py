# -*- coding: utf-8 -*-
"""Mandelbulb 复盘 §3D：CPU 引擎 vs GPU 引擎，同场景同图像的 IoU 对照。

技能不变量：gallery.py 与 gallery_gpu.py 定义相同场景，只换渲染后端。
本脚本用技能既有的轮廓 IoU 判据验证新的曼德球满足它。

注意：SS 必须用 2 —— `ss=1` 是引擎没走过的分支（复盘坑 6），
用它做对照会得到"下半幅全黑"的假差异。

用法：
    python _mandelbulb_parity.py
输出：<scripts>/_out/_mandelbulb/_parity_cpu.png、_parity_gpu.png
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.join(HERE, os.pardir)
sys.path.insert(0, SCRIPTS)
OUT = os.environ.get("MATH3D_OUT") or os.path.join(SCRIPTS, "_out", "_mandelbulb")
os.makedirs(OUT, exist_ok=True)
os.environ.setdefault("MATH3D_OUT", OUT)

import time
import numpy as np

import gallery as C
import gallery_gpu as G

N = 240
C.W = C.H = N; C.SS = 2
G.W = G.H = N; G.SS = 2

t0 = time.time()
cpu = C.mandelbulb()
print("[%5.1fs] CPU done" % (time.time() - t0), flush=True)
gpu = G.mandelbulb()
print("[%5.1fs] GPU done" % (time.time() - t0), flush=True)


def silhouette(img):
    """主体 = 与背景渐变（行中位数）不同的像素。"""
    g = img.mean(2)
    med = np.median(g, axis=1, keepdims=True)
    return np.abs(g - med) > 0.02


a, b = silhouette(cpu), silhouette(gpu)
inter = (a & b).sum()
union = (a | b).sum()
print("CPU subj px %6d   GPU subj px %6d" % (a.sum(), b.sum()))
print("silhouette IoU = %.5f" % (inter / max(union, 1)))
print("max abs diff   = %.6f" % np.abs(cpu - gpu).max())

from PIL import Image
Image.fromarray((np.clip(cpu, 0, 1) * 255).astype(np.uint8)).save(
    os.path.join(OUT, "_parity_cpu.png"))
Image.fromarray((np.clip(gpu, 0, 1) * 255).astype(np.uint8)).save(
    os.path.join(OUT, "_parity_gpu.png"))
print("wrote ->", OUT)
