# -*- coding: utf-8 -*-
"""Mandelbulb 复盘 §2 坑 8：迭代次数敏感度扫描。

迭代数是**形状参数**不是性能旋钮。对 iters ∈ {4,6,8,12,20,40} 各渲一张，
再互相比较不同像素占比（4 次迭代与收敛解差约 22% 像素）。

用法：
    python _mandelbulb_iters.py
输出：<scripts>/_out/_mandelbulb/i04.png … i40.png
"""
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.join(HERE, os.pardir)
sys.path.insert(0, SCRIPTS)
OUT = os.environ.get("MATH3D_OUT") or os.path.join(SCRIPTS, "_out", "_mandelbulb")
os.makedirs(OUT, exist_ok=True)

from render3d_gpu import trace_surface, save, F_MANDELBULB

W = H = 430
SS = 2
t0 = time.time()
for it in (4, 6, 8, 12, 20, 40):
    img = trace_surface(None, [-1.45] * 3, [1.45] * 3, W, H, SS,
                        azim=35, elev=26, k=0.95, maxsteps=420, glow=0.08,
                        light=0.50, thin=0.35, zoom=0.68, contrast=1.05,
                        kind=F_MANDELBULB, p0=(8.0, float(it), 0.0))
    save(img, "i%02d" % it, OUT)
    print("[%6.1fs] iters=%d" % (time.time() - t0, it), flush=True)
