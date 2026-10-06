# -*- coding: utf-8 -*-
"""Point spacing along each attractor curve, in voxels, to size `close`."""
import numpy as np


def spacing(name, P, res=380, rad=0.02):
    lo = P.min(0) - rad * 1.2
    hi = P.max(0) + rad * 1.2
    ext = hi - lo
    nres = int(np.clip(round(res), 64, 420))
    vox = float(ext.max()) / (nres - 1)
    d = np.linalg.norm(np.diff(P, axis=0), axis=1)
    print(f"  {name:10s} n={len(P):7d} vox={vox:.5f} "
          f"spacing: mean={d.mean()/vox:5.2f} vox  "
          f"p95={np.percentile(d,95)/vox:5.2f}  max={d.max()/vox:7.2f}")
    return d.mean() / vox


# mandelbulb
def mandelbulb_pts(power=8, res=200, R=1.25):
    g = np.linspace(-R, R, res).astype(np.float64)
    X, Y, Z = np.meshgrid(g, g, g, indexing="ij")
    z = (X + 1j * Y).ravel() + 1j * Z.ravel()
    c = z.copy(); dz = np.ones_like(z); alive = np.ones(len(z), bool)
    for _ in range(12):
        idx = np.nonzero(alive)[0]
        if len(idx) == 0:
            break
        zi = z[idx]; r = np.abs(zi); zr = r ** (power - 1)
        dz[idx] = power * zr * dz[idx] + 1.0
        z[idx] = zi * zr + c[idx]
        alive &= np.abs(z) < 1e4
    r = np.abs(z)
    de = np.zeros_like(r)
    ok = (r > 1e-12) & (np.abs(dz) > 1e-12)
    de[ok] = r[ok] * np.log(np.maximum(r[ok], 1.001)) / np.abs(dz[ok])
    de = np.clip(np.nan_to_num(de, nan=1.0), -3.0, 3.0)
    return np.stack([np.real(z), np.imag(z)], 1)


# lorenz
s, r, b = 10.0, 28.0, 8 / 3
dt = 0.0045
n = 26000
x = np.empty(n); y = np.empty(n); z = np.empty(n)
x[0] = y[0] = z[0] = 0.1
for i in range(1, n):
    x[i] = x[i - 1] + dt * s * (y[i - 1] - x[i - 1])
    y[i] = y[i - 1] + dt * (x[i - 1] * (r - z[i - 1]) - y[i - 1])
    z[i] = z[i - 1] + dt * (x[i - 1] * y[i - 1] - b * z[i - 1])
PL = np.stack([x, y, z], 1)
PL = PL - PL.mean(0); PL /= np.abs(PL).max() * 1.06

# dejong
a, bb, c, d = 1.4, -2.3, 2.4, -2.1
n = 120000
x = np.empty(n); y = np.empty(n)
x[0], y[0] = 0.1, 0.1
for i in range(1, n):
    x[i] = np.sin(a * y[i - 1]) - np.cos(bb * x[i - 1])
    y[i] = np.sin(c * x[i - 1]) - np.cos(d * y[i - 1])
PD = np.stack([x, y, 0.16 * (x * np.cos(0.7 * y) + y * np.sin(0.7 * y))], 1)
PD = PD - PD.mean(0); PD /= np.abs(PD).max() * 1.05

# clifford
a_, b_, c_, d_ = -1.4, 1.6, 1.0, 0.7
n = 130000
x = np.empty(n); y = np.empty(n); z = np.empty(n)
x[0], y[0], z[0] = 1.0, 1.0, 1.0
for i in range(1, n):
    x[i] = np.sin(a_ * y[i - 1]) + c_ * np.cos(a_ * x[i - 1])
    y[i] = np.sin(b_ * x[i - 1]) + d_ * np.cos(b_ * y[i - 1])
    z[i] = np.sin(c_ * x[i - 1]) + d_ * np.cos(c_ * z[i - 1])
PC = np.stack([x, y, z], 1)
PC = PC - PC.mean(0); PC /= np.abs(PC).max() * 1.05

print("attractor point spacing (voxels between consecutive samples)")
print("  close=1 bridges gaps up to ~2 vox, close=2 up to ~4 vox")
print()
spacing("lorenz", PL, rad=0.0075)
spacing("dejong", PD, rad=0.0050)
spacing("clifford", PC, rad=0.0045)
print()
print("=> clifford is the outlier; lorenz/dejong are already dense enough,")
print("   so they keep close=0 and stay pixel-identical to the delivery.")
