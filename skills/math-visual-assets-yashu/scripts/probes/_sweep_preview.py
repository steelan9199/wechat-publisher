# -*- coding: utf-8 -*-
"""Preview sweep: camera angles for the orbital scenes + dither test for
8-bit banding.  Renders small (430x430, ss=1) for speed and builds a
labelled contact sheet per scene."""
import os
import sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir))

import render3d_gpu as R
from render3d_gpu import sdf_from_occupancy, trace_surface, save
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir, os.pardir, "_out")
os.makedirs(OUT, exist_ok=True)
W = H = 430
SS = 1


def make_occ(l, m, res=384, half=0.94):
    g = np.linspace(-half, half, res).astype(np.float32)
    X, Yc, Z = np.meshgrid(g, g, g, indexing="ij")
    r = np.sqrt(X * X + Yc * Yc + Z * Z) + 1e-9
    ct = np.clip(Z / r, -1, 1)
    st = np.sqrt(np.clip(1 - ct * ct, 1e-12, None))
    phi = np.arctan2(Yc, X)
    if l == 2 and m == 0:
        Ylm = 3 * ct * ct - 1; c, Rr = 0.62, 0.90
    elif l == 3 and m == 0:
        Ylm = ct * (5 * ct * ct - 3); c, Rr = 0.95, 0.96
    else:
        Ylm = 2 * ct; c, Rr = 0.55, 0.90
    rad = Rr * np.sqrt(np.clip((np.abs(Ylm) - c) / max(2.0 - c, 1e-6), 0, 1))
    keep = r < rad
    del X, Yc, Z, r, ct, st, phi, Ylm, rad
    return keep, [g[0]] * 3, [g[-1]] * 3


def dither(img, amp=1.2, seed=0):
    """Triangular-PDF dither of +/- amp/2 LSB, applied before uint8 quantisation.
    Breaks up8-bit Mach banding on smooth gradients."""
    rng = np.random.default_rng(seed)
    n = rng.random(img.shape[:2]) + rng.random(img.shape[:2]) - 1.0  # [-1,1]
    return np.clip(img * 255.0 + 0.5 + n[..., None] * (amp * 0.5),
                   0, 255).astype(np.uint8)


def contact_sheet(tiles, labels, path, cols=None):
    cols = cols or len(tiles)
    rows = (len(tiles) + cols - 1) // cols
    th, tw = tiles[0].shape[:2]
    pad = 16
    sheet = Image.new("RGB", (cols * (tw + 4) + 4,
                              rows * (th + pad + 4) + 4), (24, 26, 34))
    d = ImageDraw.Draw(sheet)
    for i, t in enumerate(tiles):
        r, c = divmod(i, cols)
        x = 4 + c * (tw + 4)
        y = 4 + r * (th + pad + 4)
        sheet.paste(Image.fromarray(t), (x, y + pad))
        d.text((x + 2, y + 3), labels[i], fill=(150, 220, 255))
    sheet.save(path)
    print("sheet ->", path, flush=True)


def run(tag, l, m, angles, zoom=0.92):
    keep, lo, hi = make_occ(l, m)
    f = sdf_from_occupancy(keep, lo, hi, thick=1, res=384, smooth=0.8)
    del keep
    tiles, labels = [], []
    for az, el in angles:
        img = trace_surface(f, f.lo, f.hi, W, H, SS, azim=az, elev=el,
                            k=0.92, glow=0.22, thin=0.6, zoom=zoom)
        a = (np.clip(img, 0, 1) * 255.0 + 0.5).astype(np.uint8)
        tiles.append(a)
        labels.append(f"{tag} az={az} el={el}")
    contact_sheet(tiles, labels, os.path.join(OUT, f"sheet_{tag}.png"))


print("=== orbital_f angle sweep (f orbital looks like a sliver at el=74)",
      flush=True)
run("f", 3, 0, [(24, 74), (24, 20), (24, 35), (24, 55), (45, 30), (24, 12)])

print("=== orbital_d angle sweep", flush=True)
run("d", 2, 0, [(24, 74), (24, 20), (24, 35), (24, 55), (45, 30), (24, 12)])

print("=== dither test on the current orbital_d full-res render",
      flush=True)
src = os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir, os.pardir, "_out", "orbital_d.png")
if os.path.exists(src):
    im = np.asarray(Image.open(src).convert("RGB")).astype(np.float32) / 255.0
    tiles, labels = [], []
    for amp in (0.0, 0.8, 1.5, 3.0):
        tiles.append(dither(im, amp=amp, seed=1))
        labels.append(f"dither amp={amp}")
    # crop the same smooth lobe from each so banding is comparable
    cy, cx = 290, 490
    crops = [t[cy - 150:cy + 150, cx - 150:cx + 150] for t in tiles]
    contact_sheet(crops, labels,
                  os.path.join(OUT, "sheet_dither.png"), cols=4)

print("SWEEP DONE", flush=True)
