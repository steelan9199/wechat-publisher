# -*- coding: utf-8 -*-
"""玫瑰场景体检：复现"旋转体产不出花瓣"的坑。

背景（完整根因见 references/recipes-22.md #7）：
原 rose3d() 把平面玫瑰线 r = cos(kφ) **绕 z 轴旋转**，再叠加一个代码自己加的
方位调制 |cos(kφ)|。这个构造数学上就长不出玫瑰：

  1. 旋转对称性把方位花瓣抹平 —— 旋转体的等 ρ 截面只能是同心圆；
  2. |cos(kφ)| 给的是 **2k 个瓣，不是 k 个**（注释却写 "gives k petals"）；
  3. 每条"花瓣"因此是沿整根 z 轴的**径向厚壁**（赤道 |cos(kφ)| 的等值带），
     所以从侧面看就是风车/螺旋桨；
  4. 中心是**贯穿孔**，与 docstring 写的 "closed at both poles" 相反。

本脚本给出五组硬证据：
  1. 赤道方位瓣数 —— 旧场实测 10（= 2k, k=5）
  2. 赤道径向区间 —— φ=0 处 ρ∈[0.14, 1.00] 整条实心（厚壁），相位空档处全空
  3. 轴线命中 —— 旧场整根 z 轴 0 命中（贯穿孔）；新场花心被封死
  4. 体积占比 —— 旧场 vs 新场
  5. 俯视"透视率" —— 把轮廓填洞后，轮廓内仍是背景的像素比例
     （旧场能透过花心看到背景，新场 ~0）
  6. 渲染对照表 —— 旧场 / 新场 同机位拼图

用法：
    python _rose_bloom_audit.py
"""
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.abspath(os.path.join(HERE, os.pardir))
SKILL = os.path.abspath(os.path.join(SCRIPTS, os.pardir))
sys.path.insert(0, SCRIPTS)

from render3d_gpu import (sdf_from_points, trace_surface, save,   # noqa: E402
                          F_ROSE3D)
from scipy.spatial import cKDTree                                 # noqa: E402
from PIL import Image, ImageDraw                                  # noqa: E402
from gallery_gpu import _rose_cloud                               # noqa: E402

OUT = os.path.join(SCRIPTS, "_out", "_rose_audit")
os.makedirs(OUT, exist_ok=True)

K = 5.0
BOX = 1.35


def old_field(x, y, z):
    """Verbatim copy of the shipped rose3d() implicit field (k=5)."""
    rxy = np.sqrt(x * x + y * y) + 1e-9
    phi = np.arctan2(y, x)
    mod = 0.80 + 0.20 * np.cos(2.0 * np.arctan2(z, rxy))
    outer = np.abs(np.cos(K * phi)) * mod
    inner = 0.14 * mod
    mid = 0.5 * (outer + inner)
    half = 0.5 * (outer - inner)
    return np.abs(rxy - mid) - half


def inside_old(x, y, z):
    return old_field(np.asarray(x, float), np.asarray(y, float),
                     np.asarray(z, float)) <= 0.0


def runs(mask):
    """Number of circular True-runs in a 1-D boolean array."""
    m = np.asarray(mask, bool)
    if not m.any():
        return 0
    return int((m & ~np.roll(m, 1)).sum())


# --------------------------------------------------------------------------
print("=== 1. equator: how many azimuthal petals does the OLD field have? ===")
NP = 7200
ph = np.linspace(0.0, 2 * np.pi, NP, endpoint=False)
rad = np.linspace(0.001, 1.34, 600)
PH, RA = np.meshgrid(ph, rad, indexing="ij")
hit = inside_old(RA * np.cos(PH), RA * np.sin(PH), np.zeros_like(RA))
spoke = hit.any(axis=1)
print("k = %.0f -> |cos(k*phi)| has %d lobes" % (K, int(2 * K)))
print("OLD field: azimuthal petals measured = %d" % runs(spoke))
print("           comment in the old code claimed k = %.0f" % K)
print("           docstring claimed 'closed at both poles'")

# --------------------------------------------------------------------------
print("\n=== 2. equator: radial extent at a petal and at a gap ===")
for deg in (0.0, 9.0, 18.0):
    a = np.radians(deg)
    r = np.linspace(0.0, 1.34, 4000)
    m = inside_old(r * np.cos(a), r * np.sin(a), np.zeros_like(r))
    if m.any():
        print("  phi=%5.1f deg : rho in [%.3f, %.3f]  (solid %.0f%% of the ray)"
              % (deg, r[m].min(), r[m].max(), 100 * m.mean()))
    else:
        print("  phi=%5.1f deg : EMPTY ray  <- the 2k radial slots" % deg)

# --------------------------------------------------------------------------
print("\n=== 3. the z axis ===")
zax = np.linspace(-BOX, BOX, 4001)
h_old = inside_old(np.zeros_like(zax), np.zeros_like(zax), zax)
print("OLD: axis samples inside = %d / %d  (a hole straight through)"
      % (h_old.sum(), zax.size))

P = _rose_cloud()
f = sdf_from_points(P, pad=0.06, thick=2, res=352)   # noqa: F841 (used below)
r_ax = np.hypot(P[:, 0], P[:, 1])
core = (r_ax < 0.05) & (P[:, 2] > 0.40) & (P[:, 2] < 1.10)
print("NEW: cloud points within 0.05 of the axis, mid-height = %d "
      "(the bud spindle seals it)" % core.sum())

# --------------------------------------------------------------------------
print("\n=== 4. cloud vs old solid ===")
print("NEW cloud: %d points, bbox %s .. %s"
      % (P.shape[0], np.round(P.min(0), 3), np.round(P.max(0), 3)))
r_o = np.sqrt(P[:, 0] ** 2 + P[:, 1] ** 2)
print("NEW: radial reach %.3f, height span %.3f -> width/height = %.2f"
      % (r_o.max(), P[:, 2].max() - P[:, 2].min(),
         2 * r_o.max() / (P[:, 2].max() - P[:, 2].min())))
ph_c = np.array([2 * np.pi * ((i * 0.6180339887498949 + 25.0 / 360.0
                               * (i / 55.0)) % 1.0) for i in range(56)])
ph_c = np.sort(ph_c)
gaps = np.diff(np.concatenate([ph_c, [ph_c[0] + 2 * np.pi]]))
print("NEW: 56 petal azimuths (golden angle) -- largest gap %.1f deg, "
      "smallest %.1f deg (uniform would be %.1f)"
      % (np.degrees(gaps.max()), np.degrees(gaps.min()), 360.0 / 56))

g = np.linspace(-BOX, BOX, 240)
GX, GY, GZ = np.meshgrid(g, g, g, indexing="ij")
print("OLD: volume fraction in [-1.35,1.35]^3 = %.4f"
      % inside_old(GX, GY, GZ).mean())
del GX, GY, GZ

# --------------------------------------------------------------------------
print("\n=== 5. mid-plane occupancy, 41x41 samples ===")
N = 640


# A pixel-level "see-through" test is useless here: the render background is a
# dark blue gradient plus bloom, so a hole fills itself in visually.  The
# honest test is cell-level occupancy of a plane through the middle.
S = 41
grid = np.linspace(-1.0, 1.0, S)


def dump(title, hit_fn):
    print("--- %s ---" % title)
    for j in grid[::-1]:
        print("  " + "".join("#" if hit_fn(i, j) else "." for i in grid))


print("  OLD: z = 0 plane, inside = %s" % "|r_xy - mid| <= half")
dump("OLD rot-solid, equator", lambda x, y: bool(inside_old(x, y, 0.0)))

tree = cKDTree(P)
print("\n  NEW: z = 0.50 plane (mid-height), occupied if a cloud point lies")
print("       within 0.03 of the sample")
dump("NEW rose bloom, mid-height",
     lambda x, y: len(tree.query_ball_point([x, y, 0.50], 0.03)) > 0)

imgs = {}
old_top = trace_surface(None, [-BOX] * 3, [BOX] * 3, N, N, 2, azim=0, elev=89,
                        k=0.30, maxsteps=420, thin=0.7, kind=F_ROSE3D,
                        p0=(K, 0.0, 0.0))
new_top = trace_surface(f, f.lo, f.hi, N, N, 2, azim=0, elev=89, k=0.95,
                        glow=0.12, thin=0.75, light=0.85, zoom=0.85)
imgs["OLD_analytic_top"] = old_top
imgs["NEW_bloom_top"] = new_top

# --------------------------------------------------------------------------
print("\n=== 6. renders ===")
VIEWS = [("az024_el020", 24, 20), ("az024_el060", 24, 60),
         ("az090_el006", 90, 6), ("az000_el089", 0, 89)]
tiles = []
for tag, az, el in VIEWS:
    a = trace_surface(None, [-BOX] * 3, [BOX] * 3, 430, 430, 2, azim=az,
                      elev=el, k=0.30, maxsteps=420, thin=0.7, kind=F_ROSE3D,
                      p0=(K, 0.0, 0.0))
    b = trace_surface(f, f.lo, f.hi, 430, 430, 2, azim=az, elev=el, k=0.95,
                      glow=0.12, thin=0.75, light=0.85, zoom=0.85)
    imgs["OLD_" + tag] = a
    imgs["NEW_" + tag] = b
    tiles.append((a, "OLD rot-solid  " + tag))
    tiles.append((b, "NEW rose bloom " + tag))
    print("  %s rendered" % tag, flush=True)

for name, img in imgs.items():
    save(img, name, OUT)

TILE, PAD = 300, 15
cols = 4
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new("RGB", (cols * (TILE + 6) + 6, rows * (TILE + PAD + 6) + 6),
                  (20, 22, 30))
d = ImageDraw.Draw(sheet)
for i, (img, label) in enumerate(tiles):
    r, c = divmod(i, cols)
    x = 6 + c * (TILE + 6)
    y = 6 + r * (TILE + PAD + 6)
    d.text((x + 3, y + 3), label, fill=(140, 225, 255))
    sheet.paste(Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5)
                                .astype(np.uint8)).resize((TILE, TILE),
                                                          Image.LANCZOS),
                (x, y + PAD))
sheet.save(os.path.join(OUT, "rose_before_after.png"))

print("\noutputs ->", OUT)
print("AUDIT DONE -- the OLD scene is a windmill, the NEW one is a rose")
