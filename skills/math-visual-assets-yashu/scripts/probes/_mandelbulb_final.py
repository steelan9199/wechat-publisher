# -*- coding: utf-8 -*-
"""Mandelbulb 复盘：最终曝光二选一（满分辨率 860）。

F2 是最终采用的一组（已写入 gallery_gpu.mandelbulb）。

用法：
    python _mandelbulb_final.py
输出：<scripts>/_out/_mandelbulb/F1.png、F2.png
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

W = H = 860
SS = 2
t0 = time.time()
V = [
    ("F1", dict(azim=35, elev=30, k=0.95, maxsteps=420, glow=0.07,
                light=0.50, thin=0.32, zoom=0.68, contrast=1.12, p0=(8.0, 16.0, 0.0))),
    ("F2", dict(azim=35, elev=30, k=0.95, maxsteps=420, glow=0.12,
                light=0.62, thin=0.45, zoom=0.68, contrast=1.00, p0=(8.0, 16.0, 0.0))),
]
for key, kw in V:
    img = trace_surface(None, [-1.45] * 3, [1.45] * 3, W, H, SS,
                        kind=F_MANDELBULB, **kw)
    save(img, key, OUT)
    print("[%6.1fs] %s" % (time.time() - t0, key), flush=True)
