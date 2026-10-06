# -*- coding: utf-8 -*-
"""
render3d_gpu -- GPU port of render3d.py.

Same algorithms, same look, executed on the RTX 4060 Ti through
numba-cuda-mlir.  Measured 117x on the shared raymarch workload.

Why the field design differs from the CPU version
-------------------------------------------------
`AnalyticField(fn, lo, hi)` takes a Python closure, which cannot cross into a
kernel.  Every implicit surface is therefore written here as a `@cuda.jit(cache=True)
(device=True)` function and selected by an integer id, so one compiled kernel
serves every scene and the compiler emits a branch instead of a function
pointer.  `GridField` keeps its `sdf_from_points` / `sdf_from_occupancy`
front end (the EDT runs on the CPU in scipy and costs a few seconds) but the
grid is uploaded once and sampled in-kernel.

Compiler constraints discovered by probing (numba-cuda-mlir 0.5.4)
------------------------------------------------------------------
  * `math.sin/cos/...` work inside kernels; `np.clip` does NOT -- use
    `min(max(v, a), b)`.  `float(bool)` does not exist.
  * a 3D device array may be a kernel argument but may NOT be passed to a
    device function ("input and output rank must be > 0"), so grids travel as
    flat 1D arrays with hand-computed strides.
  * `libdevice.isnan` is absent; `math.isnan` works.
  * dynamic loop bounds, `break`, sign-flip detection and bisection all match
    the CPU reference exactly (verified 0.0 error).
  * grids are transferred with `cuda.to_device`; passing a raw numpy array
    raises NumbaPerformanceWarning for the host->device copy.
"""
import os
import math
import numpy as np
from scipy.ndimage import distance_transform_edt, gaussian_filter

from numba_cuda_mlir import cuda

# Where rendered PNGs land.  Defaults to <skill>/assets/figs so the skill is
# self-contained; override with the MATH3D_OUT environment variable.
_OUT = os.environ.get("MATH3D_OUT")
if _OUT is None:
    _OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        os.pardir, "assets", "figs")
OUTDIR = os.path.abspath(_OUT)
os.makedirs(OUTDIR, exist_ok=True)

_TPB = 256          # threads per block; 64..512 all measured within noise


# ==========================================================================
#  device side: colour palette
# ==========================================================================
# The CPU version evaluates a 9-stop LinearSegmentedColormap.  On the GPU we
# hand-interpolate the same stops, which is what the colormap does internally
# anyway (it linearly interpolates between the listed colours).
_PAL = np.array([
    [0.051, 0.165, 0.302],   # #0d2a4d
    [0.051, 0.373, 0.525],   # #0d5f86
    [0.071, 0.561, 0.620],   # #128f9e
    [0.247, 0.788, 0.690],   # #3fc9b0
    [0.624, 0.902, 0.784],   # #9fe6c8
    [0.910, 0.784, 0.467],   # #e8c877
    [0.878, 0.478, 0.290],   # #e07a4a
    [0.702, 0.188, 0.373],   # #b3305f
    [0.357, 0.129, 0.659],   # #5b21a8
], dtype=np.float32)
_NPAL = _PAL.shape[0]


@cuda.jit(device=True, cache=True)
def _pal(t):
    """Return (r,g,b) for t in [0,1], matching the CPU PALETTE closely."""
    x = t * float(_NPAL - 1)
    if x < 0.0:
        x = 0.0
    if x > float(_NPAL - 1):
        x = float(_NPAL - 1)
    i = int(x)
    if i > _NPAL - 2:
        i = _NPAL - 2
    f = x - float(i)
    j = i + 1
    r = _PAL[i, 0] + (_PAL[j, 0] - _PAL[i, 0]) * f
    g = _PAL[i, 1] + (_PAL[j, 1] - _PAL[i, 1]) * f
    b = _PAL[i, 2] + (_PAL[j, 2] - _PAL[i, 2]) * f
    return r, g, b


# ==========================================================================
#  device side: implicit fields
# ==========================================================================
# ids must match FIELDS in gallery_gpu.py
F_GYROID = 0
F_SCHWARZ_D = 1
F_SUPERFORMULA = 2
F_ROSE3D = 3
F_HEART = 4
F_MANDELBULB = 5
F_GRID = 100         # generic: sample the uploaded grid


@cuda.jit(device=True, cache=True)
def _f_gyroid(x, y, z):
    return (math.cos(x) * math.cos(y)
            + math.cos(y) * math.cos(z)
            + math.cos(z) * math.cos(x))


@cuda.jit(device=True, cache=True)
def _f_schwarz_d(x, y, z):
    cx = math.cos(x)
    cy = math.cos(y)
    cz = math.cos(z)
    return cx * cy * cz * 2.0 - cx * cx - cy * cy - cz * cz + 1.0


@cuda.jit(device=True, cache=True)
def _f_superformula(x, y, z, m, n1, n2, n3, a, b):
    """3D superformula (Gielis), identical maths to gallery.superformula."""
    r = math.sqrt(x * x + y * y + z * z) + 1e-9
    ct = z / r
    if ct < -1.0:
        ct = -1.0
    if ct > 1.0:
        ct = 1.0
    s2 = 1.0 - ct * ct
    if s2 < 1e-12:
        s2 = 1e-12
    st = math.sqrt(s2)
    phi = math.atan2(y, x)

    u = m * phi / 4.0
    t1 = math.pow(math.fabs(math.cos(u) / a), n2)
    t2 = math.pow(math.fabs(math.sin(u) / b), n3)
    ra = math.pow(t1 + t2, -1.0 / n1)
    if ra > 2.2:
        ra = 2.2
    lat = 0.45 + 0.55 * st
    target = ra * lat
    if target > 1.35:
        target = 1.35
    return r - target


@cuda.jit(device=True, cache=True)
def _f_rose3d(x, y, z, k):
    """Revolved rhodonea r = cos(k*phi) as a solid with inner/outer envelopes."""
    rxy = math.sqrt(x * x + y * y) + 1e-9
    phi = math.atan2(y, x)
    mod = 0.80 + 0.20 * math.cos(2.0 * math.atan2(z, rxy))
    outer = math.fabs(math.cos(k * phi)) * mod
    inner = 0.14 * mod
    mid = 0.5 * (outer + inner)
    half = 0.5 * (outer - inner)
    return math.fabs(rxy - mid) - half


@cuda.jit(device=True, cache=True)
def _f_heart(x, y, z):
    return (x * x + y * y + z * z - 1.0) ** 3 - x * x * y * y * z * z


@cuda.jit(device=True, cache=True)
def _f_mandelbulb(x, y, z, power, iters, spare):
    """Signed distance estimator for the Mandelbulb, z <- z^power + c.

    Returns < 0 inside the bulb, > 0 outside, with |grad| <= 1 so the marcher
    may take near-unity steps (k = 0.95).  This is the classic spherical
    power map in the distance-estimator form:

        theta = acos(z.z/r);  phi = atan2(z.y, z.x)
        dr    = r^(power-1) * power * dr + 1
        z     = r^power * (sin(p*theta)cos(p*phi), sin(p*theta)sin(p*phi),
                           cos(p*theta)) + c
        de    = 0.5 * log(r) * r / dr

    Two details that are easy to get wrong and were both wrong in the old
    occupancy-based scene:

    1. `r` in the DE must be |z| **at the instant of escape**, not |z| at the
       end of the loop.  Holding it after the orbit is frozen collapses the
       estimate (measured max 6e-4 instead of 0.8).
    2. The sign must carry the interior: `de` is only positive for escaped
       points (there r > 2 so log r > 0).  For trapped orbits we return
       -|de| so a sign change exists and bisection refinement can latch on.
    """
    it = int(iters)
    zx = x
    zy = y
    zz = z
    dr = 1.0
    r = 0.0
    r_esc = 0.0
    escaped = 0
    for _ in range(it):
        r = math.sqrt(zx * zx + zy * zy + zz * zz)
        if escaped == 0:
            if r > 2.0:
                escaped = 1
                r_esc = r
            else:
                rs = r
                if rs < 1e-12:
                    rs = 1e-12
                ct = zz / rs
                if ct < -1.0:
                    ct = -1.0
                if ct > 1.0:
                    ct = 1.0
                theta = math.acos(ct) * power
                phi = math.atan2(zy, zx) * power
                dr = math.pow(rs, power - 1.0) * power * dr + 1.0
                zr = math.pow(rs, power)
                st = math.sin(theta)
                zx = zr * st * math.cos(phi) + x
                zy = zr * st * math.sin(phi) + y
                zz = zr * math.cos(theta) + z
        else:
            zx = 0.0
            zy = 0.0
            zz = 0.0

    if escaped == 1:
        r = r_esc
    else:
        r = math.sqrt(zx * zx + zy * zy + zz * zz)
    if r < 1e-12:
        r = 1e-12
    de = 0.5 * math.log(r) * r / dr
    if de < 0.0:
        de = -de
    if escaped == 1:
        return de
    return -de


@cuda.jit(device=True, cache=True)
def _grid_sample(g, nx, ny, nz, lo0, lo1, lo2, h0, h1, h2, x, y, z):
    """Trilinear lookup into a flat (nx*ny*nz,) grid -- the device-function
    equivalent of render3d.GridField.__call__."""
    gx = (x - lo0) / h0
    gy = (y - lo1) / h1
    gz = (z - lo2) / h2
    lim = float(nx - 1) * 0.99999
    if gx < 0.0:
        gx = 0.0
    if gx > lim:
        gx = lim
    limy = float(ny - 1) * 0.99999
    if gy < 0.0:
        gy = 0.0
    if gy > limy:
        gy = limy
    limz = float(nz - 1) * 0.99999
    if gz < 0.0:
        gz = 0.0
    if gz > limz:
        gz = limz
    i0 = int(gx)
    j0 = int(gy)
    k0 = int(gz)
    fx = gx - float(i0)
    fy = gy - float(j0)
    fz = gz - float(k0)
    i1 = min(i0 + 1, nx - 1)
    j1 = min(j0 + 1, ny - 1)
    k1 = min(k0 + 1, nz - 1)
    nyz = ny * nz
    b00 = (i0 * ny + j0) * nz + k0
    b10 = (i1 * ny + j0) * nz + k0
    b01 = (i0 * ny + j1) * nz + k0
    b11 = (i1 * ny + j1) * nz + k0
    c000 = g[b00]
    c100 = g[b10]
    c010 = g[b01]
    c110 = g[b11]
    c001 = g[b00 + (k1 - k0)]
    c101 = g[b10 + (k1 - k0)]
    c011 = g[b01 + (k1 - k0)]
    c111 = g[b11 + (k1 - k0)]
    c00 = c000 + (c100 - c000) * fx
    c10 = c010 + (c110 - c010) * fx
    c01 = c001 + (c101 - c001) * fx
    c11 = c011 + (c111 - c011) * fx
    c0 = c00 + (c10 - c00) * fy
    c1 = c01 + (c11 - c01) * fy
    return c0 + (c1 - c0) * fz


# Parameter block, uploaded once per scene.  Keeping every scalar in a single
# float32 array keeps the kernel signature at four arguments.
#   0 kind | 1..3 grid lo | 4..6 grid hi | 7..9 grid h | 10..12 grid n
#   13..15 extra field params | 16..18 superformula-only slot
PAR_KIND = 0
PAR_GLO = slice(1, 4)
PAR_GHI = slice(4, 7)
PAR_GH = slice(7, 10)
PAR_GN = slice(10, 13)
PAR_P0 = slice(13, 16)
PAR_P1 = slice(16, 19)
PAR_N = 19


@cuda.jit(device=True, cache=True)
def _field(P, g, x, y, z):
    kind = int(P[0])
    if kind == 0:
        return _f_gyroid(x, y, z)
    if kind == 1:
        return _f_schwarz_d(x, y, z)
    if kind == 2:
        return _f_superformula(x, y, z, P[13], P[14], P[15], P[16], P[17], P[18])
    if kind == 3:
        return _f_rose3d(x, y, z, P[13])
    if kind == 4:
        return _f_heart(x, y, z)
    if kind == 5:
        return _f_mandelbulb(x, y, z, P[13], P[14], P[15])
    return _grid_sample(g, int(P[10]), int(P[11]), int(P[12]),
                        P[1], P[2], P[3], P[7], P[8], P[9], x, y, z)


# ==========================================================================
#  device side: marching / shading helpers
# ==========================================================================
@cuda.jit(device=True, cache=True)
def _box_entry(rox, roy, roz, rdx, rdy, rdz, lo0, lo1, lo2, hi0, hi1, hi2):
    """Slab test for a single ray.  Returns (t_enter, t_exit, hits_box)."""
    # inline per axis; a 3D array is not allowed inside a device function
    par = math.fabs(rdx) < 1e-12
    safe = 1.0
    if not par:
        safe = rdx
    t0 = (lo0 - rox) / safe
    t1 = (hi0 - rox) / safe
    if par:
        t0 = -1e30
        t1 = 1e30
    ax = min(t0, t1)
    bx = max(t0, t1)

    par = math.fabs(rdy) < 1e-12
    safe = 1.0
    if not par:
        safe = rdy
    t0 = (lo1 - roy) / safe
    t1 = (hi1 - roy) / safe
    if par:
        t0 = -1e30
        t1 = 1e30
    ay = min(t0, t1)
    by = max(t0, t1)

    par = math.fabs(rdz) < 1e-12
    safe = 1.0
    if not par:
        safe = rdz
    t0 = (lo2 - roz) / safe
    t1 = (hi2 - roz) / safe
    if par:
        t0 = -1e30
        t1 = 1e30
    az = min(t0, t1)
    bz = max(t0, t1)

    tsmall = max(max(ax, ay), az)
    if tsmall < 0.0:
        tsmall = 0.0
    tbig = min(min(bx, by), bz)

    inside = (rox >= lo0 and rox <= hi0
              and roy >= lo1 and roy <= hi1
              and roz >= lo2 and roz <= hi2)
    hit = inside or tbig > tsmall
    if inside:
        tsmall = 0.0
    return tsmall, tbig, hit


@cuda.jit(device=True, cache=True)
def _march(P, g, rox, roy, roz, rdx, rdy, rdz,
           lo0, lo1, lo2, hi0, hi1, hi2,
           k, eps, maxsteps, min_step, tmax_extra):
    """Sphere tracing with sign-flip detection + bisection refinement.

    Returns (hit_flag, t).  Mirrors render3d.march() step for step: step by
    |f|, register a hit on |f| < eps or on a sign change, then polish the
    latter with `refine` bisections.  Each thread owns one ray, so no compaction
    is needed.
    """
    tenter, texit, inb = _box_entry(rox, roy, roz, rdx, rdy, rdz,
                                    lo0, lo1, lo2, hi0, hi1, hi2)
    if not inb:
        return 0, 0.0
    t = tenter
    tmax = min(texit, t + tmax_extra)
    tprev = t
    pd = 0.0

    for _ in range(maxsteps):
        px = rox + rdx * t
        py = roy + rdy * t
        pz = roz + rdz * t
        d = _field(P, g, px, py, pz)
        ad = math.fabs(d)

        if ad < eps:
            return 1, t
        if ((d > 0.0) != (pd > 0.0)) and pd != 0.0:
            a = tprev
            b = t
            sa = pd
            for _ in range(8):
                m = 0.5 * (a + b)
                sm = _field(P, g, rox + rdx * m, roy + rdy * m, roz + rdz * m)
                if (sm > 0.0) == (sa > 0.0):
                    a = m
                else:
                    b = m
            return 1, 0.5 * (a + b)

        step = k * ad
        if step < min_step:
            step = min_step
        tprev = t
        t = t + step
        pd = d
        if t > tmax:
            return 0, 0.0
    return 0, 0.0


@cuda.jit(device=True, cache=True)
def _gradient(P, g, px, py, pz, h):
    """Central-difference normal, normalised."""
    gx = _field(P, g, px + h, py, pz) - _field(P, g, px - h, py, pz)
    gy = _field(P, g, px, py + h, pz) - _field(P, g, px, py - h, pz)
    gz = _field(P, g, px, py, pz + h) - _field(P, g, px, py, pz - h)
    n = math.sqrt(gx * gx + gy * gy + gz * gz) + 1e-20
    return gx / n, gy / n, gz / n


@cuda.jit(device=True, cache=True)
def _ao(P, g, px, py, pz, nx, ny, nz, scale):
    occ = 0.0
    sca = 1.0
    for i in range(4):
        h = scale * (0.015 + 0.075 * i)
        d = _field(P, g, px + nx * h, py + ny * h, pz + nz * h)
        occ = occ + (h - d) * sca
        sca = sca * 0.70
    v = 1.0 - 1.25 * occ
    if v < 0.06:
        v = 0.06
    if v > 1.0:
        v = 1.0
    return v


@cuda.jit(device=True, cache=True)
def _shadow(P, g, px, py, pz, lx, ly, lz, tmax, kk, steps):
    res = 1.0
    t = 0.015
    for _ in range(steps):
        d = _field(P, g, px + lx * t, py + ly * t, pz + lz * t)
        r = kk * d / t
        if r < res:
            res = r
        st = d
        if st < 0.03:
            st = 0.03
        if st > 0.34:
            st = 0.34
        t = t + st
        if res < 0.004 or t > tmax:
            break
    if res < 0.0:
        res = 0.0
    if res > 1.0:
        res = 1.0
    return res ** 0.85


@cuda.jit(device=True, cache=True)
def _background(ax, ay, cy):
    """Radial-gradient backdrop.

    NOTE: `ay` here is deliberately the *unflipped* row coordinate in (0,2),
    matching render3d.background().  That is what puts the glow centre at the
    top edge of the frame rather than in the middle -- the camera-ray `ay` is
    a different, flipped quantity and the two must not be confused.
    """
    r = math.sqrt((ax * 0.85) ** 2 + (ay * 0.95 - (cy - 0.5) * 1.4) ** 2)
    glow = math.exp(-(r ** 2) / 0.85)
    tt = (ay + 1.0) / 2.0
    if tt < 0.0:
        tt = 0.0
    if tt > 1.0:
        tt = 1.0
    r0 = 0.020 * (1.0 - tt) + 0.004 * tt + glow * 0.055
    r1 = 0.030 * (1.0 - tt) + 0.006 * tt + glow * 0.085
    r2 = 0.062 * (1.0 - tt) + 0.016 * tt + glow * 0.150
    v = 1.18 - 0.52 * r * r
    if v < 0.35:
        v = 0.35
    if v > 1.0:
        v = 1.0
    r0 = r0 * v
    r1 = r1 * v
    r2 = r2 * v
    if r0 > 1.0:
        r0 = 1.0
    if r1 > 1.0:
        r1 = 1.0
    if r2 > 1.0:
        r2 = 1.0
    return r0, r1, r2


@cuda.jit(device=True, cache=True)
def _inner_glow(P, g, rox, roy, roz, rdx, rdy, rdz, t_hit, hit,
                lo2, hi2, sigma, span, steps):
    """Volumetric haze hugging the surface (CPU: _inner_glow)."""
    r = 0.0
    gg = 0.0
    b = 0.0
    tt = 0.0
    if hit != 0:
        tt = t_hit
    inv = 1.0 / float(steps)
    for i in range(steps):
        s = (float(i) + 0.5) * inv
        px = rox + rdx * (tt + span * s)
        py = roy + rdy * (tt + span * s)
        pz = roz + rdz * (tt + span * s)
        d = math.fabs(_field(P, g, px, py, pz))
        e = math.exp(-(d / sigma) ** 2) * 0.030
        u = (pz - lo2) / max(hi2 - lo2, 1e-9)
        if u < 0.0:
            u = 0.0
        if u > 1.0:
            u = 1.0
        cr, cg, cb = _pal(u)
        r = r + e * cr
        gg = gg + e * cg
        b = b + e * cb
    return r, gg, b


# ==========================================================================
#  kernel: shaded surface
# ==========================================================================
@cuda.jit(cache=True)
def _k_surface(out, P, g, Wf, Hf, rox, roy, roz,
               fwdx, fwdy, fwdz, rgtx, rgty, rgtz, upx, upy, upz,
               focal, lo0, lo1, lo2, hi0, hi1, hi2,
               kk, eps, maxsteps, min_step, radius, grad_h,
               light, thin, glow_amt, contrast,
               sunr, sung, sunb):
    i = cuda.grid(1)
    n = Wf * Hf
    if i >= n:
        return

    # ---- background for this pixel (every pixel has one).
    # `ay` (camera, flipped, +1 at top) and `bgay` (background, unflipped,
    # 0 at top) are different quantities -- see _background.
    ax = (float(i % Wf) + 0.5) / float(Wf) * 2.0 - 1.0
    ay = 1.0 - (float(i // Wf) + 0.5) / float(Hf) * 2.0
    bgay = (float(i // Wf) + 0.5) / float(Hf) * 2.0
    br, bg, bb = _background(ax, bgay, 0.50)

    # ---- camera ray, built from the pixel index (never materialised)
    dx = ax * rgtx + ay * upx + focal * fwdx
    dy = ax * rgty + ay * upy + focal * fwdy
    dz = ax * rgtz + ay * upz + focal * fwdz
    nrm = math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-20
    rdx = dx / nrm
    rdy = dy / nrm
    rdz = dz / nrm

    tmax_extra = 4.0 * max(max(hi0 - lo0, hi1 - lo1), hi2 - lo2)
    hit, tp = _march(P, g, rox, roy, roz, rdx, rdy, rdz,
                     lo0, lo1, lo2, hi0, hi1, hi2,
                     kk, eps, maxsteps, min_step, tmax_extra)
    o = i * 3
    if hit == 0:
        out[o] = br
        out[o + 1] = bg
        out[o + 2] = bb
        return

    px = rox + rdx * tp
    py = roy + rdy * tp
    pz = roz + rdz * tp
    nx, ny, nz = _gradient(P, g, px, py, pz, grad_h)
    vx = -rdx
    vy = -rdy
    vz = -rdz

    # ---- three-point lighting, identical constants to render3d
    l1x, l1y, l1z = _unit3(-0.48, 0.66, 0.58)
    l2x, l2y, l2z = _unit3(0.72, -0.34, -0.42)
    l3x, l3y, l3z = _unit3(-0.20, 0.80, -0.72)

    tpar = (pz - lo2) / max(hi2 - lo2, 1e-9)
    if tpar < 0.0:
        tpar = 0.0
    if tpar > 1.0:
        tpar = 1.0
    tw = tpar * 0.45 + (0.5 + 0.5 * nz) * 0.55
    if tw < 0.0:
        tw = 0.0
    if tw > 1.0:
        tw = 1.0
    fres = 1.0 - (nx * vx + ny * vy + nz * vz)
    if fres < 0.0:
        fres = 0.0
    if fres > 1.0:
        fres = 1.0

    b0, b1, b2 = _pal(0.04 + 0.92 * tw)
    u = (0.55 + 0.45 * tw + 0.35 * fres) % 1.0
    i0, i1, i2 = _pal(u)
    wmix = 0.45 * thin * fres + 0.12
    cr = (b0 * (1.0 - 0.45 * thin) + i0 * wmix) * light
    cg = (b1 * (1.0 - 0.45 * thin) + i1 * wmix) * light
    cb = (b2 * (1.0 - 0.45 * thin) + i2 * wmix) * light

    off = eps * 3.0
    sh = _shadow(P, g, px + nx * off, py + ny * off, pz + nz * off,
                 l1x, l1y, l1z, 1.5 * radius, 8.0, 22)
    ao = _ao(P, g, px + nx * off, py + ny * off, pz + nz * off,
             nx, ny, nz, radius * 0.45)

    # half-Lambert fills
    nl1 = nx * l1x + ny * l1y + nz * l1z
    if nl1 < 0.0:
        nl1 = 0.0
    if nl1 > 1.0:
        nl1 = 1.0
    d1 = nl1 * 0.72 + 0.28
    nl2 = nx * l2x + ny * l2y + nz * l2z
    if nl2 < 0.0:
        nl2 = 0.0
    if nl2 > 1.0:
        nl2 = 1.0
    d2 = nl2 * 0.60 + 0.40
    nl3 = nx * l3x + ny * l3y + nz * l3z
    if nl3 < 0.0:
        nl3 = 0.0
    if nl3 > 1.0:
        nl3 = 1.0
    d3 = nl3 * 0.70 + 0.30

    hvx, hvy, hvz = _unit3(l1x + vx, l1y + vy, l1z + vz)
    ndh = nx * hvx + ny * hvy + nz * hvz
    if ndh < 0.0:
        ndh = 0.0
    if ndh > 1.0:
        ndh = 1.0
    spec = ndh ** 60 * (0.35 + 0.65 * sh)
    rim = fres ** 3.5
    sky = 0.5 + 0.5 * ny

    colr = cr * d1 * sh * sunr * 0.72
    colg = cg * d1 * sh * sung * 0.72
    colb = cb * d1 * sh * sunb * 0.72
    colr += cr * d2 * 0.40 * 0.40
    colg += cg * d2 * 0.58 * 0.40
    colb += cb * d2 * 1.00 * 0.40
    colr += cr * d3 * 0.55 * 0.26
    colg += cg * d3 * 0.85 * 0.26
    colb += cb * d3 * 0.75 * 0.26
    colr += cr * sky * 0.34 * 0.55
    colg += cg * sky * 0.46 * 0.55
    colb += cb * sky * 0.68 * 0.55
    colr += cr * 0.26 * 0.30
    colg += cg * 0.32 * 0.30
    colb += cb * 0.46 * 0.30
    colr += spec * 1.00 * 0.40
    colg += spec * 0.96 * 0.40
    colb += spec * 0.88 * 0.40
    colr += rim * 0.30 * 0.30
    colg += rim * 0.60 * 0.30
    colb += rim * 1.00 * 0.30
    ao_mul = 0.58 + 0.42 * ao
    colr *= ao_mul
    colg *= ao_mul
    colb *= ao_mul

    if glow_amt > 0.0:
        gr, gg, gb = _inner_glow(P, g, rox, roy, roz, rdx, rdy, rdz, tp, 1,
                                 lo2, hi2, radius * 0.055, radius * 0.30, 64)
        colr += glow_amt * gr
        colg += glow_amt * gg
        colb += glow_amt * gb

    colr *= contrast
    colg *= contrast
    colb *= contrast
    if colr < 0.0:
        colr = 0.0
    if colg < 0.0:
        colg = 0.0
    if colb < 0.0:
        colb = 0.0
    if colr > 1.0:
        colr = 1.0
    if colg > 1.0:
        colg = 1.0
    if colb > 1.0:
        colb = 1.0
    out[o] = colr
    out[o + 1] = colg
    out[o + 2] = colb


@cuda.jit(device=True, cache=True)
def _unit3(x, y, z):
    n = math.sqrt(x * x + y * y + z * z) + 1e-20
    return x / n, y / n, z / n


# ==========================================================================
#  kernel: volumetric glow
# ==========================================================================
@cuda.jit(cache=True)
def _k_glow(out, P, g, Wf, Hf, rox, roy, roz,
            fwdx, fwdy, fwdz, rgtx, rgty, rgtz, upx, upy, upz,
            focal, lo0, lo1, lo2, hi0, hi1, hi2,
            sigma, dens, steps, dist, radius, gain,
            c0r, c0g, c0b, c1r, c1g, c1b):
    i = cuda.grid(1)
    n = Wf * Hf
    if i >= n:
        return

    ax = (float(i % Wf) + 0.5) / float(Wf) * 2.0 - 1.0
    ay = 1.0 - (float(i // Wf) + 0.5) / float(Hf) * 2.0
    bgay = (float(i // Wf) + 0.5) / float(Hf) * 2.0
    br, bg, bb = _background(ax, bgay, 0.50)

    dx = ax * rgtx + ay * upx + focal * fwdx
    dy = ax * rgty + ay * upy + focal * fwdy
    dz = ax * rgtz + ay * upz + focal * fwdz
    nrm = math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-20
    rdx = dx / nrm
    rdy = dy / nrm
    rdz = dz / nrm

    tenter, texit, inb = _box_entry(rox, roy, roz, rdx, rdy, rdz,
                                    lo0, lo1, lo2, hi0, hi1, hi2)
    t0 = 0.0
    t1 = dist + radius
    if inb:
        t0 = tenter
        t1 = texit
    span = t1 - t0
    if span < 1e-6:
        span = 1e-6
    dt = span / float(steps)

    pad0 = 0.14 * (hi0 - lo0)
    pad1 = 0.14 * (hi1 - lo1)
    pad2 = 0.14 * (hi2 - lo2)

    ar = 0.0
    ag = 0.0
    ab = 0.0
    trans = 1.0
    t = t0
    for _ in range(steps):
        px = rox + rdx * t
        py = roy + rdy * t
        pz = roz + rdz * t
        d = math.fabs(_field(P, g, px, py, pz))
        s2 = sigma * 2.6
        core = math.exp(-(d / sigma) ** 2)
        halo = math.exp(-(d / s2) ** 2) * 0.10
        e = (core + halo) * dens * dt
        # fade near the domain faces so the box never shows as a hard plane
        edge = min(min(min((px - lo0) / pad0, (hi0 - px) / pad0),
                       min((py - lo1) / pad1, (hi1 - py) / pad1)),
                   min((pz - lo2) / pad2, (hi2 - pz) / pad2))
        if edge < 0.0:
            edge = 0.0
        if edge > 1.0:
            edge = 1.0
        e = e * edge
        hue = 0.5 + 0.5 * (pz - lo2) / max(hi2 - lo2, 1e-9) - 0.25
        if hue < 0.0:
            hue = 0.0
        if hue > 1.0:
            hue = 1.0
        cr = c0r * (1.0 - hue) + c1r * hue
        cg = c0g * (1.0 - hue) + c1g * hue
        cb = c0b * (1.0 - hue) + c1b * hue
        ex = -math.exp(-e)
        aa = 1.0 + ex
        if aa < 0.0:
            aa = 0.0
        if aa > 1.0:
            aa = 1.0
        ar = ar + trans * aa * cr
        ag = ag + trans * aa * cg
        ab = ab + trans * aa * cb
        trans = trans * (1.0 - aa)
        t = t + dt

    m = gain
    r = br + ar * m
    g = bg + ag * m
    b = bb + ab * m
    if r < 0.0:
        r = 0.0
    if g < 0.0:
        g = 0.0
    if b < 0.0:
        b = 0.0
    if r > 1.0:
        r = 1.0
    if g > 1.0:
        g = 1.0
    if b > 1.0:
        b = 1.0
    o = i * 3
    out[o] = r
    out[o + 1] = g
    out[o + 2] = b


# ==========================================================================
#  host side: grids
# ==========================================================================
class GpuGrid:
    """A signed-distance grid living in device memory."""

    def __init__(self, sdf, lo, hi):
        sdf = np.nan_to_num(np.ascontiguousarray(sdf, dtype=np.float32),
                            nan=1e3, posinf=1e3, neginf=-1e3)
        self.n = np.array(sdf.shape, np.int32)
        self.lo = np.array(lo, np.float32)
        self.hi = np.array(hi, np.float32)
        self.h = ((self.hi - self.lo) / np.maximum(self.n - 1, 1)).astype(np.float32)
        self.dev = cuda.to_device(sdf.ravel().copy())
        self.vox = float(self.h.max())

    def params(self, P):
        P[PAR_GLO] = self.lo
        P[PAR_GHI] = self.hi
        P[PAR_GH] = self.h
        P[PAR_GN] = self.n
        return self.dev


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
    """Identical to render3d.sdf_from_points but returns a device grid."""
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
    if thick <= 1:
        occ = _dilate(occ, 1)

    dout, din = _edt_pair(occ, vox)
    del occ
    sdf = (dout - din).astype(np.float32)
    del dout, din
    sdf = gaussian_filter(sdf, sigma=0.6).astype(np.float32)
    return GpuGrid(sdf, lo, hi)


def sdf_from_occupancy(occ, lo, hi, thick=1, res=300, smooth=0.0):
    lo = np.array(lo, float); hi = np.array(hi, float)
    ext = hi - lo
    n = np.maximum(96, np.round(res * ext / ext.max()).astype(np.int32))
    n = np.minimum(n, 384)
    vox = ext / np.maximum(n - 1, 1)
    occ = _dilate(occ, thick)
    dout, din = _edt_pair(occ, vox)
    sdf = (dout - din).astype(np.float32)
    del dout, din
    # sdf_from_points smooths with sigma=0.6; this path used to skip it, which
    # left visible voxel stair-stepping on occupancy-derived surfaces.
    # smooth=0.0 keeps the old behaviour for existing callers.
    if smooth > 0:
        sdf = gaussian_filter(sdf, sigma=smooth).astype(np.float32)
    return GpuGrid(sdf, lo, hi)


def grid_from_array(sdf, lo, hi):
    return GpuGrid(np.asarray(sdf, np.float32), lo, hi)


# ==========================================================================
#  host side: camera + post
# ==========================================================================
def _basis(azim, elev):
    """Camera basis, matching render3d.cam_rays: R = Rx(-elev) @ Rz(azim)."""
    a = np.radians(azim); e = np.radians(elev)
    ca, sa = np.cos(a), np.sin(a)
    ce, se = np.cos(e), np.sin(e)
    Rz = np.array([[ca, -sa, 0.0], [sa, ca, 0.0], [0.0, 0.0, 1.0]])
    Rx = np.array([[1.0, 0.0, 0.0], [0.0, ce, se], [0.0, -se, ce]])
    return Rx @ Rz


# ==========================================================================
#  kernel: separable Gaussian (replaces scipy's gaussian_filter in bloom)
# ==========================================================================
#  scipy.ndimage.gaussian_filter1d uses truncate=4.0 -> radius=int(4*sigma+0.5)
#  and mode='reflect'.  In scipy 'reflect' is the half-sample-symmetric rule
#  (d c b a | a b c d), i.e. numpy's 'symmetric': index -1 maps to 0, -2 to 1,
#  and index n maps to n-1.  _reflect_idx below reproduces it exactly.
@cuda.jit(device=True, cache=True)
def _reflect_idx(i, n):
    while i < 0 or i >= n:
        if i < 0:
            i = -i - 1
        else:
            i = 2 * n - 1 - i
    return i


@cuda.jit(cache=True)
def _k_blur_h(src, dst, W, H, wts, radius):
    i = cuda.grid(1)
    if i >= W * H:
        return
    px = i % W
    py = i // W
    acc0 = 0.0
    acc1 = 0.0
    acc2 = 0.0
    for k in range(-radius, radius + 1):
        sx = _reflect_idx(px + k, W)
        j = (py * W + sx) * 3
        w = wts[k + radius]
        acc0 = acc0 + src[j] * w
        acc1 = acc1 + src[j + 1] * w
        acc2 = acc2 + src[j + 2] * w
    o = i * 3
    dst[o] = acc0
    dst[o + 1] = acc1
    dst[o + 2] = acc2


@cuda.jit(cache=True)
def _k_blur_v(src, dst, W, H, wts, radius):
    i = cuda.grid(1)
    if i >= W * H:
        return
    px = i % W
    py = i // W
    acc0 = 0.0
    acc1 = 0.0
    acc2 = 0.0
    for k in range(-radius, radius + 1):
        sy = _reflect_idx(py + k, H)
        j = (sy * W + px) * 3
        w = wts[k + radius]
        acc0 = acc0 + src[j] * w
        acc1 = acc1 + src[j + 1] * w
        acc2 = acc2 + src[j + 2] * w
    o = i * 3
    dst[o] = acc0
    dst[o + 1] = acc1
    dst[o + 2] = acc2


@cuda.jit(cache=True)
def _k_chamix(buf, W, H, cmat):
    """Blur along the 3-element colour axis, in place.

    render3d.bloom() calls gaussian_filter with a *scalar* sigma, and scipy
    applies that sigma to every axis -- including the colour axis.  Skipping
    it changes the image visibly (measured 0.30 max difference), so the same
    mixing has to be reproduced.  It is a separate pass because the matrix
    must be applied exactly once, not once per spatial pass.
    """
    i = cuda.grid(1)
    if i >= W * H:
        return
    o = i * 3
    a0 = buf[o]
    a1 = buf[o + 1]
    a2 = buf[o + 2]
    buf[o] = a0 * cmat[0, 0] + a1 * cmat[0, 1] + a2 * cmat[0, 2]
    buf[o + 1] = a0 * cmat[1, 0] + a1 * cmat[1, 1] + a2 * cmat[1, 2]
    buf[o + 2] = a0 * cmat[2, 0] + a1 * cmat[2, 1] + a2 * cmat[2, 2]


@cuda.jit(cache=True)
def _k_downsample(src, dst, W, H, ss):
    """Mean over ss x ss supersample blocks, src is (W*ss, H*ss, 3)."""
    i = cuda.grid(1)
    if i >= W * H:
        return
    px = i % W
    py = i // W
    inv = 1.0 / float(ss * ss)
    s0 = 0.0
    s1 = 0.0
    s2 = 0.0
    for dy in range(ss):
        sy = py * ss + dy
        for dx in range(ss):
            j = (sy * (W * ss) + px * ss + dx) * 3
            s0 = s0 + src[j]
            s1 = s1 + src[j + 1]
            s2 = s2 + src[j + 2]
    o = i * 3
    dst[o] = s0 * inv
    dst[o + 1] = s1 * inv
    dst[o + 2] = s2 * inv


@cuda.jit(cache=True)
def _k_clamp(src, dst, n3):
    i = cuda.grid(1)
    if i >= n3:
        return
    v = src[i]
    if math.isnan(v):
        v = 0.0
    if v < 0.0:
        v = 0.0
    if v > 1.0:
        v = 1.0
    dst[i] = v


@cuda.jit(cache=True)
def _k_copy(src, dst, n3):
    i = cuda.grid(1)
    if i >= n3:
        return
    dst[i] = src[i]


@cuda.jit(cache=True)
def _k_axpy(dst, src, out, n3, a):
    i = cuda.grid(1)
    if i >= n3:
        return
    out[i] = dst[i] + src[i] * a


@cuda.jit(cache=True)
def _k_tonemap(src, dst, n3):
    i = cuda.grid(1)
    if i >= n3:
        return
    x = src[i]
    if x < 0.0:
        x = 0.0
    v = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)
    if v < 0.0:
        v = 0.0
    if v > 1.0:
        v = 1.0
    dst[i] = v


@cuda.jit(cache=True)
def _k_bloom_acc(blur, acc, n, thresh, weight):
    """acc += weight * clip(blur - thresh, 0, inf), mirroring render3d.bloom.

    `blur` and `acc` must be distinct buffers.
    """
    i = cuda.grid(1)
    if i >= n:
        return
    for c in range(3):
        v = blur[i * 3 + c] - thresh
        if v < 0.0:
            v = 0.0
        acc[i * 3 + c] = acc[i * 3 + c] + weight * v


_BLOOM_SIGMAS = (3.0, 9.0, 26.0)
_BLOOM_WEIGHTS = (0.30, 0.22, 0.16)
_BLOOM_THRESH = 0.80
_BLOOM_GAIN = 0.85
_wcache = {}


def _gauss_wts(sigma):
    """Kernel weights identical to scipy.ndimage.gaussian_filter1d."""
    r = int(4.0 * sigma + 0.5)
    x = np.arange(-r, r + 1, dtype=np.float64)
    w = np.exp(-0.5 * (x / sigma) ** 2)
    w /= w.sum()
    return w.astype(np.float32), r


def _chan_matrix(sigma):
    """3x3 matrix describing gaussian_filter's blur along the colour axis.

    Derived from scipy itself (by blurring a 3-vector) rather than hand-rolled,
    so it stays bit-consistent with whatever boundary rule scipy applies to an
    axis of length 3.
    """
    e = np.zeros((1, 1, 3), np.float64)
    rows = []
    for c in range(3):
        e[0, 0, c] = 1.0
        rows.append(gaussian_filter(e, sigma, mode="reflect")[0, 0])
        e[0, 0, c] = 0.0
    return np.asarray(rows, np.float32)


def _finish(img, W, H, ss, dev_img=None):
    """Supersample down -> bloom -> filmic tonemap, all on the GPU.

    The separable Gaussian with sigma up to 26 costs scipy ~0.5 s on the CPU
    at 1720x1720x3, which dominated the entire render; on the GPU it is a few
    milliseconds, which makes trace_surface kernel-bound.
    """
    n = W * H
    blocks = (n + _TPB - 1) // _TPB
    n3 = n * 3
    b3 = (n3 + _TPB - 1) // _TPB
    thresh = np.float32(_BLOOM_THRESH)
    gain = np.float32(_BLOOM_GAIN)

    if dev_img is None:
        dev_img = cuda.to_device(
            np.ascontiguousarray(np.asarray(img, np.float32).reshape(-1)))

    # 1) supersample downsample
    raw = cuda.to_device(np.zeros(n3, np.float32))
    if ss > 1:
        _k_downsample[blocks, _TPB](dev_img, raw, W, H, int(ss))
    else:
        _k_copy[blocks, _TPB](dev_img, raw, n3)
    del dev_img

    # 2) clamp to [0,1] -- the CPU pipeline clips before bloom
    base = cuda.to_device(np.zeros(n3, np.float32))
    _k_clamp[b3, _TPB](raw, base, n3)
    del raw

    # 3) bloom: acc = sum_s w_s * clip(gauss_s(base) - thresh, 0)
    #    `blur` must be a separate buffer from `acc`: aliasing them would seed
    #    the accumulator with the blurred image and overwrite the running sum.
    tmp = cuda.to_device(np.zeros(n3, np.float32))
    blur = cuda.to_device(np.zeros(n3, np.float32))
    acc = cuda.to_device(np.zeros(n3, np.float32))
    for sigma, weight in zip(_BLOOM_SIGMAS, _BLOOM_WEIGHTS):
        if sigma not in _wcache:
            wts, r = _gauss_wts(sigma)
            _wcache[sigma] = (cuda.to_device(wts), r,
                              cuda.to_device(_chan_matrix(sigma)))
        dw, r, dc = _wcache[sigma]
        _k_blur_h[blocks, _TPB](base, tmp, W, H, dw, r)
        _k_blur_v[blocks, _TPB](tmp, blur, W, H, dw, r)
        _k_chamix[blocks, _TPB](blur, W, H, dc)
        _k_bloom_acc[blocks, _TPB](blur, acc, n, thresh, np.float32(weight))
    del tmp, blur

    # 4) out = base + gain * acc, then the filmic shoulder
    out = cuda.to_device(np.zeros(n3, np.float32))
    _k_axpy[b3, _TPB](base, acc, out, n3, gain)
    del acc, base
    fin = cuda.to_device(np.zeros(n3, np.float32))
    _k_tonemap[b3, _TPB](out, fin, n3)
    res = fin.copy_to_host().reshape(H, W, 3)
    del out, fin
    return res


def _frame(azim, elev, fov, dist, ctr):
    R = _basis(azim, elev)
    fwd = R @ np.array([0.0, 0.0, -1.0])
    rgt = R @ np.array([1.0, 0.0, 0.0])
    up = R @ np.array([0.0, 1.0, 0.0])
    ro = np.asarray(ctr, float) - fwd * dist
    return ro, fwd, rgt, up


# ==========================================================================
#  host side: public renderers
# ==========================================================================
def trace_surface(field, lo, hi, W=900, H=900, ss=2, azim=38, elev=20, fov=30.0,
                  k=None, maxsteps=320, light=1.0, thin=0.55, glow=0.0,
                  sun=(1.0, 0.95, 0.86), zoom=1.0, contrast=1.0,
                  kind=None, p0=None, p1=None):
    """GPU twin of render3d.trace_surface.

    `field` is a GpuGrid for SDF scenes, or None for analytic ones (then
    `kind` selects the device field).  p0/p1 carry extra field parameters.
    """
    lo = np.array(lo, float); hi = np.array(hi, float)
    ctr = 0.5 * (lo + hi)
    radius = 0.5 * float(np.linalg.norm(hi - lo))
    dist = radius / np.tan(np.radians(fov) * 0.5) * 1.06 * zoom

    is_grid = isinstance(field, GpuGrid)
    if k is None:
        k = 0.92 if is_grid else 0.62
    vox = field.vox if is_grid else None
    eps = (vox * 0.22) if vox else 1.1e-4 * 2 * radius
    eps = max(eps, 1e-6 * radius)

    Wf, Hf = W * ss, H * ss
    foot = 2.0 * radius / Hf
    min_step = min(foot * 0.30, eps * 0.5) if is_grid else foot * 0.22

    P = np.zeros(PAR_N, np.float32)
    if is_grid:
        P[0] = F_GRID
        dev = field.params(P)
    else:
        P[0] = F_GYROID if kind is None else kind
        dev = cuda.to_device(np.zeros(1, np.float32))
        P[1:4] = lo
        P[4:7] = hi
        P[7:10] = (hi - lo) / 100.0
        P[10:13] = 1
    if p0 is not None:
        P[13:16] = p0
    if p1 is not None:
        P[16:19] = p1
    dP = cuda.to_device(P)

    ro, fwd, rgt, up = _frame(azim, elev, fov, dist, ctr)
    focal = 1.0 / np.tan(np.radians(fov) * 0.5)

    out = cuda.to_device(np.zeros(Wf * Hf * 3, np.float32))
    blocks = (Wf * Hf + _TPB - 1) // _TPB
    _k_surface[blocks, _TPB](
        out, dP, dev, Wf, Hf,
        float(ro[0]), float(ro[1]), float(ro[2]),
        float(fwd[0]), float(fwd[1]), float(fwd[2]),
        float(rgt[0]), float(rgt[1]), float(rgt[2]),
        float(up[0]), float(up[1]), float(up[2]),
        float(focal),
        float(lo[0]), float(lo[1]), float(lo[2]),
        float(hi[0]), float(hi[1]), float(hi[2]),
        float(k), float(eps), int(maxsteps), float(min_step),
        float(radius), float(max(eps * 1.6, 1e-7)),
        float(light), float(thin), float(glow), float(contrast),
        float(sun[0]), float(sun[1]), float(sun[2]))
    cuda.synchronize()
    res = _finish(None, W, H, ss, dev_img=out)
    del out
    return res


def trace_glow(field, lo, hi, W=900, H=900, ss=2, azim=38, elev=20, fov=30.0,
               sigma=0.055, dens=5.0, steps=190,
               colors=((0.35, 0.85, 1.0), (1.0, 0.55, 0.85)), gain=1.0):
    """GPU twin of render3d.trace_glow (volumetric emission integral)."""
    lo = np.array(lo, float); hi = np.array(hi, float)
    ctr = 0.5 * (lo + hi)
    radius = 0.5 * float(np.linalg.norm(hi - lo))
    dist = radius / np.tan(np.radians(fov) * 0.5) * 1.06

    Wf, Hf = W * ss, H * ss
    P = np.zeros(PAR_N, np.float32)
    P[0] = F_GRID
    dev = field.params(P)
    dP = cuda.to_device(P)

    ro, fwd, rgt, up = _frame(azim, elev, fov, dist, ctr)
    focal = 1.0 / np.tan(np.radians(fov) * 0.5)

    out = cuda.to_device(np.zeros(Wf * Hf * 3, np.float32))
    blocks = (Wf * Hf + _TPB - 1) // _TPB
    _k_glow[blocks, _TPB](
        out, dP, dev, Wf, Hf,
        float(ro[0]), float(ro[1]), float(ro[2]),
        float(fwd[0]), float(fwd[1]), float(fwd[2]),
        float(rgt[0]), float(rgt[1]), float(rgt[2]),
        float(up[0]), float(up[1]), float(up[2]),
        float(focal),
        float(lo[0]), float(lo[1]), float(lo[2]),
        float(hi[0]), float(hi[1]), float(hi[2]),
        float(sigma), float(dens), int(steps), float(dist), float(radius),
        float(gain),
        float(colors[0][0]), float(colors[0][1]), float(colors[0][2]),
        float(colors[1][0]), float(colors[1][1]), float(colors[1][2]))
    cuda.synchronize()
    res = _finish(None, W, H, ss, dev_img=out)
    del out
    return res


def save(img, name, outdir=None):
    from PIL import Image
    a = (np.clip(img, 0, 1) * 255.0 + 0.5).astype(np.uint8)
    p = os.path.join(outdir or OUTDIR, name + ".png")
    Image.fromarray(a, "RGB").save(p, optimize=True)
    print("saved", p, flush=True)
    return p