# -*- coding: utf-8 -*-
"""Diagnose the 5 low-quality scenes: geometry extent, clipping survival,
voxel size vs feature size, and grid-box aspect ratio (truncation risk)."""
import os
import sys
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir))
from gallery_gpu import param_cloud, _norm

np.set_printoptions(precision=4, suppress=True)


def box_report(name, P, pad, res, cap):
    lo = P.min(0)
    hi = P.max(0)
    ctr = 0.5 * (lo + hi)
    half = 0.5 * (hi - lo).max()
    blo = ctr - half * (1 + pad)
    bhi = ctr + half * (1 + pad)
    ext = bhi - blo
    n = np.maximum(96, np.round(res * ext / ext.max()).astype(np.int32))
    n = np.minimum(n, cap)
    vox = ext / np.maximum(n - 1, 1)
    print(f"  bbox ofpts   lo={lo} hi={hi}")
    print(f"  pt extent      = {hi - lo}   aspect = {(hi-lo)/ (hi-lo).max()}")
    print(f"  grid box       = {ext}  (aspect {ext/ext.max()})")
    print(f"  n per axis     = {n}   vox = {vox}  vox_max = {vox.max():.5f}")
    return vox.max()


print("=" * 70)
print("1. ROMAN  -- why only a fragment?")
print("=" * 70)


def roman_fn(U, V):
    t, u = U, V
    return np.stack([np.sin(t) * np.cos(u) ** 2,
                     np.sin(t) * np.sin(u) * np.cos(u),
                     np.cos(t) + 0.5 * (np.cos(2 * t) - 1)
                     + 0.5 * (np.cos(2 * t) - 2 * np.cos(u) ** 2)], -1)


Praw = param_cloud(roman_fn, 1500, 1500, 0, np.pi, -np.pi / 2, np.pi / 2)
m = np.abs(Praw).max(1)
print(f"  total points   = {len(Praw)}")
print(f"  |P|max  min={m.min():.4f} max={m.max():.4f} mean={m.mean():.4f}")
for thr in (1.2, 1.6, 2.0, 2.2, 2.5, 3.0):
    keep = m < thr
    Q = Praw[keep]
    if len(Q) < 10:
        print(f"  thr={thr}: only {len(Q)} pts")
        continue
    e = Q.max(0) - Q.min(0)
    print(f"  thr={thr:<4}: {keep.sum():8d} pts ({100*keep.mean():5.1f}%)"
          f"  extent={e.round(3)}")
print()
print("  -> per-slice survival (t = U index) at thr=2.2:")
u = np.linspace(0, np.pi, 1500, endpoint=False)
tslice = u[np.searchsorted(np.linspace(0, np.pi, 1500), u)]  # placeholder
idx_t = np.arange(1500)
m2 = m.reshape(1500, 1500)
alive = (m2 < 2.2).mean(1)
for i in range(0, 1500, 150):
    print(f"     t={u[i]:.3f} ({u[i]/np.pi*180:5.1f}deg)  alive={alive[i]*100:5.1f}%")
print()
box_report("roman", Praw[np.abs(Praw).max(1) < 2.2], 0.05, 330, 420)

print()
print("=" * 70)
print("2. HELICOID -- moire + flat top-right edge")
print("=" * 70)
a, tmax = 0.62, 2.55
uu = np.linspace(-tmax, tmax, 1100)
vv = np.linspace(-1.25, 1.25, 46)
U, V = np.meshgrid(uu, vv, indexing="ij")
cu, su = np.cos(U), np.sin(U)
PH = np.stack([((a * U) * cu - V * su).ravel(),
               ((a * U) * su + V * cu).ravel(),
               np.broadcast_to(U, U.shape).ravel() * 0.92], 1)
vhel = box_report("helicoid", PH, 0.06, 330, 420)
# v-sampling density: how far apart adjacent v samples are vs voxel
dv = (vv[1] - vv[0])
print(f"  v sample spacing dv = {dv:.4f}   (vox={vhel:.5f})  ratio={dv/vhel:.2f}")
print(f"  -> dv/vox<1 means the v direction is UNDERSAMPLED (stripes/stepping)")
du = (uu[1] - uu[0])
print(f"  u sample spacing du = {du:.5f}  ratio du/vox = {du/vhel:.2f}")

print()
print("=" * 70)
print("3. ORBITAL d/f -- concentric ring moire + too small")
print("=" * 70)
for res_occ in (240, 300, 320):
    g = np.linspace(-1.15, 1.15, res_occ).astype(np.float32)
    vox_occ = (g[-1] - g[0]) / (res_occ - 1)
    print(f"  occupancy res={res_occ}: occupancy voxel = {vox_occ:.5f}")
for res_sdf in (300, 340, 384):
    ext = 2.30
    n = min(384, max(96, round(res_sdf)))
    print(f"  sdf res={res_sdf} -> n={min(n,384)}, vox={ext/(min(n,384)-1):.5f}")
print("  NOTE: sdf_from_occupancy caps n at 384 and uses the SAME box,")
print("        so raising res above 384 has no effect (hard cap).")
# how thick is the orbital shell in voxels?
g = np.linspace(-1.15, 1.15, 240).astype(np.float32)
X, Yc, Z = np.meshgrid(g, g, g, indexing="ij")
r = np.sqrt(X * X + Yc * Yc + Z * Z) + 1e-9
ct = np.clip(Z / r, -1, 1)
st = np.sqrt(np.clip(1 - ct * ct, 1e-12, None))
phi = np.arctan2(Yc, X)
Ylm = 3 * ct * ct - 1
c, R = 0.62, 0.90
rad = R * np.sqrt(np.clip((np.abs(Ylm) - c) / (2.0 - c), 0, 1))
keep = r < rad
print(f"  d-orbital: fill fraction = {keep.mean()*100:.2f}%  "
      f"(=> {int(keep.sum())} of {keep.size} voxels)")
# radial thickness near the surface
vox = 2.30 / 239
print(f"  occupancy voxel = {vox:.5f}; mean radial shell thickness ~"
      f" {2.30/240:.4f} in grid units")

print()
print("=" * 70)
print("4. CLIFFORD -- noise + too dark")
print("=" * 70)
a_, b_, c_, d_ = -1.4, 1.6, 1.0, 0.7
n = 130000
x = np.empty(n); y = np.empty(n); z = np.empty(n)
x[0], y[0], z[0] = 1.0, 1.0, 1.0
for i in range(1, n):
    x[i] = np.sin(a_ * y[i - 1]) + c_ * np.cos(a_ * x[i - 1])
    y[i] = np.sin(b_ * x[i - 1]) + d_ * np.cos(b_ * y[i - 1])
    z[i] = np.sin(c_ * x[i - 1]) + d_ * np.cos(c_ * z[i - 1])
PC = np.stack([x, y, z], 1)
PC = PC - PC.mean(0)
PC /= np.abs(PC).max() * 1.05
rad_req = 0.0045
lo = PC.min(0) - rad_req * 1.2
hi = PC.max(0) + rad_req * 1.2
ext = hi - lo
for res in (380, 400, 420):
    nres = int(np.clip(round(res * float(ext.max()) / float(ext.max())), 64, 420))
    vox = float(ext.max()) / (nres - 1)
    floor = 2.2 * vox
    print(f"  res={res}: nres={nres} vox={vox:.6f}  "
          f"rad={rad_req}  2.2*vox={floor:.6f}  "
          f"{'CLAMPED (rad raised)' if rad_req < floor else 'ok'}")
    print(f"          rad/vox = {rad_req/vox:.2f}  (need >=2.2 to be representable)")
# how many points land in the same voxel -> clumping / holes
nres = 420
vox = float(ext.max()) / (nres - 1)
idx = np.rint((PC - lo) / vox).astype(np.int32)
np.clip(idx, 0, nres - 1, out=idx)
flat = (idx[:, 0] * nres + idx[:, 1]) * nres + idx[:, 2]
u_, cnt = np.unique(flat, return_counts=True)
print(f"  points={len(PC)}  occupied voxels={len(u_)}  "
      f"mean pts/voxel={len(PC)/len(u_):.2f}  max={cnt.max()}")
print(f"  => coverage is {100*len(u_)/nres**3:.3f}% of the volume;")
print(f"     holes are inevitable -> the 'noise' is un-closed surface.")
