# -*- coding: utf-8 -*-
"""Mandelbulb 复盘 §3C：用 numpy 复刻 render3d_gpu._march 并统计脱靶。

问题：渲染里的"蕾丝/透光"是真几何，还是光线脱靶（步数耗尽 / 过冲）？

判据：missed by marcher = 0 且 step-exhausted = 0 ⇒ 渲染器健康，问题不在几何。

用法：
    python _mandelbulb_march.py
输出：<scripts>/_out/_mandelbulb/_march_hits.png
"""
import math
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
R = 1.45
W = H = 300
AZ, EL = 35.0, 18.0
FOV = 30.0
K = 0.95
MAXSTEPS = 420


def de(px, py, pz):
    x, y, z = px, py, pz
    zx = np.array(x, float); zy = np.array(y, float); zz = np.array(z, float)
    dr = np.ones_like(zx)
    escaped = np.zeros(zx.shape, bool)
    r_esc = np.zeros(zx.shape)
    for _ in range(ITERS):
        r = np.sqrt(zx * zx + zy * zy + zz * zz)
        newly = (~escaped) & (r > 2.0)
        r_esc = np.where(newly, r, r_esc)
        escaped = escaped | newly
        rs = np.where(r > 1e-12, r, 1e-12)
        theta = np.arccos(np.clip(zz / rs, -1, 1)) * POWER
        phi = np.arctan2(zy, zx) * POWER
        dr = np.where(escaped, dr, np.power(rs, POWER - 1) * POWER * dr + 1.0)
        zr = np.power(rs, POWER)
        st = np.sin(theta)
        nx_ = zr * st * np.cos(phi) + x
        ny_ = zr * st * np.sin(phi) + y
        nz_ = zr * np.cos(theta) + z
        keep = ~escaped
        zx = np.where(keep, nx_, 0.0)
        zy = np.where(keep, ny_, 0.0)
        zz = np.where(keep, nz_, 0.0)
    r = np.where(escaped, r_esc, np.sqrt(zx * zx + zy * zy + zz * zz))
    r = np.maximum(r, 1e-12)
    d = 0.5 * np.log(r) * r / dr
    return np.where(escaped, np.abs(d), -np.abs(d))


# 相机（复刻 render3d_gpu._frame / _basis）
lo = np.array([-R] * 3); hi = np.array([R] * 3)
ctr = 0.5 * (lo + hi)
radius = 0.5 * float(np.linalg.norm(hi - lo))
dist = radius / math.tan(math.radians(FOV) * 0.5) * 1.06 * 0.78
a, e = math.radians(AZ), math.radians(EL)
Rz = np.array([[math.cos(a), -math.sin(a), 0], [math.sin(a), math.cos(a), 0], [0, 0, 1.0]])
Rx = np.array([[1, 0, 0], [0, math.cos(e), math.sin(e)], [0, -math.sin(e), math.cos(e)]])
fwd = (Rx @ Rz) @ np.array([0.0, 0.0, 1.0])
rgt = (Rx @ Rz) @ np.array([1.0, 0.0, 0.0])
up = (Rx @ Rz) @ np.array([0.0, 1.0, 0.0])
ro = ctr - fwd * dist
focal = 1.0 / math.tan(math.radians(FOV) * 0.5)

ax = (np.arange(W) + 0.5) / W * 2.0 - 1.0
ay = 1.0 - (np.arange(H) + 0.5) / H * 2.0
AX, AY = np.meshgrid(ax, ay)
DX = AX * rgt[0] + AY * up[0] + focal * fwd[0]
DY = AX * rgt[1] + AY * up[1] + focal * fwd[1]
DZ = AX * rgt[2] + AY * up[2] + focal * fwd[2]
N = np.sqrt(DX * DX + DY * DY + DZ * DZ)
DX, DY, DZ = DX / N, DY / N, DZ / N

# 包围盒入射
t0 = np.full((H, W), -1e30)
t1 = np.full((H, W), 1e30)
for i in range(3):
    o = ro[i]
    dd = [DX, DY, DZ][i]
    p = np.abs(dd) < 1e-12
    safe = np.where(p, 1.0, dd)
    a0 = np.where(p, -1e30, (lo[i] - o) / safe)
    a1 = np.where(p, 1e30, (hi[i] - o) / safe)
    t0 = np.maximum(t0, np.minimum(a0, a1))
    t1 = np.minimum(t1, np.maximum(a0, a1))
t0 = np.maximum(t0, 0.0)
inside = (t1 > t0) | ((ro[0] >= lo[0]) & (ro[0] <= hi[0]) & (ro[1] >= lo[1]) &
                      (ro[1] <= hi[1]) & (ro[2] >= lo[2]) & (ro[2] <= hi[2]))

eps = 1.1e-4 * 2 * radius
min_step = (2.0 * radius / H) * 0.22
tmax_extra = 4.0 * (hi - lo).max()

t = np.where(inside, t0, np.nan)
tmax = np.minimum(t1, t0 + tmax_extra)
pd = np.zeros((H, W))
hit = np.zeros((H, W), bool)
steps_used = np.zeros((H, W), int)

active = inside.copy()
for s in range(MAXSTEPS):
    if not active.any():
        break
    px = ro[0] + DX * t
    py = ro[1] + DY * t
    pz = ro[2] + DZ * t
    d = np.where(active, de(px, py, pz), 1.0)
    ad = np.abs(d)
    steps_used = np.where(active, s + 1, steps_used)
    just = active & (ad < eps)
    hit = hit | just
    flip = active & (~just) & ((d > 0) != (pd > 0)) & (pd != 0.0)
    hit = hit | flip
    active = active & (~just) & (~flip)
    step = np.maximum(K * ad, min_step)
    t = np.where(active, t + step, t)
    pd = np.where(active, d, pd)
    active = active & (t <= tmax)
    t = np.where(active, t, tmax)

print("box-hit rays           :", int(inside.sum()), "/", H * W)
print("marched hits           :", int((hit & inside).sum()))
print("misses (background)    :", int((inside & ~hit).sum()))
print("of which step-exhausted:", int((inside & ~hit & (steps_used >= MAXSTEPS)).sum()))
print("median steps used      :", int(np.median(steps_used[inside & hit])))

# 解析轮廓：光线上 de 是否变号
ts = np.linspace(0.0, 1.0, 600)
sil = np.zeros((H, W), bool)
prev = None
for f in ts:
    px = ro[0] + DX * (t0 + f * (t1 - t0))
    py = ro[1] + DY * (t0 + f * (t1 - t0))
    pz = ro[2] + DZ * (t0 + f * (t1 - t0))
    d = de(px, py, pz)
    if prev is not None:
        sil = sil | ((d > 0) != (prev > 0))
    prev = d
print("analytic silhouette    :", int((sil & inside).sum()))
print("missed by marcher      :", int((sil & inside & ~hit).sum()),
      "  <-- holes if large")
print("hit but not a surface  :", int((hit & inside & ~sil).sum()),
      "  <-- phantom hits if large")

img = np.where(hit, 0.0, 1.0)
Image.fromarray((img * 255).astype(np.uint8)).save(
    os.path.join(OUT, "_march_hits.png"))
print("wrote ->", os.path.join(OUT, "_march_hits.png"))
