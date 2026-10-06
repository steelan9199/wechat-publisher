# -*- coding: utf-8 -*-
"""Full-res angle sweep for the two orbital scenes.  Renders at the delivered
860/ss=2 then downsamples for the contact sheet -- previewing at 430/ss=1 gave
a different framing, so small-res previews are not trustworthy here."""
import os
import sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir))

import render3d_gpu as R
from render3d_gpu import sdf_from_occupancy, trace_surface
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir, os.pardir, "_out")
os.makedirs(OUT, exist_ok=True)
W = H = 860
SS = 2
TILE = 400# contact-sheet tile size


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


def sheet(tiles, labels, path, cols=3):
    rows = (len(tiles) + cols - 1) // cols
    pad = 18
    sheetim = Image.new("RGB", (cols * (TILE + 6) + 6,
                                rows * (TILE + pad + 6) + 6), (20, 22, 30))
    d = ImageDraw.Draw(sheetim)
    for i, t in enumerate(tiles):
        r, c = divmod(i, cols)
        x = 6 + c * (TILE + 6)
        y = 6 + r * (TILE + pad + 6)
        d.text((x + 3, y + 4), labels[i], fill=(140, 225, 255))
        sheetim.paste(Image.fromarray(t).resize((TILE, TILE), Image.LANCZOS),
                      (x, y + pad))
    sheetim.save(path)
    print("sheet ->", path, flush=True)


def run(tag, l, m, angles):
    keep, lo, hi = make_occ(l, m)
    f = sdf_from_occupancy(keep, lo, hi, thick=1, res=384, smooth=0.8)
    del keep
    tiles, labels = [], []
    for az, el in angles:
        img = trace_surface(f, f.lo, f.hi, W, H, SS, azim=az, elev=el,
                            k=0.92, glow=0.22, thin=0.6, zoom=0.92)
        a = (np.clip(img, 0, 1) * 255.0 + 0.5).astype(np.uint8)
        tiles.append(a)
        labels.append(f"{tag}  az={az} el={el}")
        print(f"  {tag} az={az} el={el} done", flush=True)
    sheet(tiles, labels, os.path.join(OUT, f"full_{tag}.png"))


ANG = [(24, 74), (24, 35), (24, 18), (45, 26), (70, 22), (24, 8)]
print("=== orbital_f full-res angle sweep", flush=True)
run("f", 3, 0, ANG)
print("=== orbital_d full-res angle sweep", flush=True)
run("d", 2, 0, ANG)
print("SWEEP2 DONE", flush=True)
