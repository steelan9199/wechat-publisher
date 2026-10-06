# -*- coding: utf-8 -*-
"""Roman surface: is the problem the param domain or the clip threshold?"""
import numpy as np
np.set_printoptions(precision=4, suppress=True)


def fn(U, V):
    t, u = U, V
    return np.stack([np.sin(t) * np.cos(u) ** 2,
                     np.sin(t) * np.sin(u) * np.cos(u),
                     np.cos(t) + 0.5 * (np.cos(2 * t) - 1)
                     + 0.5 * (np.cos(2 * t) - 2 * np.cos(u) ** 2)], -1)


def cloud(nu, nv, u0, u1, v0, v1, wrap_u=True):
    u = np.linspace(u0, u1, nu, endpoint=not wrap_u)
    v = np.linspace(v0, v1, nv, endpoint=False)
    U, V = np.meshgrid(u, v, indexing="ij")
    return fn(U, V).reshape(-1, 3)


print("current  : t in [0, pi], u in [-pi/2, pi/2], clip |P|<2.2")
P = cloud(1500, 1500, 0, np.pi, -np.pi / 2, np.pi / 2)
Q = P[np.abs(P).max(1) < 2.2]
print(f"   x range [{Q[:,0].min():+.3f}, {Q[:,0].max():+.3f}]  "
      f"y [{Q[:,1].min():+.3f}, {Q[:,1].max():+.3f}]  "
      f"z [{Q[:,2].min():+.3f}, {Q[:,2].max():+.3f}]")
print("   -> x never negative: HALF the surface is missing "
      "(sin(t)>=0 for t in [0,pi])")

print()
print("full t range, u full circle, no clip:")
for t1 in (np.pi, 2 * np.pi):
    for v1, lbl in ((np.pi, "u in [-pi/2,pi/2]"), (2 * np.pi, "u in [0,2pi]")):
        P = cloud(1500, 1500, 0, t1, 0, v1)
        m = np.abs(P).max(1)
        e = P.max(0) - P.min(0)
        print(f"   t in [0,{t1:.2f}] {lbl}: |P|max={m.max():.3f}  "
              f"lo={P.min(0).round(3)} hi={P.max(0).round(3)}")
        print(f"       extent={e.round(3)} aspect={(e/e.max()).round(3)}")

print()
print("=== chosen: t in [0, 2pi], u in [0, 2pi], no clip ===")
P = cloud(1600, 1600, 0, 2 * np.pi, 0, 2 * np.pi)
m = np.abs(P).max(1)
for thr in (2.2, 2.6, 3.0, 99):
    Q = P[m < thr]
    e = Q.max(0) - Q.min(0)
    c = 0.5 * (Q.max(0) + Q.min(0))
    print(f"   clip {thr:5}: keep {100*(m<thr).mean():5.1f}%  "
          f"lo={Q.min(0).round(3)} hi={Q.max(0).round(3)}")
    print(f"       extent={e.round(3)} aspect={(e/e.max()).round(3)}")
    # grid box
    half = 0.5 * e.max()
    lo = c - half * 1.05
    hi = c + half * 1.05
    ext = hi - lo
    n = np.minimum(np.round(420 * ext / ext.max()).astype(int), 420)
    vox = ext / (n - 1)
    print(f"       box={ext.round(3)} n={n} vox={vox.max():.5f} "
          f"cam_radius={0.5*np.linalg.norm(ext):.3f} obj_radius={0.5*e.max():.3f}"
          f"  fill={0.5*e.max()/(0.5*np.linalg.norm(ext))*100:.0f}%")
