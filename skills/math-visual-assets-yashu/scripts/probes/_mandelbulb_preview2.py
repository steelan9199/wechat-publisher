# -*- coding: utf-8 -*-
"""Mandelbulb 复盘：曝光 / 相机网格（第二轮，一次进程）。

用法：
    python _mandelbulb_preview2.py
输出：<scripts>/_out/_mandelbulb/a_*.png … f_*.png
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

V = [
    # key,            az,  el, k,   light, thin, glow, contr, iters, zoom
    ("a_el20_i12",     35, 20, 0.95, 0.55, 0.40, 0.10, 1.00, 12, 0.70),
    ("b_el32_i12",     35, 32, 0.95, 0.55, 0.40, 0.10, 1.00, 12, 0.70),
    ("c_el20_i16",     35, 20, 0.95, 0.55, 0.40, 0.10, 1.00, 16, 0.70),
    ("d_el32_i16",     35, 32, 0.95, 0.55, 0.40, 0.10, 1.00, 16, 0.70),
    ("e_el45_i16",     35, 45, 0.95, 0.55, 0.40, 0.10, 1.00, 16, 0.70),
    ("f_dark_el26",    35, 26, 0.95, 0.42, 0.30, 0.06, 1.10, 16, 0.66),
]

for key, az, el, k, li, th, gl, ct, it, zm in V:
    img = trace_surface(None, [-1.45] * 3, [1.45] * 3, W, H, SS,
                        azim=az, elev=el, k=k, maxsteps=420, glow=gl,
                        light=li, thin=th, zoom=zm, contrast=ct,
                        kind=F_MANDELBULB, p0=(8.0, float(it), 0.0))
    save(img, key, OUT)
    print("[%6.1fs] %s" % (time.time() - t0, key), flush=True)
