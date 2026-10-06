# -*- coding: utf-8 -*-
"""Correct 3-channel probe of the separable blur."""
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


H, W = 21, 23
rng = np.random.default_rng(5)


def gpu_h(img, wts, r):
    d_s = cuda.to_device(np.ascontiguousarray(img, np.float32).reshape(-1))
    d_d = cuda.to_device(np.zeros(H * W * 3, np.float32))
    d_w = cuda.to_device(wts)
    bl = (H * W + 255) // 256
    gpu._k_blur_h[bl, 256](d_s, d_d, W, H, d_w, r)
    cuda.synchronize()
    return d_d.copy_to_host().reshape(H, W, 3)


def gpu_v(img, wts, r):
    d_s = cuda.to_device(np.ascontiguousarray(img, np.float32).reshape(-1))
    d_d = cuda.to_device(np.zeros(H * W * 3, np.float32))
    d_w = cuda.to_device(wts)
    bl = (H * W + 255) // 256
    gpu._k_blur_v[bl, 256](d_s, d_d, W, H, d_w, r)
    cuda.synchronize()
    return d_d.copy_to_host().reshape(H, W, 3)


wts, r = gpu._gauss_wts(1.3)
x = np.arange(-r, r + 1, dtype=np.float64)
wt = np.exp(-0.5 * (x / 1.3) ** 2)
wt /= wt.sum()

# --- delta, 3 channels, placed away from every boundary
img = np.zeros((H, W, 3), np.float64)
cy, cx = 10, 11
img[cy, cx] = [1.0, 0.5, 0.25]
gh = gpu_h(img, wts, r)
row_ref = np.zeros(W)
row_ref[cx - r:cx + r + 1] = wt
log("delta H-pass, channel 0, row %d" % cy)
log("  gpu: " + " ".join("%.5f" % v for v in gh[cy, :, 0]))
log("  ref: " + " ".join("%.5f" % v for v in row_ref))
log("  maxdiff=%.3e" % np.abs(gh[cy, :, 0] - row_ref).max())
log("delta H-pass channel 1 at col %d = %.5f (expect 0.5*wt0=%.5f)"
    % (cx, gh[cy, cx, 1], 0.5 * wt[r]))
log("delta H-pass channel 2 at col %d = %.5f (expect 0.25*wt0=%.5f)"
    % (cx, gh[cy, cx, 2], 0.25 * wt[r]))
log("other rows channel0 max = %.3e (expect 0)" % np.abs(
    np.delete(gh[:, :, 0], cy, axis=0)).max())

gv = gpu_v(img, wts, r)
col_ref = np.zeros(H)
col_ref[cy - r:cy + r + 1] = wt
log("")
log("delta V-pass, channel 0, col %d" % cx)
log("  gpu: " + " ".join("%.5f" % v for v in gv[:, cx, 0]))
log("  ref: " + " ".join("%.5f" % v for v in col_ref))
log("  maxdiff=%.3e" % np.abs(gv[:, cx, 0] - col_ref).max())

# --- random data, compare each pass with scipy, interior only
log("")
img2 = rng.random((H, W, 3))
ref_h = correlate1d(img2, wt, axis=1, mode="reflect")
gh2 = gpu_h(img2, wts, r)
m = r + 1
d = np.abs(ref_h[m:H - m, m:W - m] - gh2[m:H - m, m:W - m])
log("random H-pass interior maxdiff=%.3e" % d.max())
if d.max() > 1e-5:
    iy, ix = np.unravel_index(int(d.max(-1).argmax()), d.shape[:2])
    iy += m; ix += m
    log("  worst (row=%d col=%d) ref=%.5f gpu=%.5f" % (iy, ix, ref_h[iy, ix, 0], gh2[iy, ix, 0]))
    log("  ref: " + " ".join("%.4f" % v for v in ref_h[iy, m:W - m, 0]))
    log("  gpu: " + " ".join("%.4f" % v for v in gh2[iy, m:W - m, 0]))

ref_v = correlate1d(img2, wt, axis=0, mode="reflect")
gv2 = gpu_v(img2, wts, r)
dv = np.abs(ref_v[m:H - m, m:W - m] - gv2[m:H - m, m:W - m])
log("random V-pass interior maxdiff=%.3e" % dv.max())
if dv.max() > 1e-5:
    iy, ix = np.unravel_index(int(dv.max(-1).argmax()), dv.shape[:2])
    iy += m; ix += m
    log("  worst (row=%d col=%d) ref=%.5f gpu=%.5f" % (iy, ix, ref_v[iy, ix, 0], gv2[iy, ix, 0]))
    log("  ref: " + " ".join("%.4f" % v for v in ref_v[m:H - m, ix, 0]))
    log("  gpu: " + " ".join("%.4f" % v for v in gv2[m:H - m, ix, 0]))

# --- full 2D vs scipy
log("")
full = correlate1d(correlate1d(img2, wt, axis=1, mode="reflect"), wt,
                   axis=0, mode="reflect")
seq = gpu_v(gpu_h(img2, wts, r), wts, r)
log("full separable gpu vs scipy: interior maxdiff=%.3e" % np.abs(
    full[m:H - m, m:W - m] - seq[m:H - m, m:W - m]).max())

with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir, "_out", "_blur3_out.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(LOG))