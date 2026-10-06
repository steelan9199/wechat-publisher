# -*- coding: utf-8 -*-
"""Full stage-by-stage CPU vs GPU post comparison, no guessing."""
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


W = H = 64
SS = 2
Wf, Hf = W * SS, H * SS
rng = np.random.default_rng(11)

# a realistic-ish render output: dark background + bright shapes
img = np.zeros((Hf, Wf, 3), np.float32)
yy, xx = np.mgrid[0:Hf, 0:Wf]
for cx, cy, rad in ((0.35, 0.4, 0.16), (0.65, 0.55, 0.20), (0.5, 0.75, 0.12)):
    m = np.exp(-(((xx / Wf - cx) ** 2 + (yy / Hf - cy) ** 2) / rad ** 2) * 4)
    img[..., 0] += m * 0.9
    img[..., 1] += m * 0.5
    img[..., 2] += m * 0.8
img += rng.random((Hf, Wf, 3)).astype(np.float32) * 0.01

# ---------------- CPU reference chain
ds_c = img.reshape(H, SS, W, SS, 3).mean(axis=(1, 3))
cl_c = np.clip(ds_c, 0, 1)
acc_c = np.zeros_like(cl_c)
for s, w in zip(gpu._BLOOM_SIGMAS, gpu._BLOOM_WEIGHTS):
    acc_c = acc_c + w * np.clip(gaussian_filter(cl_c, s, mode="reflect") - 0.80, 0, None)
pre_c = cl_c + 0.85 * acc_c
x = np.clip(pre_c, 0, None)
ref = np.clip((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0, 1)

# ---------------- GPU chain, stage by stage
n, n3 = W * H, W * H * 3
blocks, b3 = (n + 255) // 256, (n3 + 255) // 256

d_img = cuda.to_device(np.ascontiguousarray(img).reshape(-1))
d_raw = cuda.to_device(np.zeros(n3, np.float32))
gpu._k_downsample[blocks, 256](d_img, d_raw, W, H, SS)
cuda.synchronize()
raw = d_raw.copy_to_host().reshape(H, W, 3)
log("stage1 downsample   maxdiff=%.3e" % np.abs(ds_c - raw).max())

d_base = cuda.to_device(np.zeros(n3, np.float32))
gpu._k_clamp[b3, 256](d_raw, d_base, n3)
cuda.synchronize()
base = d_base.copy_to_host().reshape(H, W, 3)
log("stage2 clamp        maxdiff=%.3e" % np.abs(cl_c - base).max())

d_tmp = cuda.to_device(np.zeros(n3, np.float32))
d_acc = cuda.to_device(np.zeros(n3, np.float32))
acc_g = np.zeros((H, W, 3), np.float64)
for sigma, weight in zip(gpu._BLOOM_SIGMAS, gpu._BLOOM_WEIGHTS):
    wts, r = gpu._gauss_wts(sigma)
    d_w = cuda.to_device(wts)
    d_c = cuda.to_device(gpu._chan_matrix(sigma))
    d_tmp2 = cuda.to_device(np.zeros(n3, np.float32))
    gpu._k_blur_h[blocks, 256](d_base, d_tmp, W, H, d_w, r)
    gpu._k_blur_v[blocks, 256](d_tmp, d_acc, W, H, d_w, r)
    cuda.synchronize()
    blur_g = d_acc.copy_to_host().reshape(H, W, 3)
    blur_c = gaussian_filter(cl_c, sigma, mode="reflect")
    log("  sigma=%4.1f blur     maxdiff=%.3e" % (sigma, np.abs(blur_c - blur_g).max()))
    gpu._k_chamix[blocks, 256](d_acc, W, H, d_c)
    cuda.synchronize()
    cm_g = d_acc.copy_to_host().reshape(H, W, 3)
    log("  sigma=%4.1f chamix   maxdiff=%.3e" % (sigma, np.abs(blur_c - cm_g).max()))
    cmat = gpu._chan_matrix(sigma)
    log("             cmat row0=%s" % np.round(cmat[0], 5))
    gpu._k_bloom_acc[blocks, 256](d_base, d_acc, d_acc, n, np.float32(0.80),
                                  np.float32(weight))
    cuda.synchronize()
    acc_g = d_acc.copy_to_host().reshape(H, W, 3)   # includes previous accumulation
    exp = acc_c if sigma == gpu._BLOOM_SIGMAS[0] else None
    del d_w, d_c, d_tmp2

acc_g = d_acc.copy_to_host().reshape(H, W, 3)
log("stage3 bloom acc    maxdiff=%.3e" % np.abs(acc_c - acc_g).max())
log("   acc cpu  max=%.5f mean=%.5f" % (acc_c.max(), acc_c.mean()))
log("   acc gpu  max=%.5f mean=%.5f" % (acc_g.max(), acc_g.mean()))
dd = np.abs(acc_c - acc_g)
iy, ix = np.unravel_index(int(dd.max(-1).argmax()), dd.shape[:2])
log("   worst (%d,%d) cpu=%.5f gpu=%.5f" % (iy, ix, acc_c[iy, ix], acc_g[iy, ix]))

d_out = cuda.to_device(np.zeros(n3, np.float32))
gpu._k_axpy[b3, 256](d_base, d_acc, d_out, n3, np.float32(0.85))
cuda.synchronize()
pre_g = d_out.copy_to_host().reshape(H, W, 3)
log("stage4 pre-tonemap  maxdiff=%.3e" % np.abs(pre_c - pre_g).max())

d_fin = cuda.to_device(np.zeros(n3, np.float32))
gpu._k_tonemap[b3, 256](d_out, d_fin, n3)
cuda.synchronize()
fin_g = d_fin.copy_to_host().reshape(H, W, 3)
log("stage5 tonemap      maxdiff=%.3e" % np.abs(ref - fin_g).max())

mine = gpu._finish(img.copy(), W, H, SS)
log("")
log("FULL _finish        maxdiff=%.3e meandiff=%.3e"
    % (np.abs(ref - mine).max(), np.abs(ref - mine).mean()))
log("  cpu mean=%.5f gpu mean=%.5f" % (ref.mean(), mine.mean()))

with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir, "_out", "_stage_out.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(LOG))