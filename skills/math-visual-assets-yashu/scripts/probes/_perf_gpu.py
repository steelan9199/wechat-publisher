# -*- coding: utf-8 -*-
"""Where does the 0.66 s actually go?  Split kernel time vs post-processing."""
import os
import sys
import time
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir))
import render3d_gpu as gpu
import render3d as cpu
from numba_cuda_mlir import cuda

LOG = []


def log(*a):
    s = " ".join(str(x) for x in a)
    LOG.append(s)
    print(s, flush=True)


L = 1.05 * np.pi
W = H = 860
SS = 2

# warm up the kernel
gpu.trace_surface(None, [-L] * 3, [L] * 3, W, H, SS, azim=30, elev=18,
                  k=0.62, maxsteps=300, thin=0.7, kind=gpu.F_GYROID)

log("--- full trace_surface x3")
for _ in range(3):
    t = time.time()
    gpu.trace_surface(None, [-L] * 3, [L] * 3, W, H, SS, azim=30, elev=18,
                      k=0.62, maxsteps=300, thin=0.7, kind=gpu.F_GYROID)
    log("  %.3fs" % (time.time() - t))

log("--- post-processing only (_finish on a 1720x1720x3 array)")
Wf, Hf = W * SS, H * SS
img = np.random.rand(Hf, Wf, 3).astype(np.float32)
for _ in range(2):
    t = time.time()
    gpu._finish(img, W, H, SS)
    log("  _finish %.3fs" % (time.time() - t))

log("--- breakdown inside _finish")
t = time.time()
d = img.reshape(H, SS, W, SS, 3).mean(axis=(1, 3))
log("  downsample  %.3fs" % (time.time() - t))
small = np.clip(d, 0, 1)
t = time.time()
b = gpu.bloom(small)
log("  bloom       %.3fs" % (time.time() - t))
t = time.time()
x = np.clip(b, 0, None)
y = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)
log("  tonemap     %.3fs" % (time.time() - t))

log("--- kernel only (bypass finish)")
P = np.zeros(gpu.PAR_N, np.float32)
P[0] = gpu.F_GYROID
dP = cuda.to_device(P)
dev = cuda.to_device(np.zeros(1, np.float32))
ro, fwd, rgt, up = gpu._frame(30, 18, 30.0, 6.0, [0, 0, 0])
focal = 1.0 / np.tan(np.radians(30.0) * 0.5)
out = cuda.to_device(np.zeros((Wf * Hf, 3), np.float32))
blocks = (Wf * Hf + 255) // 256
for _ in range(3):
    t = time.time()
    gpu._k_surface[blocks, 256](
        out, dP, dev, Wf, Hf,
        float(ro[0]), float(ro[1]), float(ro[2]),
        float(fwd[0]), float(fwd[1]), float(fwd[2]),
        float(rgt[0]), float(rgt[1]), float(rgt[2]),
        float(up[0]), float(up[1]), float(up[2]),
        float(focal), -L, -L, -L, L, L, L,
        0.62, 1.1e-4 * 2 * L * 0.62, 300, 1e-4, L, 1e-4,
        1.0, 0.7, 0.0, 1.0, 1.0, 0.95, 0.86)
    cuda.synchronize()
    log("  kernel %.3fs" % (time.time() - t))

log("--- copy back only")
for _ in range(3):
    t = time.time()
    a = out.copy_to_host()
    log("  copy %.3fs" % (time.time() - t))

log("--- CPU engine at same 860x860 ss=2 for reference")
f = cpu.AnalyticField(lambda x, y, z: (np.cos(x) * np.cos(y)
                                       + np.cos(y) * np.cos(z)
                                       + np.cos(z) * np.cos(x)),
                      [-L] * 3, [L] * 3, grad_step=5e-4)
t = time.time()
cpu.trace_surface(f, f.lo, f.hi, W, H, SS, azim=30, elev=18,
                  k=0.62, maxsteps=300, thin=0.7)
log("  cpu total %.3fs" % (time.time() - t))

t = time.time()
cpu._finish(img, W, H, SS)
log("  cpu _finish alone %.3fs" % (time.time() - t))

if __name__ == "__main__":
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir, "_out", "_perf_out.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(LOG))