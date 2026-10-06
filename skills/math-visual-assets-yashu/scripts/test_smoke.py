# -*- coding: utf-8 -*-
"""Smoke test: gyroid (analytic implicit) + Klein bottle (SDF from point cloud)."""
import time
import os
import numpy as np
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render3d import (AnalyticField, Abs, sdf_from_points, trace_surface, save)

t0 = time.time()

# ---- gyroid: cos x cos y + cos y cos z + cos z cos x = 0 ----
def gyroid(x, y, z):
    return (np.cos(x) * np.cos(y) + np.cos(y) * np.cos(z)
            + np.cos(z) * np.cos(x))

lo, hi = -1.35 * np.pi, 1.35 * np.pi
f = AnalyticField(gyroid, [lo] * 3, [hi] * 3, grad_step=6e-4)
img = trace_surface(f, [lo] * 3, [hi] * 3, W=520, H=520, ss=2,
                    azim=32, elev=19, k=0.62, maxsteps=240)
save(img, "test_gyroid", "Gyroid  cos x cos y + cos y cos z + cos z cos x = 0", 520)
print("gyroid done %.1fs" % (time.time() - t0), flush=True)

# ---- Klein bottle (standard figure-8 immersion) ----
a = 2.0
u = np.linspace(0, 2 * np.pi, 900)
v = np.linspace(0, 2 * np.pi, 900)
U, V = np.meshgrid(u, v, indexing="ij")
cu, su = np.cos(U), np.sin(U)
cv, sv = np.cos(V), np.sin(V)
R = a + cu / 2 * sv - su / 2 * np.sin(2 * V)
X = R * cu
Y = R * su
Z = su / 2 * sv + cu / 2 * np.sin(2 * V)
P = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
kf = sdf_from_points(P, pad=0.06, thick=1, res=260)
print("klein grid built %.1fs" % (time.time() - t0), flush=True)
img = trace_surface(kf, kf.lo, kf.hi, W=520, H=520, ss=2,
                    azim=35, elev=17, k=0.95, maxsteps=180, glow=0.18)
save(img, "test_klein", "Klein bottle", 520)
print("ALL OK %.1fs" % (time.time() - t0), flush=True)
