# -*- coding: utf-8 -*-
"""
3D math-formula gallery: a small sphere-tracing / volume-rendering renderer
built on numpy only. Produces publication-quality shaded surfaces for
classical mathematical surfaces, fractals and attractors.
"""
import os
import numpy as np
from scipy.ndimage import distance_transform_edt
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap

# Where rendered PNGs land.  Defaults to <skill>/assets/figs so the skill is
# self-contained; override with the MATH3D_OUT environment variable.
_OUT = os.environ.get("MATH3D_OUT")
if _OUT is None:
    _OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        os.pardir, "assets", "figs")
OUTDIR = os.path.abspath(_OUT)
os.makedirs(OUTDIR, exist_ok=True)


# --------------------------------------------------------------------------
# fields
# --------------------------------------------------------------------------
class AnalyticField:
    """f(x,y,z) evaluated directly -> unlimited geometric sharpness."""

    def __init__(self, fn, lo, hi, grad_step=None):
        self.fn = fn
        self.lo = np.array(lo, float)
        self.hi = np.array(hi, float)
        self.gs = grad_step if grad_step is not None else 1.5e-4 * float(np.max(self.hi - self.lo))

    def __call__(self, p):
        return self.fn(p[:, 0], p[:, 1], p[:, 2])


class GridField:
    """Trilinear lookup into a precomputed signed distance grid."""

    def __init__(self, sdf, lo, hi):
        sdf = np.nan_to_num(np.ascontiguousarray(sdf, dtype=np.float32),
                            nan=1e3, posinf=1e3, neginf=-1e3)
        self.sdf = sdf
        self.lo = np.array(lo, float)
        self.hi = np.array(hi, float)
        self.n = np.array(self.sdf.shape, np.int32)
        self.h = (self.hi - self.lo) / np.maximum(self.n - 1, 1)

    def __call__(self, p):
        g = (p - self.lo) / self.h
        g = np.nan_to_num(g, nan=0.0, posinf=0.0, neginf=0.0)
        np.clip(g, 0.0, (self.n - 1) * 0.99999, out=g)
        i0 = g.astype(np.int32)
        f = g - i0
        i1 = i0 + 1
        s = self.sdf
        x0, y0, z0 = i0[:, 0], i0[:, 1], i0[:, 2]
        x1, y1, z1 = i1[:, 0], i1[:, 1], i1[:, 2]
        c000 = s[x0, y0, z0]; c100 = s[x1, y0, z0]
        c010 = s[x0, y1, z0]; c110 = s[x1, y1, z0]
        c001 = s[x0, y0, z1]; c101 = s[x1, y0, z1]
        c011 = s[x0, y1, z1]; c111 = s[x1, y1, z1]
        fx = f[:, 0]; fy = f[:, 1]; fz = f[:, 2]
        c00 = c000 + (c100 - c000) * fx
        c10 = c010 + (c110 - c010) * fx
        c01 = c001 + (c101 - c001) * fx
        c11 = c011 + (c111 - c011) * fx
        c0 = c00 + (c10 - c00) * fy
        c1 = c01 + (c11 - c01) * fy
        return c0 + (c1 - c0) * fz


class Union:
    """Union of several distance-like fields (all must be distance bounds)."""

    def __init__(self, *fields):
        self.fields = fields

    def __call__(self, p):
        out = self.fields[0](p)
        for f in self.fields[1:]:
            np.minimum(out, f(p), out=out)
        return out


class Abs:
    """Unsigned distance (one-sided surface, e.g. helicoid / ribbon)."""

    def __init__(self, field):
        self.f = field

    def __call__(self, p):
        return np.abs(self.f(p))


# --------------------------------------------------------------------------
# SDF construction from dense point samples
# --------------------------------------------------------------------------
def _dilate(mask, iters):
    if iters <= 0:
        return mask
    out = mask.copy()
    for _ in range(iters):
        m = out
        p = np.zeros_like(m)
        p[1:, :, :] |= m[:-1, :, :]; p[:-1, :, :] |= m[1:, :, :]
        p[:, 1:, :] |= m[:, :-1, :]; p[:, :-1, :] |= m[:, 1:, :]
        p[:, :, 1:] |= m[:, :, :-1]; p[:, :, :-1] |= m[:, :, 1:]
        out = p
    return out


# --------------------------------------------------------------------------
# Euclidean distance transform backend
#   scipy's distance_transform_edt is single-threaded and dominates build time
#   on large grids (9.6 s for two 340^3 passes).  The optional `edt` package
#   (seung-lab, OpenMP) does the same job in ~0.3 s -- a 32x speed-up -- and
#   agrees with scipy to ~1e-6 (visually identical: IoU 1.0).  If `edt` is not
#   installed we quietly fall back to scipy, so a bare env still works.
# --------------------------------------------------------------------------
try:
    import edt as _edt_pkg
except Exception:                                    # optional dependency
    _edt_pkg = None

EDT_BACKEND = "edt" if _edt_pkg is not None else "scipy"


def _edt_pair(mask, vox):
    """Return (dist_outside, dist_inside) of a boolean occupancy grid."""
    if _edt_pkg is not None:
        aniso = (float(vox[0]), float(vox[1]), float(vox[2]))
        m = np.ascontiguousarray(mask, dtype=np.uint8)
        return (_edt_pkg.edt(m, anisotropy=aniso, parallel=-1),
                _edt_pkg.edt(1 - m, anisotropy=aniso, parallel=-1))
    return (distance_transform_edt(mask, sampling=vox),
            distance_transform_edt(~mask, sampling=vox))


def sdf_from_points(pts, pad=0.10, thick=1, res=300, cell_target=None):
    """Signed distance grid from a dense surface point cloud."""
    pts = np.asarray(pts, float)
    lo = pts.min(0); hi = pts.max(0)
    ctr = 0.5 * (lo + hi); half = 0.5 * (hi - lo).max()
    lo = ctr - half * (1 + pad); hi = ctr + half * (1 + pad)
    ext = hi - lo
    nmax = res if cell_target is None else cell_target
    n = np.maximum(96, np.round(nmax * ext / ext.max()).astype(np.int32))
    n = np.minimum(n, 420)
    vox = ext / np.maximum(n - 1, 1)

    occ = np.zeros(tuple(n), bool)
    idx = np.rint((pts - lo) / vox).astype(np.int32)
    np.clip(idx, 0, (n - 1), out=idx)
    occ[idx[:, 0], idx[:, 1], idx[:, 2]] = True
    occ = _dilate(occ, thick)
    # close pinholes left by an imperfectly dense point cloud, otherwise the
    # surface renders with a stippled / holed look
    if thick <= 1:
        occ = _dilate(occ, 1)

    dout, din = _edt_pair(occ, vox)
    del occ
    sdf = (dout - din).astype(np.float32)
    del dout, din
    # light smoothing removes voxel terracing without moving the surface
    from scipy.ndimage import gaussian_filter
    sdf = gaussian_filter(sdf, sigma=0.6).astype(np.float32)
    return GridField(sdf, lo, hi)


def sdf_from_occupancy(occ, lo, hi, thick=1, res=300):
    lo = np.array(lo, float); hi = np.array(hi, float)
    ext = hi - lo
    n = np.maximum(96, np.round(res * ext / ext.max()).astype(np.int32))
    n = np.minimum(n, 384)
    vox = ext / np.maximum(n - 1, 1)
    occ = _dilate(occ, thick)
    dout, din = _edt_pair(occ, vox)
    sdf = (dout - din).astype(np.float32)
    del dout, din
    return GridField(sdf, lo, hi)


# --------------------------------------------------------------------------
# camera + shading helpers
# --------------------------------------------------------------------------
def _norm(v):
    return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-20)


PALETTE = LinearSegmentedColormap.from_list(
    "nebula",
    ["#0d2a4d", "#0d5f86", "#128f9e", "#3fc9b0", "#9fe6c8", "#e8c877",
     "#e07a4a", "#b3305f", "#5b21a8"],
    N=512,
)


def cam_rays(W, H, azim, elev, dist, center, fov=30.0):
    f = 1.0 / np.tan(np.radians(fov) * 0.5)
    ax = (np.arange(W) + 0.5) / W * 2 - 1
    ay = 1 - (np.arange(H) + 0.5) / H * 2
    gx, gy = np.meshgrid(ax, ay)
    d = _norm(np.stack([gx, gy, -np.full_like(gx, f)], -1).reshape(-1, 3))
    a = np.radians(azim); e = np.radians(elev)
    Rz = np.array([[np.cos(a), -np.sin(a), 0], [np.sin(a), np.cos(a), 0], [0, 0, 1]])
    # rotate by -elev so that positive elev lifts the camera above the object
    Rx = np.array([[1, 0, 0], [0, np.cos(e), np.sin(e)], [0, -np.sin(e), np.cos(e)]])
    R = Rx @ Rz
    d = d @ R.T
    forward = R @ np.array([0.0, 0.0, -1.0])   # points from camera toward target
    ro = np.asarray(center, float) - forward * dist
    return ro, _norm(d)


def _box_entry(ro, rd, lo, hi):
    """Slab test. Returns (t_enter, t_exit, hits_box) for each ray."""
    lo = np.asarray(lo, float); hi = np.asarray(hi, float)
    par = np.abs(rd) < 1e-12
    safe = np.where(par, 1.0, rd)
    t0 = (lo[None, :] - ro[None, :]) / safe
    t1 = (hi[None, :] - ro[None, :]) / safe
    t0 = np.where(par, -np.inf, t0)
    t1 = np.where(par, np.inf, t1)
    inside = np.all((ro[None, :] >= lo[None, :]) & (ro[None, :] <= hi[None, :]), axis=1)
    tsmall = np.maximum(np.minimum(t0, t1).max(axis=1), 0.0)
    tbig = np.maximum(t0, t1).min(axis=1)
    hit = inside | (tbig > tsmall)
    tenter = np.where(inside, 0.0, tsmall)
    return tenter, tbig, hit


def gradient(field, p, h):
    g = np.empty_like(p)
    for i in range(3):
        q = p.copy(); q[:, i] += h
        g[:, i] = field(q)
        q[:, i] -= 2 * h
        g[:, i] -= field(q)
        q[:, i] += h
    return _norm(g)


def ambient_occlusion(field, p, n, scale=1.0, taps=4):
    occ, sca = 0.0, 1.0
    for i in range(taps):
        h = scale * (0.015 + 0.075 * i)
        d = field(p + n * h)
        occ += (h - d) * sca
        sca *= 0.70
    return np.clip(1.0 - 1.25 * occ, 0.06, 1.0)


def soft_shadow(field, p, L, tmax=2.6, k=14.0, steps=22):
    res = np.ones(len(p))
    t = np.full(len(p), 0.015)
    for _ in range(steps):
        d = field(p + L * t[:, None])
        res = np.minimum(res, k * d / t)
        t = t + np.clip(d, 0.03, 0.34)
        if np.all(res < 0.004) or np.all(t > tmax):
            break
    return np.clip(res, 0.0, 1.0) ** 0.85


def background(W, H, cy=0.50):
    ax = (np.arange(W) + 0.5) / W * 2 - 1
    ay = (np.arange(H) + 0.5) / H * 2
    gx, gy = np.meshgrid(ax, ay)
    r = np.sqrt((gx * 0.85) ** 2 + (gy * 0.95 - (cy - 0.5) * 1.4) ** 2)
    glow = np.exp(-(r ** 2) / 0.85)
    top = np.array([0.020, 0.030, 0.062])
    bot = np.array([0.004, 0.006, 0.016])
    t = np.clip((gy + 1) / 2, 0, 1)[..., None]
    bg = top * (1 - t) + bot * t
    bg = bg + glow[..., None] * np.array([0.055, 0.085, 0.150])
    vig = np.clip(1.18 - 0.52 * r ** 2, 0.35, 1.0)
    return np.clip(bg * vig[..., None], 0, 1)


def bloom(img, thresh=0.80, scales=(3.0, 9.0, 26.0), weights=(0.30, 0.22, 0.16)):
    from scipy.ndimage import gaussian_filter
    out = np.zeros_like(img)
    for s, w in zip(scales, weights):
        b = gaussian_filter(img, s)
        out += w * np.clip(b - thresh, 0, None)
    return img + out * 0.85


# --------------------------------------------------------------------------
# core sphere marcher
# --------------------------------------------------------------------------
def march(field, ro, rd, lo, hi, k, eps, maxsteps, refine=8, min_step=None):
    """Sphere tracing that also copes with sign-changing (non-SDF) fields.

    Stepping uses |f|; a hit is registered either when |f| < eps or when the
    sign flips between two samples. Flip hits are polished by secant search so
    the surface stays razor sharp even for bounded implicit functions.
    """
    n = len(rd)
    tenter, texit, inb = _box_entry(ro, rd, lo, hi)
    t = np.where(inb, tenter, 0.0)
    tmax = np.where(inb, texit, 1e9)
    tmax = np.minimum(tmax, t + 4.0 * (hi - lo).max())

    hit = np.zeros(n, bool)
    tp = np.zeros(n)
    alive = np.nonzero(inb)[0]
    if min_step is None:
        min_step = eps * 0.5

    pprev_d = np.zeros(len(alive))
    tprev = t[alive].copy()

    for _ in range(maxsteps):
        if len(alive) == 0:
            break
        tt = t[alive]
        p = ro + rd[alive] * tt[:, None]
        d = field(p)
        ad = np.abs(d)

        close = ad < eps
        flip = (~close) & (np.signbit(d) != np.signbit(pprev_d)) & (pprev_d != 0)
        if close.any():
            hit[alive[close]] = True
            tp[alive[close]] = tt[close]
        if flip.any():
            gf = alive[flip]
            a = tprev[flip].copy()
            b = tt[flip].copy()
            sa = np.sign(pprev_d[flip])
            for _ in range(refine):
                m = 0.5 * (a + b)
                sm = np.sign(field(ro + rd[gf] * m[:, None]))
                same = sm == sa
                a = np.where(same, m, a)
                b = np.where(same, b, m)
            hit[gf] = True
            tp[gf] = 0.5 * (a + b)
        take = close | flip

        keep = ~take
        alive = alive[keep]
        tprev = tt[keep].copy()
        pprev_d = d[keep].copy()
        if len(alive):
            step = np.maximum(k * ad[keep], min_step)
            t[alive] = tt[keep] + step
            gone = t[alive] > tmax[alive]
            alive = alive[~gone]
            pprev_d = pprev_d[~gone]
            tprev = tprev[~gone]
    return hit, tp


def trace_surface(field, lo, hi, W=900, H=900, ss=2, azim=38, elev=20, fov=30.0,
                  k=None, maxsteps=320, light=1.0, tint="height", thin=0.55,
                  extra=None, sun=(1.0, 0.95, 0.86), glow=0.0, zoom=1.0,
                  contrast=1.0):
    lo = np.array(lo, float); hi = np.array(hi, float)
    ctr = 0.5 * (lo + hi)
    # fit to the bounding SPHERE of the box, not the box half-diagonal,
    # otherwise a cube-shaped domain always overflows the frame
    radius = 0.5 * float(np.linalg.norm(hi - lo))
    dist = radius / np.tan(np.radians(fov) * 0.5) * 1.06 * zoom

    is_grid = isinstance(field, GridField)
    if k is None:
        k = 0.92 if is_grid else 0.62
    vox = float(field.h.max()) if is_grid else None
    eps = (vox * 0.22) if vox else 1.1e-4 * 2 * radius
    eps = max(eps, 1e-6 * radius)

    Wf, Hf = W * ss, H * ss
    ro, rd = cam_rays(Wf, Hf, azim, elev, dist, ctr, fov)
    foot = 2.0 * radius / Hf
    hit, tp = march(field, ro, rd, lo, hi, k, eps, maxsteps,
                    min_step=min(foot * 0.30, eps * 0.5) if is_grid else foot * 0.22)

    img = background(Wf, Hf)
    if not hit.any():
        return _finish(img, W, H, ss, None)

    idx = np.nonzero(hit)[0]
    ph = ro + rd[idx] * tp[idx][:, None]
    n = gradient(field, ph, max(eps * 1.6, 1e-7))
    if extra is not None:
        n = _norm(extra(n, ph, rd[idx]))
    view = -rd[idx]

    L1 = _norm(np.array([-0.48, 0.66, 0.58]))
    L2 = _norm(np.array([0.72, -0.34, -0.42]))
    L3 = _norm(np.array([-0.20, 0.80, -0.72]))

    zlo, zhi = float(lo[2]), float(hi[2])
    tpar = np.clip((ph[:, 2] - zlo) / max(zhi - zlo, 1e-9), 0, 1)
    # blend in a normal-based term: shapes with little z extent (knots, bottles)
    # would otherwise be a single flat colour
    tnorm = 0.5 + 0.5 * n[:, 2]
    tw = np.clip(tpar * 0.45 + tnorm * 0.55, 0, 1)
    fres = np.clip(1.0 - np.sum(n * view, -1), 0, 1)
    base = PALETTE(0.04 + 0.92 * tw)[:, :3]
    irid = PALETTE((0.55 + 0.45 * tw + 0.35 * fres) % 1.0)[:, :3]
    base = np.clip(base * (1.0 - 0.45 * thin) + irid * (0.45 * thin * fres[..., None] + 0.12), 0, 1)

    off = ph + n * eps * 3.0
    sh = soft_shadow(field, off, L1, tmax=1.5 * radius, k=8.0)[:, None]
    ao = ambient_occlusion(field, off, n, scale=radius * 0.45)[:, None]

    # half-Lambert keeps the dark side readable instead of crushing to black
    d1 = (np.clip(n @ L1, 0, 1) * 0.72 + 0.28)[:, None]
    d2 = (np.clip(n @ L2, 0, 1) * 0.60 + 0.40)[:, None]
    d3 = (np.clip(n @ L3, 0, 1) * 0.70 + 0.30)[:, None]
    hv = _norm(L1[None, :] + view)
    ndh = np.clip(np.sum(n * hv, -1), 0, 1)
    spec = ndh[:, None] ** 60 * (0.35 + 0.65 * sh)
    rim = (fres ** 3.5)[:, None]
    sky = (0.5 + 0.5 * n[:, 1])[:, None]           # hemispheric ambient

    sun = np.asarray(sun)
    col = base * d1 * sh * sun * 0.72
    col += base * d2 * np.array([0.40, 0.58, 1.00]) * 0.40
    col += base * d3 * np.array([0.55, 0.85, 0.75]) * 0.26
    # hemispheric ambient: sky above, cool bounce below, plus a constant floor
    # so no surface ever falls to pure black
    col += base * sky * np.array([0.34, 0.46, 0.68]) * 0.55
    col += base * np.array([0.26, 0.32, 0.46]) * 0.30
    col += spec * np.array([1.0, 0.96, 0.88]) * 0.40
    col += rim * np.array([0.30, 0.60, 1.00]) * 0.30
    col *= (0.58 + 0.42 * ao)
    col *= light

    px = img.reshape(-1, 3)
    px[idx] = np.clip(col, 0, 1)
    out = px.reshape(Hf, Wf, 3)
    if glow > 0:
        out = out + glow * _inner_glow(field, ro, rd, lo, hi, hit, tp, radius).reshape(out.shape)
    out = np.clip(out * contrast, 0, 1)
    return _finish(out, W, H, ss, None)


def _inner_glow(field, ro, rd, lo, hi, hit, tp, radius, sigma=None, steps=64):
    """Faint volumetric haze hugging the surface -> gives thin sheets body.

    Falls off quickly with distance from the hit point so it never becomes a
    big halo that washes out the base colour.
    """
    n = len(rd)
    out = np.zeros((n, 3))
    sigma = sigma or radius * 0.055
    span = radius * 0.30
    tt = np.where(hit, tp, 0.0)
    for i in range(steps):
        s = (i + 0.5) / steps
        p = ro + rd * (tt + span * s)[:, None]
        d = np.abs(field(p))
        e = np.exp(-(d / sigma) ** 2) * 0.030
        col = PALETTE(np.clip((p[:, 2] - lo[2]) / max(hi[2] - lo[2], 1e-9), 0, 1))[:, :3]
        out += e[:, None] * col
    return out


def _finish(img, W, H, ss, idx):
    if ss > 1:
        img = img.reshape(H, ss, W, ss, 3).mean(axis=(1, 3))
    img = bloom(np.clip(img, 0, 1))
    # gentle filmic shoulder: keeps highlights from flattening to pure white
    x = np.clip(img, 0, None)
    img = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)
    return np.clip(img, 0, 1)


def trace_glow(field, lo, hi, W=900, H=900, ss=2, azim=38, elev=20, fov=30.0,
               sigma=0.055, dens=5.0, steps=190,
               colors=((0.35, 0.85, 1.0), (1.0, 0.55, 0.85)),
               gain=1.0):
    """Volumetric glow rendering: emission ~ exp(-(d/sigma)^2).

    `dens` is the extinction coefficient; the accumulated emission is scaled by
    `gain` so dense tubes do not saturate to white.
    """
    lo = np.array(lo, float); hi = np.array(hi, float)
    ctr = 0.5 * (lo + hi)
    radius = 0.5 * float(np.linalg.norm(hi - lo))
    dist = radius / np.tan(np.radians(fov) * 0.5) * 1.06

    Wf, Hf = W * ss, H * ss
    ro, rd = cam_rays(Wf, Hf, azim, elev, dist, ctr, fov)
    tenter, texit, inb = _box_entry(ro, rd, lo, hi)
    t0 = np.where(inb, tenter, 0.0)
    t1 = np.where(inb, texit, dist + radius)
    dt = np.maximum(t1 - t0, 1e-6) / steps
    acc = np.zeros((len(rd), 3))
    trans = np.ones(len(rd))
    tt = t0.copy()
    c0 = np.array(colors[0]); c1 = np.array(colors[1])
    for s in range(steps):
        p = ro + rd * tt[:, None]
        d = np.abs(field(p))
        core = np.exp(-(d / sigma) ** 2)
        halo = np.exp(-(d / (sigma * 2.6)) ** 2) * 0.10
        e = (core + halo) * dens * dt
        # fade out near the domain faces so the box never shows as a hard plane
        pad = 0.14 * (hi - lo)
        edge = np.minimum.reduce([(p[:, ax] - lo[ax]) / pad[ax] for ax in range(3)]
                                  + [(hi[ax] - p[:, ax]) / pad[ax] for ax in range(3)])
        e *= np.clip(edge, 0.0, 1.0)
        hue = np.clip(0.5 + 0.5 * (p[:, 2] - lo[2]) / max(hi[2] - lo[2], 1e-9) - 0.25, 0, 1)
        cc = c0[None, :] * (1 - hue[:, None]) + c1[None, :] * hue[:, None]
        a = np.clip(1.0 - np.exp(-e), 0, 1)
        acc += trans[:, None] * a[:, None] * cc
        trans *= (1.0 - a)
        tt = tt + dt
    out = background(Wf, Hf).reshape(-1, 3) + np.clip(acc, 0, 4.0) * gain
    return _finish(np.clip(out.reshape(Wf, Hf, 3), 0, 1), W, H, ss, None)


# --------------------------------------------------------------------------
# save
# --------------------------------------------------------------------------
def save(img, name, label=None, size=900):
    from PIL import Image
    a = (np.clip(img, 0, 1) * 255.0 + 0.5).astype(np.uint8)
    p = os.path.join(OUTDIR, name + ".png")
    Image.fromarray(a, "RGB").save(p, optimize=True)
    print("saved", p, flush=True)
    return p


def save_formula(latex, name, color="#e9f0ff", fs=22, pad=0.14):
    fig = plt.figure(figsize=(10, 1.6), dpi=110)
    fig.patch.set_alpha(0.0)
    try:
        fig.text(0.5, 0.5, latex, ha="center", va="center", color=color,
                 fontsize=fs, math_fontfamily="dejavusans")
    except Exception as exc:  # pragma: no cover
        print("formula fail", name, exc, flush=True)
        return None
    p = os.path.join(OUTDIR, name + "_eq.png")
    fig.savefig(p, dpi=110, transparent=True, bbox_inches="tight", pad_inches=pad)
    plt.close()
    print("eq", p, flush=True)
    return p
