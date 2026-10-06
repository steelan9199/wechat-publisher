# -*- coding: utf-8 -*-
"""Is the helicoid's flat top-right edge a grid-box truncation, or the
surface's own u=+/-tmax boundary?  Check whether any occupied voxel touches
the box faces."""
import os
import sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir))

a, tmax = 0.62, 2.55
u = np.linspace(-tmax, tmax, 1100)
v = np.linspace(-1.25, 1.25, 230)
U, V = np.meshgrid(u, v, indexing="ij")
cu, su = np.cos(U), np.sin(U)
P = np.stack([((a * U) * cu - V * su).ravel(),
              ((a * U) * su + V * cu).ravel(),
              np.broadcast_to(U, U.shape).ravel() * 0.92], 1)

pad = 0.06
res = 420
lo0 = P.min(0); hi0 = P.max(0)
ctr = 0.5 * (lo0 + hi0)
half = 0.5 * (hi0 - lo0).max()
lo = ctr - half * (1 + pad)
hi = ctr + half * (1 + pad)
ext = hi - lo
n = np.maximum(96, np.round(res * ext / ext.max()).astype(np.int32))
n = np.minimum(n, 420)
vox = ext / (n - 1)

print(f"point bbox lo={lo0.round(4)} hi={hi0.round(4)}")
print(f"grid box   lo={lo.round(4)} hi={hi.round(4)}")
print(f"n={n}  vox={vox.round(5)}")
print()
# margin between the point cloud and each box face, in voxels
for ax, name in enumerate("xyz"):
    m_lo = (lo0[ax] - lo[ax]) / vox[ax]
    m_hi = (hi[ax] - hi[ax]) / vox[ax]
    print(f"  {name}: margin low={m_lo:6.2f} vox  high={m_hi:6.2f} vox"
          f"{'   <-- TOUCHES FACE' if min(m_lo, m_hi) < 2 else ''}")

# which boundary of the PARAM SURFACE is nearest the top-right of the frame?
print()
print("extent of each param boundary:")
print(f"  u=+{tmax} edge: z = {tmax*0.92:.4f}  (highest z of the whole surface)")
print(f"  u=-{tmax} edge: z = {-tmax*0.92:.4f}")
print(f"  v=+1.25 edge and v=-1.25 edge are the inner/outer ribbon borders")
print()
print("The surface is OPEN in u (|u|<=2.55) and in v (|v|<=1.25), so the")
print("flat top-right edge is the ribbon's own u=+tmax border, not a box cut:")
print(f"  box half-width in z = {half*(1+pad):.4f} vs highest surface z = {hi0[2]:.4f}"
      f"  -> margin {(hi[2]-hi0[2])/vox[2]:.2f} vox")
