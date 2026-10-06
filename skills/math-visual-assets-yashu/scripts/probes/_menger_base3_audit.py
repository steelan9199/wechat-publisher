# -*- coding: utf-8 -*-
"""门格海绵场景体检：复现"占据掩膜退化成 1 级"的坑。

背景（完整根因见 references/recipes-22.md #16）：
原 gallery.py / gallery_gpu.py 的 menger() 逐层用"坐标对"判定 face
（`|X| < step & |Y| < step`，第三个轴不加约束），挖掉的是**贯穿整条轴的长条板**；
第 2 层起严格嵌套在第 1 层挖掉的范围里，`keep &=` 删不掉任何东西，
于是写了 4 次迭代、实际只得到 **1 级海绵**。

本脚本给出四组硬证据：
  1. 填充率 —— 旧实现 0.7431 = 20/27（1 级）；三进制判据 L=1..4 = 0.7431 / 0.5487
     / 0.4064 / 0.3011
  2. 掩膜切片 dump —— 旧实现只有 3×3 的划分，新实现是逐级递归
  3. 正交投影 —— 旧掩膜只挖出三个贯穿板，不是 6 个面中央的小块
  4. 渲染 IoU —— 旧实现与成品图逐像素一致，取负场也一致
     （证明 sphere tracing 与内外符号无关，形体才是唯一变量）

用法：
    python _menger_base3_audit.py
"""
import os
import sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.abspath(os.path.join(HERE, os.pardir))
SKILL = os.path.abspath(os.path.join(SCRIPTS, os.pardir))
sys.path.insert(0, SCRIPTS)

import render3d_gpu as R
from render3d_gpu import _edt_pair, grid_from_array, trace_surface, save
from PIL import Image

OUT = os.path.join(SCRIPTS, "_out", "_menger_audit")
os.makedirs(OUT, exist_ok=True)

RES = 190
n = np.linspace(-1, 1, RES)
X, Y, Z = np.meshgrid(n, n, n, indexing="ij")


def keep_shipped():
    """Verbatim copy of the original gallery_gpu.py menger() mask."""
    keep = np.ones((RES, RES, RES), bool)
    for it in range(4):
        step = 1.0 / (3 ** (it + 1))
        mid = (np.abs(X) < step) & (np.abs(Y) < step) & (np.abs(Z) < step)
        face = (((np.abs(X) < step) & (np.abs(Y) < step))
                | ((np.abs(Y) < step) & (np.abs(Z) < step))
                | ((np.abs(Z) < step) & (np.abs(X) < step)))
        keep &= ~(mid | face)
    return keep


def keep_base3(levels):
    """Canonical Menger: at most one base-3 digit equals 1 at every level."""
    keep = np.ones((RES, RES, RES), bool)
    for k in range(1, levels + 1):
        q = 3 ** k
        dig = np.zeros((RES, RES, RES), np.int8)
        for axis in (n[:, None, None], n[None, :, None], n[None, None, :]):
            cell = np.minimum(np.floor((axis + 1.0) * 0.5 * q).astype(np.int64),
                              q - 1)
            dig += (cell % 3 == 1).astype(np.int8)
            del cell
        keep &= (dig <= 1)
        del dig
    return keep


def field_from(mask, vox, negate=False):
    dout, din = _edt_pair(mask, np.array([vox] * 3, float))
    sdf = (din - dout) if negate else (dout - din)
    return grid_from_array(sdf.astype(np.float32), [-1.0] * 3, [1.0] * 3)


print("=== 1. occupancy volume ratio ===")
ship = keep_shipped()
print("shipped (4 iterations) vol = %.4f   <- 1 level gives 20/27 = %.4f"
      % (ship.mean(), 20 / 27))
levels = {}
for L in (1, 2, 3, 4):
    k = keep_base3(L)
    levels[L] = k
    print("base3 L=%d               vol = %.4f   ((20/27)^%d = %.4f)"
          % (L, k.mean(), L, (20 / 27) ** L))
new = levels[3]


def dump(mask, title):
    print("--- %s (z-slice, every 3rd sample) ---" % title)
    for j in range(RES - 1, -1, -3):
        print("  " + "".join("#" if mask[RES // 2, i, j] else "."
                              for i in range(0, RES, 3)))


print("\n=== 2. mask cross-section ===")
dump(ship, "SHIPPED mask")
dump(new, "BASE3 L=3 mask")


def sil(mask2d, title, steps=45):
    print("--- projection: %s ---" % title)
    ix = np.linspace(0, mask2d.shape[0] - 1, steps).astype(int)
    iy = np.linspace(0, mask2d.shape[1] - 1, steps).astype(int)
    for j in iy[::-1]:
        print("  " + "".join("#" if mask2d[i, j] else "." for i in ix))


print("\n=== 3. orthographic projection along axis 1 ===")
sil(ship.any(axis=1), "SHIPPED mask")
sil(levels[4].any(axis=1), "BASE3 L=4 mask")


print("\n=== 4. render IoU against the shipped figure ===")
VOX_SHIPPED = 2.0 / 299.0          # what the old code passed (nn = 300)
VOX_TRUE = 2.0 / (RES - 1)         # what the 190^3 mask actually is
print("old sampling vox = %.6f   true vox = %.6f   ratio = %.4f"
      % (VOX_SHIPPED, VOX_TRUE, VOX_TRUE / VOX_SHIPPED))

variants = [
    ("A_shipped_mask", field_from(ship, VOX_SHIPPED)),
    ("B_vox_fixed", field_from(ship, VOX_TRUE)),
    ("C_true_L3", field_from(new, VOX_TRUE)),
    ("D_negated", field_from(ship, VOX_TRUE, negate=True)),
]
imgs = {}
for tag, f in variants:
    img = trace_surface(f, f.lo, f.hi, 860, 860, 2, azim=32, elev=20,
                        k=0.92, glow=0.20)
    imgs[tag] = img
    save(img, tag, OUT)
    del f

ref_path = os.path.join(SKILL, "assets", "figs", "16_menger.png")
ref = np.asarray(Image.open(ref_path).convert("RGB"), float) / 255.0


def side(a, thr):
    return a.max(axis=2) > thr


for thr in (0.10, 0.18, 0.28):
    rm = side(ref, thr)
    line = "thr=%.2f ref_px=%6d |" % (thr, rm.sum())
    for tag, _ in variants:
        m = side(imgs[tag], thr)
        inter = np.logical_and(rm, m).sum()
        union = np.logical_or(rm, m).sum()
        line += "  %s IoU=%.5f |" % (tag, inter / max(union, 1))
    print(line)

print("\nreference:", ref_path)
print("AUDIT DONE -- A should be the identity of the *old* figure, C the new one")
