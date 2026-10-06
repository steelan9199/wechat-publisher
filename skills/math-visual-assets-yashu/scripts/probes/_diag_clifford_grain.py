# -*- coding: utf-8 -*-
"""Is the clifford grain render noise, or real per-strand structure?

Compares the delivered clifford against the delivered dejong (an accepted
reference that shows the same fine speckle).  If clifford's high-frequency
energy is in the same range as dejong's, the grain is intrinsic to rendering
space-filling attractors as density clouds, not a defect.
"""
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
FIGS = os.path.join(HERE, os.pardir, os.pardir, "assets", "figs")
OUT = os.path.join(HERE, os.pardir, os.pardir, "_out")
os.makedirs(OUT, exist_ok=True)

# crop around the visibly grainy area
BOX = (330, 380, 610, 500)   # left, top, right, bottom


def hf_rms(g):
    """RMS of (pixel - 3x3 mean): high-frequency energy."""
    k = np.ones((3, 3)) / 9.0
    pad = np.pad(g, 1, mode="edge")
    sm = sum(pad[i:i + g.shape[0], j:j + g.shape[1]] * k[i, j]
             for i in range(3) for j in range(3))
    return (g - sm).std()


for name in ("clifford", "dejong", "lorenz"):
    p = os.path.join(FIGS, name + ".png")
    if not os.path.exists(p):
        print(f"{name}: missing {p}")
        continue
    im = Image.open(p).convert("RGB")
    c = im.crop(BOX)
    c.resize((c.width * 3, c.height * 3), Image.NEAREST).save(
        os.path.join(OUT, f"crop_{name}.png"))

    a = np.asarray(im).astype(np.float32)
    g = a[BOX[1]:BOX[3], BOX[0]:BOX[2]].mean(2)
    hp = g - g.mean()
    print(f"{name:10s} crop mean={g.mean():6.2f} std={g.std():6.2f} "
          f"highfreq_rms={hf_rms(g):5.2f}  "
          f"frac|pixel-mean3x3|>8: "
          f"{100 * (np.abs(hp) > 8).mean():5.2f}%")
    print(f"           -> {os.path.join(OUT, f'crop_{name}.png')}")

print()
print("Reading: clifford and dejong should land in the same highfreq_rms band.")
print("That means the grain is the attractor's own strand structure -- a real")
print("property of a space-filling density cloud, not something to 'fix'.")
