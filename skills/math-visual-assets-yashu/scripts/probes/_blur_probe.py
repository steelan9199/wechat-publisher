# -*- coding: utf-8 -*-
"""Decisive test of the GPU separable blur against scipy, asymmetric data."""
import os
import sys
import numpy as np
from scipy.ndimage import gaussian_filter

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir))
import render3d_gpu as gpu
from numba_cuda_mlir import cuda

LOG = []


def log(*a):
    s = " ".join(str(x) for x in a)
    LOG.append(s)
    print(s, flush=True)


H, W = 9, 11
img = np.zeros((H, W, 3), np.float64)
rng = np.random.default_rng(1)
img[..., 0] = rng.random((H, W))
img[..., 1] = rng.random((H, W))
img[..., 2] = rng.random((H, W))
img[H // 2, W // 2] = 1.0        # asymmetric spike

for sigma in (1.3, 3.0):
    ref = gaussian_filter(img, sigma, mode="reflect")
    wts, r = gpu._gauss_wts(sigma)
    d_src = cuda.to_device(img.astype(np.float32).reshape(-1))
    d_tmp = cuda.to_device(np.zeros(H * W * 3, np.float32))
    d_dst = cuda.to_device(np.zeros(H * W * 3, np.float32))
    d_w = cuda.to_device(wts)
    n = H * W
    bl = (n + 255) // 256
    gpu._k_blur_h[bl, 256](d_src, d_tmp, W, H, d_w, r)
    gpu._k_blur_v[bl, 256](d_tmp, d_dst, W, H, d_w, r)
    cuda.synchronize()
    got = d_dst.copy_to_host().reshape(H, W, 3)
    d = np.abs(ref - got)
    log("sigma=%.1f  maxdiff=%.3e  meandiff=%.3e" % (sigma, d.max(), d.mean()))
    dd = d.max(-1)
    log("   per-row maxdiff: " + " ".join("%.4f" % v for v in dd.max(1)))
    iy, ix = np.unravel_index(int(dd.argmax()), dd.shape)
    log("   worst (row=%d col=%d) ref=%.5f got=%.5f" % (iy, ix, ref[iy, ix, 0], got[iy, ix, 0]))
    log("   ref row %d: " % iy + " ".join("%.4f" % v for v in ref[iy, :, 0]))
    log("   got row %d: " % iy + " ".join("%.4f" % v for v in got[iy, :, 0]))
    log("   ref col %d: " % ix + " ".join("%.4f" % v for v in ref[:, ix, 0]))
    log("   got col %d: " % ix + " ".join("%.4f" % v for v in got[:, ix, 0]))

# also verify the 1-D reference mapping on genuinely asymmetric 1-D data
log("")
log("--- 1D asymmetric mapping check")
a = np.array([1.0, 5.0, 2.0, 8.0, 3.0, 9.0, 4.0])
sigma = 1.3
r = int(4.0 * sigma + 0.5)
x = np.arange(-r, r + 1, dtype=np.float64)
wt = np.exp(-0.5 * (x / sigma) ** 2)
wt /= wt.sum()
ref = gaussian_filter(a, sigma, mode="reflect")
log("scipy:", np.round(ref, 5))


def idxA(i, n):
    while i < 0 or i >= n:
        i = -i - 1 if i < 0 else 2 * n - 1 - i
    return i


def idxB(i, n):
    while i < 0 or i >= n:
        if i < 0:
            i = -1 - i
        else:
            i = 2 * n - 1 - i
    return i


for nm, f in (("A half-sample", idxA), ("B whole-sample", idxB)):
    out = np.zeros(len(a))
    for i in range(len(a)):
        s = 0.0
        for k in range(-r, r + 1):
            s += wt[k + r] * a[f(i + k, len(a))]
        out[i] = s
    log("%-16s" % nm, np.round(out, 5), " maxdiff=%.3e" % np.abs(out - ref).max())

log("")
log("--- large 2D, only the interior can be in the valid zone")
H2, W2 = 41, 43
img2 = np.zeros((H2, W2, 3), np.float64)
img2[..., 0] = rng.random((H2, W2))
img2[..., 1] = rng.random((H2, W2))
img2[..., 2] = rng.random((H2, W2))
for sigma in (1.3, 3.0, 9.0):
    ref2 = gaussian_filter(img2, sigma, mode="reflect")
    wts, rr = gpu._gauss_wts(sigma)
    d_s = cuda.to_device(img2.astype(np.float32).reshape(-1))
    d_t = cuda.to_device(np.zeros(H2 * W2 * 3, np.float32))
    d_g = cuda.to_device(np.zeros(H2 * W2 * 3, np.float32))
    d_w = cuda.to_device(wts)
    nn = H2 * W2
    bl = (nn + 255) // 256
    gpu._k_blur_h[bl, 256](d_s, d_t, W2, H2, d_w, rr)
    gpu._k_blur_v[bl, 256](d_t, d_g, W2, H2, d_w, rr)
    cuda.synchronize()
    got2 = d_g.copy_to_host().reshape(H2, W2, 3)
    dd2 = np.abs(ref2 - got2).max(-1)
    if 2 * rr + 2 <= min(H2, W2):
        inner = dd2[rr + 1:H2 - rr - 1, rr + 1:W2 - rr - 1]
        log("sigma=%.1f r=%d  interior maxdiff=%.3e | full maxdiff=%.3e"
            % (sigma, rr, inner.max(), dd2.max()))
    else:
        log("sigma=%.1f r=%d  full maxdiff=%.3e (no clean interior)"
            % (sigma, rr, dd2.max()))

with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir, "_out", "_blur_out.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(LOG))