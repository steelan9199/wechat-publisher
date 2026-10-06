# -*- coding: utf-8 -*-
"""orbital_f uses c=0.95 as the |Ylm| cut, but Ylm = cos(3*theta) has max
|Ylm| = 1.0, so only the very extremes survive -> tiny disconnected blobs.
orbital_d uses c=0.62.  Sweep c for the f orbital."""
import os
import sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir))
from render3d_gpu import sdf_from_occupancy, trace_surface
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir, os.pardir, "_out")
os.makedirs(OUT, exist_ok=True)
W = H = 860
SS = 2
TILE = 400


def occ_f(c, res=384, half=0.94, l=3):
    g = np.linspace(-half, half, res).astype(np.float32)
    X, Yc, Z = np.meshgrid(g, g, g, indexing="ij")
    r = np.sqrt(X * X + Yc * Yc + Z * Z) + 1e-9
    ct = np.clip(Z / r, -1, 1)
    if l == 3:
        Ylm = ct * (5 * ct * ct - 3)
    else:
        Ylm = 3 * ct * ct - 1
    R = 0.96 if l == 3 else 0.90
    rad = R * np.sqrt(np.clip((np.abs(Ylm) - c) / max(2.0 - c, 1e-6), 0, 1))
    keep = r < rad
    del X, Yc, Z, r, ct, Ylm, rad
    return keep, [g[0]] * 3, [g[-1]] * 3


print("=== fill fraction & peak radius vs c ===", flush=True)
for l in (3, 2):
    print(f"  l={l}  (Ylm max = "
          f"{1.0 if l == 3 else 2.0})")
    for c in (0.95, 0.85, 0.75, 0.62, 0.50, 0.40, 0.30):
        keep, lo, hi = occ_f(c, l=l)
        g = np.linspace(-0.94, 0.94, 384, dtype=np.float32)
        # peak radius = outermost occupied voxel radius
        idx = np.argwhere(keep)
        rmax = np.sqrt((g[idx[:, 0]] ** 2 + g[idx[:, 1]] ** 2
                        + g[idx[:, 2]] ** 2).max()) if len(idx) else 0.0
        print(f"    c={c:<5} fill={100*keep.mean():6.3f}%  "
              f"rmax={rmax:.3f}  voxels={int(keep.sum()):8d}")
        del keep

print()
print("=== render f orbital at several c (full res) ===", flush=True)
tiles, labels = [], []
for c in (0.95, 0.75, 0.62, 0.50, 0.40, 0.30):
    keep, lo, hi = occ_f(c, l=3)
    f = sdf_from_occupancy(keep, lo, hi, thick=1, res=384, smooth=0.8)
    del keep
    img = trace_surface(f, f.lo, f.hi, W, H, SS, azim=24, elev=35, k=0.92,
                        glow=0.22, thin=0.6, zoom=0.92)
    a = (np.clip(img, 0, 1) * 255.0 + 0.5).astype(np.uint8)
    tiles.append(a)
    labels.append(f"f orbital  c={c}")
    print(f"  c={c} rendered", flush=True)

rows = (len(tiles) + 2) // 3
pad = 18
sh = Image.new("RGB", (3 * (TILE + 6) + 6, rows * (TILE + pad + 6) + 6),
               (20, 22, 30))
d = ImageDraw.Draw(sh)
for i, t in enumerate(tiles):
    r, c = divmod(i, 3)
    x = 6 + c * (TILE + 6)
    y = 6 + r * (TILE + pad + 6)
    d.text((x + 3, y + 4), labels[i], fill=(140, 225, 255))
    sh.paste(Image.fromarray(t).resize((TILE, TILE), Image.LANCZOS), (x, y + pad))
sh.save(os.path.join(OUT, "f_c_sweep.png"))
print("sheet -> f_c_sweep.png", flush=True)
print("DONE", flush=True)
