# -*- coding: utf-8 -*-
"""clifford: the glow ray-march takes dt = span/steps.  With the tube closed
the sigma is ~0.0106 but dt was 0.053 (5x overshoot) -> the volume integral
aliases into speckle.  Sweep steps x gain x close."""
import os
import sys
import time
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir))
from render3d_gpu import grid_from_array, trace_glow
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir, os.pardir, "_out")
os.makedirs(OUT, exist_ok=True)
W = H = 860
SS = 2
TILE = 380

a, b, c, d = -1.4, 1.6, 1.0, 0.7
n = 130000
x = np.empty(n); y = np.empty(n); z = np.empty(n)
x[0], y[0], z[0] = 1.0, 1.0, 1.0
for i in range(1, n):
    x[i] = np.sin(a * y[i - 1]) + c * np.cos(a * x[i - 1])
    y[i] = np.sin(b * x[i - 1]) + d * np.cos(b * y[i - 1])
    z[i] = np.sin(c * x[i - 1]) + d * np.cos(c * z[i - 1])
P = np.stack([x, y, z], 1)
P = P - P.mean(0)
P /= np.abs(P).max() * 1.05

RAD = 0.0045
RES = 420


def dilate(m, iters):
    for _ in range(iters):
        p = np.zeros_like(m)
        p[1:, :, :] |= m[:-1, :, :]; p[:-1, :, :] |= m[1:, :, :]
        p[:, 1:, :] |= m[:, :-1, :]; p[:, :-1, :] |= m[:, 1:, :]
        p[:, :, 1:] |= m[:, :, :-1]; p[:, :, :-1] |= m[:, :, 1:]
        m = m | p
    return m


def build(close):
    lo = P.min(0) - RAD * 1.2
    hi = P.max(0) + RAD * 1.2
    ext = hi - lo
    nres = int(np.clip(round(RES), 64, 420))
    vox = float(ext.max()) / (nres - 1)
    rad = max(RAD, 2.2 * vox)
    occ = np.zeros((nres, nres, nres), bool)
    idx = np.rint((P - lo) / vox).astype(np.int32)
    np.clip(idx, 0, nres - 1, out=idx)
    occ[idx[:, 0], idx[:, 1], idx[:, 2]] = True
    if close:
        occ = dilate(occ, close)
    dout = distance_transform_edt(occ, sampling=vox)
    din = distance_transform_edt(~occ, sampling=vox)
    dd = (dout - np.maximum(din, vox)).astype(np.float32)
    del occ, dout, din
    return grid_from_array(dd, lo, hi), rad, vox


print("=== dt vs tube sigma ===", flush=True)
f0, rad0, vox0 = build(2)
lo = np.array(f0.lo, float); hi = np.array(f0.hi, float)
ctr = 0.5 * (lo + hi)
radius = 0.5 * float(np.linalg.norm(hi - lo))
dist = radius / np.tan(np.radians(30.0) * 0.5) * 1.06
span = (dist + radius)
print(f"  vox={vox0:.5f}  tube rad={rad0:.5f}  box radius={radius:.3f}")
print(f"  span={span:.3f}")
for st in (170, 300, 450, 600, 800):
    print(f"    steps={st:4d} -> dt={span/st:.5f}  "
          f"dt/sigma={span/st/rad0:5.2f}  {'ALIAS' if span/st/rad0>1 else 'ok'}")
del f0

CFG = []
for close, steps, gain in ((2, 170, 0.62), (2, 450, 0.62), (2, 800, 0.62),
                           (2, 450, 0.40), (3, 450, 0.45), (3, 800, 0.45),
                           (2, 450, 0.50), (3, 450, 0.55)):
    CFG.append((close, steps, gain))

tiles, labels = [], []
cache = {}
for close, steps, gain in CFG:
    if close not in cache:
        cache[close] = build(close)
    f, rad, vox = cache[close]
    t0 = time.time()
    img = trace_glow(f, f.lo, f.hi, W, H, SS, azim=28, elev=16,
                     sigma=rad, dens=30.0, steps=steps, gain=gain,
                     colors=((0.30, 0.80, 1.0), (1.0, 0.62, 0.30)))
    a8 = (np.clip(img, 0, 1) * 255.0 + 0.5).astype(np.uint8)
    tiles.append(a8)
    labels.append(f"close={close} steps={steps} gain={gain}  {time.time()-t0:.0f}s")
    print(f"  close={close} steps={steps} gain={gain} "
          f"-> {time.time()-t0:.1f}s  mean={a8.mean():.1f} "
          f"blown%={100*(a8.max(2)>250).mean():.2f}", flush=True)

rows = (len(tiles) + 3) // 4
pad = 18
sh = Image.new("RGB", (4 * (TILE + 6) + 6, rows * (TILE + pad + 6) + 6),
               (20, 22, 30))
dr = ImageDraw.Draw(sh)
for i, t in enumerate(tiles):
    rr, cc = divmod(i, 4)
    xx = 6 + cc * (TILE + 6)
    yy = 6 + rr * (TILE + pad + 6)
    dr.text((xx + 3, yy + 4), labels[i], fill=(140, 225, 255))
    sh.paste(Image.fromarray(t).resize((TILE, TILE), Image.LANCZOS), (xx, yy + pad))
sh.save(os.path.join(OUT, "clifford_sweep.png"))
print("sheet -> clifford_sweep.png", flush=True)
print("DONE", flush=True)
