# -*- coding: utf-8 -*-
"""Are the residual rings voxel staircase, or 8-bit quantisation banding?
Walk a radial line across a smooth lobe and report the pixel values."""
import os
import sys
import numpy as np
from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir, os.pardir, "_out")

for name, cx, cy in (("orbital_d", 490, 290), ("orbital_f", 495, 275),
                     ("helicoid", 430, 440), ("roman", 380, 340)):
    p = os.path.join(OUT, name + ".png")
    if not os.path.exists(p):
        print(f"{name}: missing")
        continue
    im = np.asarray(Image.open(p).convert("RGB")).astype(np.int32)
    H, W = im.shape[:2]
    print("=" * 66)
    print(f"{name}   shape={im.shape}")
    # radial walk from the lobe centre outward
    vals = []
    for rr in range(0, 120):
        y = int(np.clip(cy - rr, 0, H - 1))
        x = int(np.clip(cx, 0, W - 1))
        vals.append(im[y, x].mean())
    vals = np.array(vals)
    print("  radial profile (every 8th px):")
    print("   ", " ".join(f"{vals[i]:6.1f}" for i in range(0, 120, 8)))
    d = np.abs(np.diff(vals))
    # count flat runs = quantisation plateaus
    flat = (d < 0.5).sum()
    print(f"  |diff| between adjacent px: mean={d.mean():.3f} max={d.max():.2f}")
    print(f"  near-flat steps (<0.5): {flat}/{len(d)}  "
          f"({100*flat/len(d):.0f}%)  <- high => 8-bit banding")
    # unique colours in a smooth 120x120 patch
    patch = im[cy - 60:cy + 60, cx - 60:cx + 60].reshape(-1, 3)
    uniq = len(np.unique(patch[:, 0]))
    print(f"  unique R values in 120x120 patch: {uniq}/256")
    # how many distinct levels does the gradient actually traverse?
    print(f"  R range in patch: {patch[:,0].min()}..{patch[:,0].max()}")
