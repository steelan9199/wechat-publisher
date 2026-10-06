# -*- coding: utf-8 -*-
"""Localise the blur bug: constant image, delta image, and per-pass comparison."""
import os
import sys
import numpy as np
from scipy.ndimage import correlate1d

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir))
import render3d_gpu as gpu
from numba_cuda_mlir import cuda

LOG = []


def log(*a):
    s = " ".join(str(x) for x in a)
    LOG.append(s)
    print(s, flush=True)


H, W = 21, 21
n = H * W


def run1d_gpu(src_flat, wts, r, horizontal, Wd, Hd):
    d_s = cuda.to_device(np.ascontiguousarray(src_flat, np.float32))
    d_d = cuda.to_device(np.zeros(len(src_flat), np.float32))
    d_w = cuda.to_device(wts)
    bl = (len(src_flat) + 255) // 256
    if horizontal:
        gpu._k_blur_h[bl, 256](d_s, d_d, Wd, Hd, d_w, r)
    else:
        gpu._k_blur_v[bl, 256](d_s, d_d, Wd, Hd, d_w, r)
    cuda.synchronize()
    return d_d.copy_to_host()


# ---------- 1) constant image
c = np.full((H, W), 0.37, np.float32)
wts, r = gpu._gauss_wts(1.3)
g = run1d_gpu(c.reshape(-1), wts, r, True, W, H).reshape(H, W)
log("constant H-pass: min=%.6f max=%.6f (expect flat 0.37)" % (g.min(), g.max()))
g2 = run1d_gpu(c.reshape(-1), wts, r, False, W, H).reshape(H, W)
log("constant V-pass: min=%.6f max=%.6f (expect flat 0.37)" % (g2.min(), g2.max()))

# ---------- 2) delta in the middle, check symmetry
d = np.zeros((H, W), np.float32)
d[H // 2, W // 2] = 1.0
gh = run1d_gpu(d.reshape(-1), wts, r, True, W, H).reshape(H, W)
log("delta H-pass row %d (should be symmetric about col %d):" % (H // 2, W // 2))
log("  " + " ".join("%.5f" % v for v in gh[H // 2]))
gv = run1d_gpu(d.reshape(-1), wts, r, False, W, H).reshape(H, W)
log("delta V-pass col %d:" % (W // 2))
log("  " + " ".join("%.5f" % v for v in gv[:, W // 2]))

# expected for the horizontal pass: 1-D gaussian along the row, no reflection
# needed because the row centre is W//2 and r=5
x = np.arange(-r, r + 1, dtype=np.float64)
wt = np.exp(-0.5 * (x / 1.3) ** 2)
wt /= wt.sum()
exp_row = np.zeros(W)
exp_row[W // 2 - r:W // 2 + r + 1] = wt
log("expected   " + " ".join("%.5f" % v for v in exp_row))
log("H-pass maxdiff vs expected = %.3e" % np.abs(gh[H // 2] - exp_row).max())

# ---------- 3) 1-D pass compared with scipy correlate1d, interior row
rng = np.random.default_rng(5)
a = rng.random((H, W)).astype(np.float64)
ref1d = correlate1d(a, wt, axis=1, mode="reflect")
gh = run1d_gpu(a.reshape(-1).astype(np.float32), wts, r, True, W, H).reshape(H, W)
log("")
log("1D horizontal pass vs scipy correlate1d: maxdiff=%.3e"
    % np.abs(ref1d - gh).max())
log("  per-row maxdiff: " + " ".join("%.4f" % v for v in np.abs(ref1d - gh).max(1)))
mid = H // 2
log("  scipy row %d: " % mid + " ".join("%.4f" % v for v in ref1d[mid]))
log("  gpu  row %d: " % mid + " ".join("%.4f" % v for v in gh[mid]))

ref1dv = correlate1d(a, wt, axis=0, mode="reflect")
gv = run1d_gpu(a.reshape(-1).astype(np.float32), wts, r, False, W, H).reshape(H, W)
log("1D vertical pass vs scipy: maxdiff=%.3e" % np.abs(ref1dv - gv).max())

# ---------- 4) is the weight array actually reaching the kernel?
log("")
log("weight check: sum=%.8f len=%d radius=%d" % (wts.sum(), len(wts), r))
d_probe = cuda.to_device(np.arange(11, dtype=np.float32))
log("weights host: " + " ".join("%.6f" % v for v in wts))
log("weights cpu : " + " ".join("%.6f" % v for v in wt))

with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir, "_out", "_delta_out.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(LOG))