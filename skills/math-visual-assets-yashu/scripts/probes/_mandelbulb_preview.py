# -*- coding: utf-8 -*-
"""Mandelbulb 复盘：相机/曝光变体预览（第一轮）。

一次进程渲多个候选，共用一次 kernel 编译，避免反复付 12s 编译成本。

用法：
    python _mandelbulb_preview.py
输出：<scripts>/_out/_mandelbulb/v1_*.png … v4_*.png
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

VARIANTS = [
    # key,               azim, elev, k,   light, thin, glow, contrast, iters, zoom
    ("v1_az18_el26",      18,  26, 0.95, 0.62, 0.50, 0.14, 1.00, 12, 0.78),
    ("v2_az-40_el22",    -40,  22, 0.95, 0.62, 0.50, 0.14, 1.00, 12, 0.78),
    ("v3_az35_el18_dim",  35,  18, 0.95, 0.50, 0.45, 0.10, 1.05, 14, 0.80),
    ("v4_az60_el30",      60,  30, 0.95, 0.58, 0.55, 0.12, 1.00, 14, 0.75),
]

for key, az, el, k, li, th, gl, ct, it, zm in VARIANTS:
    img = trace_surface(None, [-1.45] * 3, [1.45] * 3, W, H, SS,
                        azim=az, elev=el, k=k, maxsteps=420, glow=gl,
                        light=li, thin=th, zoom=zm, contrast=ct,
                        kind=F_MANDELBULB, p0=(8.0, float(it), 0.0))
    save(img, key, OUT)
    print("[%6.1fs] %s" % (time.time() - t0, key), flush=True)
