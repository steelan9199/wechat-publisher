# -*- coding: utf-8 -*-
"""Compare the GPU post chain against the CPU one pixel by pixel."""
import os
import sys
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir))
import render3d_gpu as gpu
import render3d as cpu
from scipy.ndimage import gaussian_filter
from numba_cuda_mlir import cuda

LOG = []


def log(*a):
    s = " ".join(str(x) for x in a)
    LOG.append(s)
    print(s, flush=True)


W = H = 64
SS = 2
Wf, Hf = W * SS, H * SS
rng = np.random.default_rng(3)

# structured test image: bright blob on dark ground -> exercises the bloom path
img = np.zeros((Hf, Wf, 3), np.float32)
yy, xx = np.mgrid[0:Hf, 0:Wf]
blob = np.exp(-(((xx - Wf / 2) ** 2 + (yy - Hf / 2) ** 2) / (Wf * 0.15) ** 2))
img[..., 0] = blob
img[..., 1] = blob * 0.6
img[..., 2] = blob * 0.3
img += 0.02

# ---- CPU reference chain
ref_ds = img.reshape(H, SS, W, SS, 3).mean(axis=(1, 3))
ref_cl = np.clip(ref_ds, 0, 1)
ref_b = cpu.bloom(ref_cl)
ref_t = np.clip(ref_b, 0, None)
ref_t = (ref_t * (2.51 * ref_t + 0.03)) / (ref_t * (2.43 * ref_t + 0.59) + 0.14)
ref = np.clip(ref_t, 0, 1)

# ---- GPU chain
mine = gpu._finish(img.copy(), W, H, SS)

d = np.abs(ref - mine)
log("CPU  mean=%.6f max=%.6f" % (ref.mean(), ref.max()))
log("GPU  mean=%.6f max=%.6f" % (mine.mean(), mine.max()))
log("diff mean=%.6f max=%.6f" % (d.mean(), d.max()))

# ---- step-by-step: downsample
ds_gpu = np.zeros((H, W, 3), np.float32)
d_img = cuda.to_device(img.reshape(-1).copy())
d_ds = cuda.to_device(np.zeros(W * H * 3, np.float32))
gpu._k_downsample[(W * H + 255) // 256, 256](d_img, d_ds, W, H, SS)
cuda.synchronize()
ds_gpu = d_ds.copy_to_host().reshape(H, W, 3)
log("downsample  maxdiff=%.3e" % np.abs(ref_ds - ds_gpu).max())

# ---- step-by-step: clamp
d_cl = cuda.to_device(np.zeros(W * H * 3, np.float32))
gpu._k_clamp[(W * H * 3 + 255) // 256, 256](d_ds, d_cl, W * H * 3)
cuda.synchronize()
cl_gpu = d_cl.copy_to_host().reshape(H, W, 3)
log("clamp       maxdiff=%.3e" % np.abs(ref_cl - cl_gpu).max())

# ---- step-by-step: one blur at sigma=3
wts, r = gpu._gauss_wts(3.0)
dw = cuda.to_device(wts)
d_tmp = cuda.to_device(np.zeros(W * H * 3, np.float32))
d_acc = cuda.to_device(np.zeros(W * H * 3, np.float32))
bl = (W * H + 255) // 256
gpu._k_blur_h[bl, 256](d_cl, d_tmp, W, H, dw, r)
gpu._k_blur_v[bl, 256](d_tmp, d_acc, W, H, dw, r)
cuda.synchronize()
blur_gpu = d_acc.copy_to_host().reshape(H, W, 3)
blur_cpu = gaussian_filter(ref_cl, 3.0, mode="reflect")  # scalar sigma -> ALL axes
log("blur s=3    maxdiff=%.3e  meandiff=%.3e" % (
    np.abs(blur_cpu - blur_gpu).max(), np.abs(blur_cpu - blur_gpu).mean()))

# check reflect convention: compare against numpy modes
b_xy = gaussian_filter(ref_cl, (3.0, 3.0, 0.0), mode="reflect")
b_all = gaussian_filter(ref_cl, 3.0, mode="reflect")
log("   vs scipy sigma=(3,3,0) maxdiff=%.3e" % np.abs(b_xy - blur_gpu).max())
log("   vs scipy sigma=3 all-axes maxdiff=%.3e" % np.abs(b_all - blur_gpu).max())
log("   (3,3,0) vs 3-allaxes differ by %.3e -> CPU bloom blurs colour axis too"
    % np.abs(b_xy - b_all).max())

# where is blur worst?
dd = np.abs(blur_cpu - blur_gpu).max(-1)
iy, ix = np.unravel_index(dd.argmax(), dd.shape)
log("blur worst at row=%d col=%d cpu=%.6f gpu=%.6f" % (iy, ix, blur_cpu[iy, ix], blur_gpu[iy, ix]))
log("  row %d col %d full row cpu:" % (iy, ix))
log("  " + " ".join("%.4f" % v for v in blur_cpu[iy, :8]))
log("  " + " ".join("%.4f" % v for v in blur_gpu[iy, :8]))

# ---- step-by-step: full bloom acc
d_acc2 = cuda.to_device(np.zeros(W * H * 3, np.float32))
for sigma, weight in zip(gpu._BLOOM_SIGMAS, gpu._BLOOM_WEIGHTS):
    w2, r2 = gpu._gauss_wts(sigma)
    d2 = cuda.to_device(w2)
    d_t2 = cuda.to_device(np.zeros(W * H * 3, np.float32))
    gpu._k_blur_h[bl, 256](d_cl, d_t2, W, H, d2, r2)
    gpu._k_blur_v[bl, 256](d_t2, d_acc2, W, H, d2, r2)
    gpu._k_bloom_acc[bl, 256](d_cl, d_acc2, d_acc2, W * H,
                             np.float32(0.80), np.float32(weight))
    del d2, d_t2
cuda.synchronize()
acc_gpu = d_acc2.copy_to_host().reshape(H, W, 3)
acc_cpu = np.zeros_like(ref_cl)
for s, w in zip(gpu._BLOOM_SIGMAS, gpu._BLOOM_WEIGHTS):
    acc_cpu += w * np.clip(gaussian_filter(ref_cl, s) - 0.80, 0, None)
log("bloom acc   maxdiff=%.3e" % np.abs(acc_cpu - acc_gpu).max())
log("  acc cpu max=%.6f gpu max=%.6f" % (acc_cpu.max(), acc_gpu.max()))

if __name__ == "__main__":
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir, "_out", "_post_out.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(LOG))