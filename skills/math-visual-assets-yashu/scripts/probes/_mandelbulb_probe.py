# -*- coding: utf-8 -*-
"""Mandelbulb 复盘 §3A/§3B：证明旧场二维塌缩 + 验证新 DE。

(a) 旧场 c = x + i*(y+z) 只依赖 (x, y+z) —— 取两张保持 y+z 不变的切片应逐位相同。
(b) 新的三维球坐标距离估计：应满足 min<0、|grad|<=1、frac<0 合理。

用法：
    python _mandelbulb_probe.py
输出：<scripts>/_out/_mandelbulb/_slice_de.png、_slice_old.png
"""
import os
import sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.join(HERE, os.pardir)
OUT = os.environ.get("MATH3D_OUT") or os.path.join(SCRIPTS, "_out", "_mandelbulb")
os.makedirs(OUT, exist_ok=True)

POWER = 8.0
ITERS = 12
BAIL = 2.0


def field_old(x, y, z):
    """旧场景的场，向量化：c = x + i*(y+z)。"""
    c = (x + 1j * y) + 1j * z
    zz = np.zeros_like(c)
    esc = np.zeros(c.shape, bool)
    with np.errstate(over="ignore", invalid="ignore"):
        for _ in range(ITERS):
            r = np.abs(zz)
            zz = zz * np.power(np.maximum(r, 1e-12), POWER - 1) + c
            esc |= (~np.isfinite(r)) | (r > 1e10)
            zz = np.where(esc, 0.0, zz)
    return ~esc


def de_correct(x, y, z, signed=True):
    """标准三维曼德球距离估计（iq）。"""
    zx = np.array(x, float)
    zy = np.array(y, float)
    zz = np.array(z, float)
    dr = np.ones_like(zx)
    escaped = np.zeros(zx.shape, bool)
    r_esc = np.zeros(zx.shape)          # 逃逸那一刻的 |z|
    r = np.zeros(zx.shape)
    for _ in range(int(ITERS)):
        r = np.sqrt(zx * zx + zy * zy + zz * zz)
        newly = (~escaped) & (r > BAIL)
        r_esc = np.where(newly, r, r_esc)
        escaped |= newly
        rs = np.where(r > 1e-12, r, 1.0)
        theta = np.arccos(np.clip(zz / rs, -1.0, 1.0))
        phi = np.arctan2(zy, zx)
        # 只有未逃逸的点推进 dr
        dr = np.where(escaped, dr, np.power(rs, POWER - 1) * POWER * dr + 1.0)
        zr = np.power(rs, POWER)
        theta = theta * POWER
        phi = phi * POWER
        st = np.sin(theta)
        nx_ = zr * st * np.cos(phi) + x
        ny_ = zr * st * np.sin(phi) + y
        nz_ = zr * np.cos(theta) + z
        keep = ~escaped
        zx = np.where(keep, nx_, 0.0)
        zy = np.where(keep, ny_, 0.0)
        zz = np.where(keep, nz_, 0.0)
    r = np.where(escaped, r_esc, np.sqrt(zx * zx + zy * zy + zz * zz))
    de = 0.5 * np.log(np.maximum(r, 1e-12)) * r / dr
    de = np.abs(de)
    if not signed:
        return de
    return np.where(escaped, de, -de)


R = 1.5
n = 900
g = np.linspace(-R, R, n)
X, Z = np.meshgrid(g, g, indexing="ij")   # 切片 y = 0

# --- (a) 旧场：任何 y 的切片应完全相同，即只依赖 (x, y+z)。
#         把 y=0 切片与 y=+0.4 且 z 平移 -0.4 的切片比较（保持 y+z 不变）。
o0 = field_old(X, np.zeros_like(X), Z)
o1 = field_old(X, np.full_like(X, 0.4), Z - 0.4)   # y+z 保持不变
print("OLD field  : depends only on (x, y+z)?  identical slices ->",
      bool(np.array_equal(o0, o1)))
print("OLD field  : fraction inside =", float(o0.mean()))

# --- (b) 正确的三维 DE，在 y=0 切片上
d = de_correct(X, np.zeros_like(X), Z)
print("NEW DE     : min = %.6f  max = %.6f  frac<0 = %.4f"
      % (d.min(), d.max(), float((d < 0).mean())))
gy, gx = np.gradient(d, g, g)
print("NEW DE     : median |grad| = %.4f"
      % float(np.median(np.sqrt(gx ** 2 + gy ** 2))))

vis = np.where(d < 0, 0.15, 1.0 - np.clip(d / 0.6, 0, 1))
Image.fromarray((np.flipud(vis) * 255).astype(np.uint8)).save(
    os.path.join(OUT, "_slice_de.png"))
vis2 = np.where(~field_old(X, np.zeros_like(X), Z), 0.15, 1.0)
Image.fromarray((np.flipud(vis2) * 255).astype(np.uint8)).save(
    os.path.join(OUT, "_slice_old.png"))
print("wrote slices ->", OUT)
