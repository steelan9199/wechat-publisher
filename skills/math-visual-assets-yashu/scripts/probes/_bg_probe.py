# -*- coding: utf-8 -*-
"""Isolate the background mismatch between CPU and GPU."""
import os
import sys
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir))
import render3d as cpu
import render3d_gpu as gpu
from numba_cuda_mlir import cuda

LOG = []


def log(*a):
    s = " ".join(str(x) for x in a)
    LOG.append(s)
    print(s, flush=True)


W = H = 8
SS = 2
Wf, Hf = W * SS, H * SS

ref = cpu.background(Wf, Hf)
log("cpu background stats: min=%.6f max=%.6f mean=%.6f" % (ref.min(), ref.max(), ref.mean()))


@cuda.jit
def kbg(out, Wf, Hf, cy):
    i = cuda.grid(1)
    if i >= Wf * Hf:
        return
    ax = (float(i % Wf) + 0.5) / float(Wf) * 2.0 - 1.0
    ay = (float(i // Wf) + 0.5) / float(Hf) * 2.0
    r, g, b = gpu._background(ax, ay, cy)
    out[i, 0] = r
    out[i, 1] = g
    out[i, 2] = b


d = cuda.to_device(np.zeros((Wf * Hf, 3), np.float32))
kbg[(Wf * Hf + 255) // 256, 256](d, Wf, Hf, 0.50)
cuda.synchronize()
mine = d.copy_to_host().reshape(Hf, Wf, 3)
log("gpu background stats: min=%.6f max=%.6f mean=%.6f" % (mine.min(), mine.max(), mine.mean()))

dif = np.abs(ref - mine)
log("maxdiff=%.6f meandiff=%.6f" % (dif.max(), dif.mean()))

# where
iy, ix = np.unravel_index(dif.max(-1).argmax(), dif.shape[:2])
log("worst pixel row=%d col=%d" % (iy, ix))
ax_c = (ix + 0.5) / Wf * 2 - 1
ay_c = 1 - (iy + 0.5) / Hf * 2
log("  ax=%.6f ay=%.6f" % (ax_c, ay_c))
log("  cpu=%.6f %.6f %.6f" % tuple(ref[iy, ix]))
log("  gpu=%.6f %.6f %.6f" % tuple(mine[iy, ix]))

# replicate the formula by hand in numpy for the same pixel
r_ = np.sqrt((ax_c * 0.85) ** 2 + (ay_c * 0.95 - (0.50 - 0.5) * 1.4) ** 2)
glow = np.exp(-(r_ ** 2) / 0.85)
top = np.array([0.020, 0.030, 0.062])
bot = np.array([0.004, 0.006, 0.016])
t = np.clip((ay_c + 1) / 2, 0, 1)
bg = top * (1 - t) + bot * t
bg = bg + glow * np.array([0.055, 0.085, 0.150])
vig = np.clip(1.18 - 0.52 * r_ ** 2, 0.35, 1.0)
log("  manual=%.6f %.6f %.6f" % tuple(bg * vig))
log("  r=%.6f glow=%.6f t=%.6f vig=%.6f" % (r_, glow, t, vig))

# sample a grid of pixels
log("--- sample grid (row, col) -> cpu | gpu")
for row in (0, Hf // 4, Hf // 2, 3 * Hf // 4, Hf - 1):
    line = []
    for col in (0, Wf // 4, Wf // 2, 3 * Wf // 4, Wf - 1):
        c = ref[row, col].mean()
        g = mine[row, col].mean()
        line.append("(%d,%d) c=%.5f g=%.5f d=%+.5f" % (row, col, c, g, g - c))
    log("  " + " | ".join(line))

if __name__ == "__main__":
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir, "_out", "_bg_out.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(LOG))