# -*- coding: utf-8 -*-
"""
Curated gallery of "looks insanely impressive" 3D mathematical graphs.
Each entry: implicit analytic surface, parametric surface, fractal or attractor.
"""
import os
import sys
import time
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render3d import (AnalyticField, GridField, Abs, Union, sdf_from_points,
                      sdf_from_occupancy, trace_surface, trace_glow, save,
                      OUTDIR, _norm)

W = H = 860
SS = 2
T0 = time.time()


def log(*a):
    print("[%6.1fs]" % (time.time() - T0), *a, flush=True)


# ==========================================================================
#  helpers producing point clouds / grids
# ==========================================================================
def param_cloud(fn, nu, nv, u0, u1, v0, v1, wrap_u=True):
    u = np.linspace(u0, u1, nu, endpoint=not wrap_u)
    v = np.linspace(v0, v1, nv, endpoint=False)
    U, V = np.meshgrid(u, v, indexing="ij")
    P = fn(U, V)
    return P.reshape(-1, 3)


# ==========================================================================
#  1. Klein bottle
# ==========================================================================
def klein_bottle():
    a = 2.0
    def fn(U, V):
        cu, su, cv, sv = np.cos(U), np.sin(U), np.cos(V), np.sin(V)
        R = a + cu / 2 * sv - su / 2 * np.sin(2 * V)
        return np.stack([R * cu, R * su,
                         su / 2 * sv + cu / 2 * np.sin(2 * V)], -1)
    P = param_cloud(fn, 1400, 1400, 0, 2 * np.pi, 0, 2 * np.pi)
    f = sdf_from_points(P, pad=0.05, thick=1, res=340)
    # look slightly down the neck so the classic self-intersection reads
    return trace_surface(f, f.lo, f.hi, W, H, SS, azim=52, elev=10, k=0.95,
                         glow=0.10, thin=0.85, light=0.72)


# ==========================================================================
#  1b. Klein bottle -- classic "bottle" immersion
# ==========================================================================
def klein_bottle_classic():
    """The *other* Klein bottle: the "bottle" immersion, the one that really
    looks like a bottle whose neck curves over and passes back through the
    wall (the handle the figure-8 version does not have).

    klein_bottle above is the figure-8 immersion -- a twisted ring tube.  The
    two are the *same surface topologically* (either deforms into the other
    without cutting), they are just two different immersions in 3D, and people
    picture this one when they hear the name.  Both ship; the full comparison
    lives in references/klein-bottle-two-immersions.md.
    """
    def fn(U, V):
        cu, su = np.cos(U), np.sin(U)
        cv, sv = np.cos(V), np.sin(V)
        c2, c3 = cu ** 2, cu ** 3
        c4, c5 = cu ** 4, cu ** 5
        c6, c7 = cu ** 6, cu ** 7
        # Wikipedia "bottle" parametrisation.  No piecewise branch is needed:
        # the sin(u) prefactor of y flips sign on its own, and that is exactly
        # what produces the pass-through where the neck re-enters the body.
        x = -(2.0 / 15) * cu * (3 * cv - 30 * su + 90 * c4 * su
                                - 60 * c6 * su + 5 * cu * cv * su)
        y = -(1.0 / 15) * su * (3 * cv - 3 * c2 * cv - 48 * c4 * cv
                                + 48 * c6 * cv - 60 * su + 5 * cu * cv * su
                                - 5 * c3 * cv * su - 80 * c5 * cv * su
                                + 80 * c7 * cv * su)
        z = (2.0 / 15) * (3 + 5 * cu * su) * sv
        return np.stack([x, y, z], -1)

    # the object only spans ~4.4 units, so the surface sampling must stay
    # finer than the voxel (0.011 at res=340) or the tube breaks into dots
    P = param_cloud(fn, 1600, 1000, 0, 2 * np.pi, 0, 2 * np.pi)
    f = sdf_from_points(P, pad=0.05, thick=2, res=340)
    # three-quarter view: body, neck and pass-through all read at once
    return trace_surface(f, f.lo, f.hi, W, H, SS, azim=40, elev=20, k=0.95,
                         glow=0.10, thin=0.85, light=0.72)


# ==========================================================================
#  2. Möbius strip
# ==========================================================================
def mobius():
    R, w = 1.0, 0.34
    def fn(U, V):
        # U along the loop, V across the ribbon width
        cu, su = np.cos(U), np.sin(U)
        x = (R + V * np.cos(U / 2)) * cu
        y = (R + V * np.cos(U / 2)) * su
        z = V * np.sin(U / 2)
        return np.stack([x, y, z], -1)
    P = param_cloud(fn, 1400, 60, 0, 2 * np.pi, -w, w)
    f = sdf_from_points(P, pad=0.10, thick=1, res=300)
    # low elevation so the half-twist is visible edge-on
    return trace_surface(f, f.lo, f.hi, W, H, SS, azim=38, elev=11, k=0.95,
                         glow=0.10, thin=0.7)


# ==========================================================================
#  3. Gyroid (Schwarz P surface) - triply periodic minimal surface
# ==========================================================================
def gyroid():
    L = 1.05 * np.pi
    f = AnalyticField(lambda x, y, z: (np.cos(x) * np.cos(y)
                                       + np.cos(y) * np.cos(z)
                                       + np.cos(z) * np.cos(x)),
                      [-L] * 3, [L] * 3, grad_step=5e-4)
    return trace_surface(f, f.lo, f.hi, W, H, SS, azim=30, elev=18,
                         k=0.62, maxsteps=300, thin=0.7)


# ==========================================================================
#  4. Schwarz D - another triply periodic minimal surface
# ==========================================================================
def schwarz_d():
    L = 1.15 * np.pi
    f = AnalyticField(lambda x, y, z: (np.cos(x) * np.cos(y) * np.cos(z)
                                       * 2 - np.cos(x) ** 2 - np.cos(y) ** 2
                                       - np.cos(z) ** 2 + 1),
                      [-L] * 3, [L] * 3, grad_step=5e-4)
    return trace_surface(f, f.lo, f.hi, W, H, SS, azim=32, elev=20,
                         k=0.55, maxsteps=320, thin=0.7)


# ==========================================================================
#  5. Enneper surface - minimal surface
# ==========================================================================
def enneper():
    def fn(U, V):
        u, v = U, V
        x = u - u ** 3 / 3 + u * v * v
        y = v - v ** 3 / 3 + u * u * v
        z = u * u - v * v
        return np.stack([x, y, z], -1)
    P = param_cloud(fn, 900, 900, -2.6, 2.6, -2.6, 2.6, wrap_u=False)
    P = P[np.abs(P).max(1) < 3.0]
    f = sdf_from_points(P, pad=0.05, thick=1, res=290)
    return trace_surface(f, f.lo, f.hi, W, H, SS, azim=40, elev=22, k=0.95,
                         glow=0.20)


# ==========================================================================
#  6. Superformula (Gielis) - generalized star shape
# ==========================================================================
def superformula(m=6, n1=0.30, n2=9.0, n3=9.0, a=1.0, b=1.0):
    """3D superformula (Gielis) as an implicit surface.

    Written directly as f(x,y,z)=0 and sphere-traced, which avoids the voxel
    moire that a sampled point cloud would produce on the thin blades.
    """
    def sf(phi):
        t1 = np.abs(np.cos(m * phi / 4) / a) ** n2
        t2 = np.abs(np.sin(m * phi / 4) / b) ** n3
        return (t1 + t2) ** (-1.0 / n1)

    def f(x, y, z):
        r = np.sqrt(x * x + y * y + z * z) + 1e-9
        ct = np.clip(z / r, -1.0, 1.0)
        st = np.sqrt(np.clip(1 - ct * ct, 1e-12, None))
        phi = np.arctan2(y, x)
        # the 2D superformula governs the azimuth; keep the latitude profile
        # close to spherical so the six blades survive all the way to the poles
        ra = np.clip(sf(phi), 0.0, 2.2)
        lat = 0.45 + 0.55 * st
        target = np.clip(ra * lat, 0.0, 1.35)
        return r - target

    fld = AnalyticField(f, [-1.6] * 3, [1.6] * 3, grad_step=2e-4)
    return trace_surface(fld, fld.lo, fld.hi, W, H, SS, azim=26, elev=20,
                         k=0.22, maxsteps=420, thin=0.7)


# ==========================================================================
#  7. Rose bloom
# ==========================================================================
ROSE_PHI = 0.6180339887498949     # golden-ratio conjugate -- petal spacing


def _rose_wshape(s):
    """Half-width profile of one petal: narrow claw, broad rounded tip."""
    w = s ** 0.45 * (1.0 - s ** 6) ** 0.40
    return w / w.max()


def _rose_petal(phi0, r0, z0, Lp, Wp, b0, db, Rc2, curl, ruffle=0.008,
                ns=250, nu=88):
    """Point cloud of one cupped petal sheet.

    The mid-line leaves the base `b0` degrees off vertical and has turned to
    `b0+db` by the tip (the centre-line is integrated, so `Lp` is arc length).
    Each cross-section is bowed with radius `Rc2*(1 - curl*s**1.5)`: the cup
    tightens toward the tip, and that recurve is what makes the outer petals
    wrap round the bud instead of lying flat.
    """
    s = np.linspace(0.0, 1.0, ns)
    beta = np.radians(b0 + db * s ** 0.85)
    d = np.diff(s)
    arc_s = np.concatenate([[0.0], np.cumsum(
        0.5 * (np.sin(beta)[1:] + np.sin(beta)[:-1]) * d)])
    arc_c = np.concatenate([[0.0], np.cumsum(
        0.5 * (np.cos(beta)[1:] + np.cos(beta)[:-1]) * d)])
    r = r0 + Lp * arc_s
    z = z0 + Lp * arc_c

    u = np.linspace(-1.0, 1.0, nu)
    half = Wp * _rose_wshape(s)
    R2 = np.maximum(Rc2 * (1.0 - curl * s ** 1.5), half * 1.03)
    S, U = np.meshgrid(s, u, indexing="ij")
    uu = U * half[:, None]
    R2c = R2[:, None]
    dd = R2c - np.sqrt(np.maximum(R2c * R2c - uu * uu, 0.0))
    if ruffle:
        dd = dd + ruffle * np.sin(11.0 * U + 6.0 * np.pi * S) * S ** 2
    cb, sb = np.cos(beta)[:, None], np.sin(beta)[:, None]
    rr = r[:, None] - dd * cb          # cup toward the axis (-n_out)
    zz = z[:, None] + dd * sb
    cp, sp = np.cos(phi0), np.sin(phi0)
    return np.stack([rr * cp - uu * sp, rr * sp + uu * cp, zz],
                    -1).reshape(-1, 3)


def _rose_spheroid(center, radii, n, rng):
    v = rng.normal(size=(n, 3))
    v /= np.linalg.norm(v, axis=1, keepdims=True)
    return np.asarray(center) + v * np.asarray(radii)


def _rose_cloud(n=56, seed=7):
    """The bloom as one point cloud: `n` petals + the sealed centre.

    Each petal gets its own frame, so the whole flower is just a
    concatenation -- no single parametrisation has to describe it.
    """
    rng = np.random.default_rng(seed)
    jit = 0.04                                     # organic irregularity
    P = []
    for i in range(n):
        t = i / float(n - 1)                       # 0 = bud, 1 = outer rim
        phi = 2.0 * np.pi * ((i * ROSE_PHI + 25.0 / 360.0 * t) % 1.0)
        P.append(_rose_petal(
            phi + jit * rng.normal(),
            0.04 + 0.30 * t ** 1.40,                       # base radius
            0.46 - 0.34 * t ** 0.75,                       # base height
            (0.56 - 0.06 * t) * (1.0 + jit * 0.5 * rng.normal()),
            0.085 + 0.130 * t,                             # petal half-width
            3.0 + 76.0 * t ** 1.45 + jit * 26 * rng.normal(),
            5.0 + 26.0 * t,                                # tip-ward turn
            0.11 + 0.45 * t,                               # cross-section cup
            0.45 * (0.45 + 0.55 * t)))                     # extra tip curl
    P.append(_rose_spheroid((0.0, 0.0, 0.78), (0.09, 0.09, 0.32), 9000, rng))
    P.append(_rose_spheroid((0.0, 0.0, 0.10), (0.26, 0.26, 0.18), 14000, rng))
    return np.concatenate(P, 0)


def rose3d(n=56, seed=7):
    """A rose BLOOM -- a stack of spirally offset cupped petals.

    A rose cannot be a solid of revolution: revolving the planar rose
    r = cos(k*phi) about z gives petals that are radial WALLS running the whole
    height of the object, which reads as a windmill (the previous scene, and
    the reason its `k` petals were really 2k).  What makes a rose recognisable
    is instead its stacking: outer petals splay wide and low, middle petals
    stand up, the innermost curl into a rolled bud, and neighbouring petals sit
    at the golden angle so no two edges line up.

    So the bloom is a point cloud of `n` parametric petal sheets -- each in its
    own frame, then united by sdf_from_points -- plus a spindle and a dome that
    seal the centre (a hollow bud reads as a hole straight through the flower).
    Petals are ~0.03 thick, hence thick=2; at res=352 every wall is ~5 voxels.
    """
    f = sdf_from_points(_rose_cloud(n, seed), pad=0.06, thick=2, res=352)
    return trace_surface(f, f.lo, f.hi, W, H, SS, azim=30, elev=26,
                         k=0.95, glow=0.12, thin=0.75, light=0.85, zoom=0.85)


# ==========================================================================
#  8. Trefoil knot tube
# ==========================================================================
def trefoil():
    """Trefoil knot as a swept tube around the (p,q)=(2,3) torus-knot curve."""
    nu, nv = 1400, 40
    u = np.linspace(0, 2 * np.pi, nu, endpoint=False)
    v = np.linspace(0, 2 * np.pi, nv, endpoint=False)
    U, V = np.meshgrid(u, v, indexing="ij")

    r = 1.0 + 0.42 * np.cos(3 * U)
    cx = r * np.cos(2 * U)
    cy = r * np.sin(2 * U)
    cz = 0.55 * np.sin(3 * U)

    # analytic tangent of the torus knot
    dr = -1.26 * np.sin(3 * U)
    dx = dr * np.cos(2 * U) - 2 * r * np.sin(2 * U)
    dy = dr * np.sin(2 * U) + 2 * r * np.cos(2 * U)
    dz = 1.65 * np.cos(3 * U)
    T = _norm(np.stack([dx, dy, dz], -1))

    # parallel-transport-ish frame: use a fixed reference axis
    ref = np.array([0.0, 0.0, 1.0])
    N = _norm(np.cross(np.broadcast_to(ref, T.shape), T) + 1e-9)
    B = _norm(np.cross(T, N))
    rad = 0.17
    P = np.stack([cx + rad * (np.cos(V) * N[:, :, 0] + np.sin(V) * B[:, :, 0]),
                  cy + rad * (np.cos(V) * N[:, :, 1] + np.sin(V) * B[:, :, 1]),
                  cz + rad * (np.cos(V) * N[:, :, 2] + np.sin(V) * B[:, :, 2])],
                 -1).reshape(-1, 3)
    f = sdf_from_points(P, pad=0.07, thick=1, res=300)
    return trace_surface(f, f.lo, f.hi, W, H, SS, azim=35, elev=20, k=0.95,
                         glow=0.16, thin=0.7)


# ==========================================================================
#  9. Roman surface (Steiner)
# ==========================================================================
def roman():
    """Roman (Steiner) surface via its clean parametrisation, densely sampled.

    The parametric form is smooth everywhere, so a point-cloud SDF gives a
    clean 3-fold symmetric body (the algebraic implicit form needs a max()
    combination that shatters the sheet).
    """
    def fn(U, V):
        t, u = U, V
        x = np.sin(t) * np.cos(u) ** 2
        y = np.sin(t) * np.sin(u) * np.cos(u)
        z = np.cos(t) + 0.5 * (np.cos(2 * t) - 1) \
            + 0.5 * (np.cos(2 * t) - 2 * np.cos(u) ** 2)
        return np.stack([x, y, z], -1)

    P = param_cloud(fn, 1500, 1500, 0, np.pi, -np.pi / 2, np.pi / 2)
    P = P[np.abs(P).max(1) < 2.2]          # drop the far spikes only
    f = sdf_from_points(P, pad=0.05, thick=1, res=330)
    return trace_surface(f, f.lo, f.hi, W, H, SS, azim=38, elev=18, k=0.95,
                         glow=0.14, thin=0.7)


# ==========================================================================
#  10. Boy's surface - projective plane immersion
# ==========================================================================
def boys_surface():
    """Boy's surface: immersion of the real projective plane RP^2 in R^3.

    Standard parametrisation (Oudkerk / Wikipedia):
        x = cos(u/2)·cos(v) − sin(u/2)·sin(2v)
        y = cos(u/2)·sin(v) + sin(u/2)·cos(2v)
        z = 2·sin(u/2)
    Its hallmark is 3-fold rotational symmetry about the z axis.
    """
    def fn(U, V):
        u, v = U, V
        return np.stack([np.cos(u / 2) * np.cos(v) - np.sin(u / 2) * np.sin(2 * v),
                         np.cos(u / 2) * np.sin(v) + np.sin(u / 2) * np.cos(2 * v),
                         2.0 * np.sin(u / 2)], -1)
    P = param_cloud(fn, 1400, 1400, 0, 2 * np.pi, 0, 2 * np.pi)
    # the sheet passes through the origin; give the cloud a little thickness so
    # the distance transform yields a closed surface
    f = sdf_from_points(P, pad=0.05, thick=1, res=330)
    return trace_surface(f, f.lo, f.hi, W, H, SS, azim=30, elev=16, k=0.95,
                         glow=0.14, thin=0.7)


# ==========================================================================
#  11. Helicoid (with catenoid for scale)
# ==========================================================================
def helicoid():
    """Helicoid r = a*theta, sampled as a point cloud and turned into an SDF."""
    a = 0.62
    tmax = 2.55
    nu, nv = 1100, 46
    u = np.linspace(-tmax, tmax, nu)               # along the spiral
    v = np.linspace(-1.25, 1.25, nv)               # across the ribbon
    U, V = np.meshgrid(u, v, indexing="ij")
    cu, su = np.cos(U), np.sin(U)
    X = (a * U) * cu - V * su
    Y = (a * U) * su + V * cu
    Z = np.broadcast_to(U, U.shape) * 0.92
    P = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
    f = sdf_from_points(P, pad=0.06, thick=1, res=330)
    return trace_surface(f, f.lo, f.hi, W, H, SS, azim=34, elev=16, k=0.95,
                         glow=0.14, thin=0.7)


# ==========================================================================
#  12. Gabriel's horn - classic paradox object
# ==========================================================================
def gabriel_horn():
    # revolve y = 1/x  for x in (eps, 1.6]
    eps = 0.055
    nx, nt = 1500, 120
    xs = np.linspace(eps, 1.7, nx)
    th = np.linspace(0, 2 * np.pi, nt, endpoint=False)
    X, T = np.meshgrid(xs, th, indexing="ij")
    Y = (1.0 / X) * np.cos(T)
    Z = (1.0 / X) * np.sin(T)
    P = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
    f = sdf_from_points(P, pad=0.06, thick=1, res=300)
    return trace_surface(f, f.lo, f.hi, W, H, SS, azim=62, elev=14, k=0.95,
                         glow=0.18)


# ==========================================================================
#  13. Heart surface
# ==========================================================================
def heart():
    def f(x, y, z):
        return (x * x + y * y + z * z - 1) ** 3 - x * x * y * y * z * z
    fld = AnalyticField(f, [-1.35] * 3, [1.35] * 3, grad_step=4e-4)
    return trace_surface(fld, fld.lo, fld.hi, W, H, SS, azim=28, elev=16,
                         k=0.45, maxsteps=340, thin=0.5)


# ==========================================================================
#  14. Apollonian gasket (3D) - sphere inversion fractal
# ==========================================================================
def apollonian():
    """3D Apollonian gasket by repeated sphere inversion (Soddy spheres)."""
    res = 150
    g = np.linspace(-1.30, 1.30, res).astype(np.float32)
    X, Y, Z = np.meshgrid(g, g, g, indexing="ij")

    s = 0.55
    seeds = [(np.array([0., 0., s], np.float64), 0.72),
             (np.array([0., 0., -s], np.float64), 0.72),
             (np.array([s, 0., 0.], np.float64), 0.72),
             (np.array([-s, 0., 0.], np.float64), 0.72),
             (np.array([0., 0., 0.], np.float64), 0.40)]

    # signed distance to the union of all spheres, via sphere inversion
    sdf = None

    def add_sphere(cc, rr):
        nonlocal sdf
        d = np.sqrt((X - cc[0]) ** 2 + (Y - cc[1]) ** 2 + (Z - cc[2]) ** 2) - rr
        sdf = d if sdf is None else np.minimum(sdf, d)

    for c, r in seeds:
        add_sphere(c, r)

    m = 3.0
    for _ in range(11):
        for c, r in seeds:
            ci = c.copy()
            ri = r * m
            denom = float(ci @ ci - ri * ri)
            if abs(denom) < 1e-9:
                continue
            centre = (m * ci + ci) / denom
            radius = abs(m * ri / denom)
            if radius > 3.0 or radius < 1e-3:
                continue
            if np.abs(centre).max() > 2.2:
                continue
            add_sphere(centre, radius)
        m *= 1.36

    f = GridField(sdf.astype(np.float32), [g[0]] * 3, [g[-1]] * 3)
    return trace_surface(f, f.lo, f.hi, W, H, SS, azim=35, elev=18, k=0.9,
                         glow=0.18)


# ==========================================================================
#  15. Mandelbulb (power 8)
# ==========================================================================
def mandelbulb(power=8, iters=16):
    """Mandelbulb: z <- z^power + c in spherical coordinates.

    Analytic distance-estimator field -- same formula and same camera as
    gallery_gpu.mandelbulb, so the two engines stay comparable.

    The previous revision built the iterate as

        z = (X + 1j*Y) + 1j*Z          # == X + i*(Y+Z)

    collapsing the 3D coordinate onto the complex plane: the field depended on
    x and (y+z) only, so it was a 2D set extruded along (0,1,-1) and rendered
    as a smooth tube.  The spherical power map needs all three components.
    """
    POWER = float(power)
    IT = int(iters)

    def fn(x, y, z):
        zx, zy, zz = x, y, z
        dr = np.ones_like(zx)
        escaped = np.zeros(zx.shape, bool)
        r_esc = np.zeros(zx.shape)
        r = np.zeros(zx.shape)
        for _ in range(IT):
            r = np.sqrt(zx * zx + zy * zy + zz * zz)
            newly = (~escaped) & (r > 2.0)
            r_esc = np.where(newly, r, r_esc)
            escaped = escaped | newly
            rs = np.where(r > 1e-12, r, 1e-12)
            theta = np.arccos(np.clip(zz / rs, -1.0, 1.0)) * POWER
            phi = np.arctan2(zy, zx) * POWER
            dr = np.where(escaped, dr,
                          np.power(rs, POWER - 1.0) * POWER * dr + 1.0)
            zr = np.power(rs, POWER)
            st = np.sin(theta)
            ax = zr * st * np.cos(phi) + x
            ay = zr * st * np.sin(phi) + y
            az = zr * np.cos(theta) + z
            keep = ~escaped
            zx = np.where(keep, ax, 0.0)
            zy = np.where(keep, ay, 0.0)
            zz = np.where(keep, az, 0.0)
        r = np.where(escaped, r_esc, np.sqrt(zx * zx + zy * zy + zz * zz))
        r = np.maximum(r, 1e-12)
        de = np.abs(0.5 * np.log(r) * r / dr)
        return np.where(escaped, de, -de)

    f = AnalyticField(fn, [-1.45] * 3, [1.45] * 3)
    return trace_surface(f, f.lo, f.hi, W, H, SS, azim=35, elev=30, k=0.95,
                         maxsteps=420, light=0.62, thin=0.45, glow=0.12,
                         zoom=0.68, contrast=1.00)


# ==========================================================================
#  16. Menger sponge
# ==========================================================================
def menger():
    # One predicate per level, written in global coordinates: a point survives
    # level k only if at most ONE of its three base-3 digits equals 1.  That
    # covers the centre cell *and* the six face-centre cells of every cell that
    # survived level k-1, which is what makes the levels compose.
    #
    # The old form tested coordinate pairs separately with `|X| < step &
    # |Y| < step` and left the third axis unconstrained, so it carved a slab
    # running the whole length of that axis.  Levels 2..4 then landed entirely
    # inside the level-1 slab and `keep &=` deleted nothing: the sponge
    # silently degenerated to a single level (measured volume 0.7431 against
    # the 20/27 = 0.7407 that one level gives; four levels give 0.3011).
    #
    # Level 3, not 4: at 860 px a level-4 cell is ~10 px across and its cavities
    # blur into texture, so the sponge stops reading as a sponge.  res-1 = 189
    # = 3^3 * 7 exactly, so every level-3 cell spans 7 voxels with no aliasing.
    res, levels = 190, 3
    n = np.linspace(-1, 1, res)
    nx = n[:, None, None]
    ny = n[None, :, None]
    nz = n[None, None, :]
    keep = np.ones((res, res, res), bool)
    for k in range(1, levels + 1):
        q = 3 ** k
        dig = np.zeros((res, res, res), np.int8)
        for axis in (nx, ny, nz):
            # clip so the last sample (u = 1) falls in cell q-1 rather than q
            cell = np.minimum(np.floor((axis + 1.0) * 0.5 * q).astype(np.int64),
                              q - 1)
            dig += (cell % 3 == 1).astype(np.int8)
            del cell
        keep &= (dig <= 1)
        del dig
    del nx, ny, nz
    from scipy.ndimage import distance_transform_edt
    lo, hi = -1.0, 1.0
    ext = hi - lo
    # The sample spacing has to describe the mask that was actually built.  It
    # used to be taken from an unrelated nn = 300, which shrank every distance
    # by 1.58x and made the sphere tracer crawl.
    vox = ext / (res - 1)
    dout = distance_transform_edt(keep, sampling=vox)
    din = distance_transform_edt(~keep, sampling=vox)
    f = GridField((dout - din).astype(np.float32), [lo] * 3, [hi] * 3)
    return trace_surface(f, f.lo, f.hi, W, H, SS, azim=32, elev=20, k=0.92,
                         glow=0.20)


# ==========================================================================
#  17. Lorenz attractor
# ==========================================================================
def lorenz():
    s, r, b = 10.0, 28.0, 8 / 3
    dt = 0.0045
    n = 26000
    x = np.empty(n); y = np.empty(n); z = np.empty(n)
    x[0], y[0], z[0] = 0.1, 0.0, 0.0
    for i in range(1, n):
        xi, yi, zi = x[i - 1], y[i - 1], z[i - 1]
        x[i] = xi + dt * s * (yi - xi)
        y[i] = yi + dt * (xi * (r - zi) - yi)
        z[i] = zi + dt * (xi * yi - b * zi)
    P = np.stack([x, y, z - 25.0], 1)
    P = P - P.mean(0)                       # centre the attractor on origin
    P /= np.abs(P).max() * 1.06             # uniform scale, slight margin
    return _tube_from_points(P, rad=0.0075, res=380, gain=0.42, dens=30.0)


def _tube_from_points(P, rad=0.02, res=380, gain=1.0, wid=1.0, dens=5.0):
    """Render a 3D curve as a glowing volumetric filament.

    The filament radius must stay well above the grid voxel size, otherwise the
    occupancy saturates and the whole bounding box turns into a solid slab.
    """
    lo = P.min(0) - rad * 1.2
    hi = P.max(0) + rad * 1.2
    ext = hi - lo
    # NOTE: ext is a 3-vector here, so resolve the grid size to a scalar first
    nres = int(np.clip(round(res * float(ext.max()) / float(ext.max())), 64, 420))
    vox = float(ext.max()) / (nres - 1)
    rad = max(rad, 2.2 * vox)
    occ = np.zeros((nres, nres, nres), bool)
    idx = np.rint((P - lo) / vox).astype(np.int32)
    np.clip(idx, 0, nres - 1, out=idx)
    occ[idx[:, 0], idx[:, 1], idx[:, 2]] = True
    from scipy.ndimage import distance_transform_edt
    # Two-sided tube SDF. distance_transform_edt is unsigned, so compute the
    # outside distance and subtract an inside distance; without this the field
    # is negative everywhere and every ray "hits" the filament.
    dout = distance_transform_edt(occ, sampling=vox)     # >0 outside
    din = distance_transform_edt(~occ, sampling=vox)      # >0 inside
    d = (dout - np.maximum(din, vox)).astype(np.float32)
    del occ, dout, din
    f = GridField(d, lo, hi)
    return trace_glow(f, lo, hi, W, H, SS, azim=28, elev=16,
                      sigma=rad * wid, dens=dens, steps=170, gain=gain,
                      colors=((0.30, 0.80, 1.0), (1.0, 0.62, 0.30)))


# ==========================================================================
#  18. de Jong attractor
# ==========================================================================
def dejong():
    a, b, c, d = 1.4, -2.3, 2.4, -2.1
    n = 120000
    x = np.empty(n); y = np.empty(n)
    x[0], y[0] = 0.1, 0.1
    for i in range(1, n):
        x[i] = np.sin(a * y[i - 1]) - np.cos(b * x[i - 1])
        y[i] = np.sin(c * x[i - 1]) - np.cos(d * y[i - 1])
    P = np.stack([x, y, 0.16 * (x * np.cos(0.7 * y) + y * np.sin(0.7 * y))], 1)
    P = P - P.mean(0)                       # centre on the origin
    P /= np.abs(P).max() * 1.05
    return _tube_from_points(P, rad=0.0050, res=380, gain=0.40, dens=30.0)


# ==========================================================================
#  19. Clifford attractor
# ==========================================================================
def clifford():
    a, b, c, d = -1.4, 1.6, 1.0, 0.7
    n = 130000
    x = np.empty(n); y = np.empty(n); z = np.empty(n)
    x[0], y[0], z[0] = 1.0, 1.0, 1.0
    for i in range(1, n):
        x[i] = np.sin(a * y[i - 1]) + c * np.cos(a * x[i - 1])
        y[i] = np.sin(b * x[i - 1]) + d * np.cos(b * y[i - 1])
        z[i] = np.sin(c * x[i - 1]) + d * np.cos(c * z[i - 1])
    P = np.stack([x, y, z], 1)
    P = P - P.mean(0)                       # centre on the origin
    P /= np.abs(P).max() * 1.05
    return _tube_from_points(P, rad=0.0045, res=380, gain=0.40, dens=30.0)


# ==========================================================================
#  20. Spherical harmonics (quantum orbital shapes)
# ==========================================================================
def orbital(l, m):
    """Atomic-orbital isosurface for a real spherical harmonic.

    |Y_lm| = c intersected with a sphere. For d_z^2 (Y = 3cos^2(theta)-1)
    and c > 1 this yields exactly the two polar lobes people recognise from
    chemistry; f_z^3 gives the ringed multi-lobed variant.
    Occupancy grid -> exact SDF, so the raymarcher stays stable.
    """
    res = 240
    g = np.linspace(-1.15, 1.15, res).astype(np.float32)
    X, Yc, Z = np.meshgrid(g, g, g, indexing="ij")
    r = np.sqrt(X * X + Yc * Yc + Z * Z) + 1e-9
    ct = np.clip(Z / r, -1, 1)
    st = np.sqrt(np.clip(1 - ct * ct, 1e-12, None))
    phi = np.arctan2(Yc, X)

    if l == 2 and m == 0:
        Ylm = 3 * ct * ct - 1                 # d_z^2  in [-1, 2]
        c, R = 0.62, 0.90
    elif l == 3 and m == 0:
        Ylm = ct * (5 * ct * ct - 3)          # f_z^3  in [-2, 2]
        c, R = 0.95, 0.96
    elif l == 2 and m == 2:
        Ylm = 3 * st * st * np.cos(2 * phi)   # d_x2-y2
        c, R = 0.62, 0.90
    else:
        Ylm = 2 * ct
        c, R = 0.55, 0.90

    # |Y| > c keeps the two polar lobes; the r**2 envelope tapers each lobe
    # toward the nucleus so it reads as a smooth dumbbell rather than a cone
    rad = R * np.sqrt(np.clip((np.abs(Ylm) - c) / max(2.0 - c, 1e-6), 0, 1))
    keep = r < rad
    f = sdf_from_occupancy(keep, [g[0]] * 3, [g[-1]] * 3, thick=1, res=300)
    # the lobes lie along z, so look perpendicular to z (high elevation)
    # to see them as two separate bodies instead of one overlapping blob
    return trace_surface(f, f.lo, f.hi, W, H, SS, azim=24, elev=74, k=0.92,
                         glow=0.22, thin=0.6)


# ==========================================================================
#  driver
# ==========================================================================
SCENES = [
    ("klein_bottle", "Klein bottle", klein_bottle),
    ("mobius", "Mobius strip", mobius),
    ("gyroid", "Gyroid (Schwarz P)", gyroid),
    ("schwarz_d", "Schwarz D", schwarz_d),
    ("enneper", "Enneper surface", enneper),
    ("superformula", "Superformula", superformula),
    ("rose3d", "Rose bloom", rose3d),
    ("trefoil", "Trefoil knot", trefoil),
    ("roman", "Roman surface", roman),
    ("boys", "Boy's surface", boys_surface),
    ("helicoid", "Helicoid", helicoid),
    ("gabriel_horn", "Gabriel's horn", gabriel_horn),
    ("heart", "Heart surface", heart),
    ("apollonian", "Apollonian gasket", apollonian),
    ("mandelbulb", "Mandelbulb", mandelbulb),
    ("menger", "Menger sponge", menger),
    ("lorenz", "Lorenz attractor", lorenz),
    ("dejong", "de Jong attractor", dejong),
    ("clifford", "Clifford attractor", clifford),
    ("orbital_d", "d orbital", lambda: orbital(2, 0)),
    ("orbital_f", "f orbital", lambda: orbital(3, 0)),
    # #22 -- appended, never inserted: the 01..21 numbering is baked into the
    # fig filenames and index.html, so anything else would shift every image
    ("klein_bottle_classic", "Klein bottle (bottle form)",
     klein_bottle_classic),
]

if __name__ == "__main__":
    # usage:  python gallery.py                 -> render everything
    #         python gallery.py a b c            -> render only those scenes
    #         python gallery.py --half 0        -> render first half (parallel mode)
    #         python gallery.py --half 1        -> render second half
    args = sys.argv[1:]
    half = None
    if args and args[0] == "--half":
        half = int(args[1])
        args = []
    todo = SCENES
    if half is not None:
        mid = (len(SCENES) + 1) // 2
        todo = SCENES[:mid] if half == 0 else SCENES[mid:]
    elif args:
        todo = [s for s in SCENES if s[0] in args]

    for key, title, fn in todo:
        try:
            log("start", key)
            img = fn()
            save(img, key)
            log("done ", key)
        except Exception as exc:
            import traceback
            log("FAIL", key, repr(exc))
            traceback.print_exc()
    log("ALL FINISHED")
