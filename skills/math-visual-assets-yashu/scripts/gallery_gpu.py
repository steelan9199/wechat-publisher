# -*- coding: utf-8 -*-
"""
gallery_gpu -- the 21 gallery scenes, rendered through render3d_gpu.

Scene definitions (parametrisations, SDF construction, camera angles) are
copied verbatim from gallery.py so the images are identical; only the renderer
behind trace_surface / trace_glow differs.

Run with the py312-gpu interpreter (numba-cuda-mlir lives only there):
    D:\\software\\uv\\envs\\py312-gpu\\Scripts\\python.exe gallery_gpu.py [keys...]
"""
import os
import sys
import time
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render3d_gpu as R
from render3d_gpu import (GpuGrid, sdf_from_points, sdf_from_occupancy,
                          grid_from_array, trace_surface, trace_glow, save,
                          OUTDIR, F_GYROID, F_SCHWARZ_D, F_SUPERFORMULA,
                          F_ROSE3D, F_HEART, F_MANDELBULB)

W = H = 860
SS = 2
T0 = time.time()


def log(*a):
    print("[%6.1fs]" % (time.time() - T0), *a, flush=True)


def _norm(v):
    return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-20)


def param_cloud(fn, nu, nv, u0, u1, v0, v1, wrap_u=True):
    u = np.linspace(u0, u1, nu, endpoint=not wrap_u)
    v = np.linspace(v0, v1, nv, endpoint=False)
    U, V = np.meshgrid(u, v, indexing="ij")
    return fn(U, V).reshape(-1, 3)


# ==========================================================================
#  1. Klein bottle
# ==========================================================================
def klein_bottle():
    a = 2.0

    def fn(U, V):
        cu, su, cv, sv = np.cos(U), np.sin(U), np.cos(V), np.sin(V)
        Rr = a + cu / 2 * sv - su / 2 * np.sin(2 * V)
        return np.stack([Rr * cu, Rr * su,
                         su / 2 * sv + cu / 2 * np.sin(2 * V)], -1)

    P = param_cloud(fn, 1400, 1400, 0, 2 * np.pi, 0, 2 * np.pi)
    f = sdf_from_points(P, pad=0.05, thick=1, res=340)
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
#  2. Mobius strip
# ==========================================================================
def mobius():
    Rr, w = 1.0, 0.34

    def fn(U, V):
        cu, su = np.cos(U), np.sin(U)
        return np.stack([(Rr + V * np.cos(U / 2)) * cu,
                         (Rr + V * np.cos(U / 2)) * su,
                         V * np.sin(U / 2)], -1)

    P = param_cloud(fn, 1400, 60, 0, 2 * np.pi, -w, w)
    f = sdf_from_points(P, pad=0.10, thick=1, res=300)
    return trace_surface(f, f.lo, f.hi, W, H, SS, azim=38, elev=11, k=0.95,
                         glow=0.10, thin=0.7)


# ==========================================================================
#  3. Gyroid (Schwarz P)
# ==========================================================================
def gyroid():
    L = 1.05 * np.pi
    return trace_surface(None, [-L] * 3, [L] * 3, W, H, SS, azim=30, elev=18,
                         k=0.62, maxsteps=300, thin=0.7, kind=F_GYROID)


# ==========================================================================
#  4. Schwarz D
# ==========================================================================
def schwarz_d():
    L = 1.15 * np.pi
    return trace_surface(None, [-L] * 3, [L] * 3, W, H, SS, azim=32, elev=20,
                         k=0.55, maxsteps=320, thin=0.7, kind=F_SCHWARZ_D)


# ==========================================================================
#  5. Enneper surface
# ==========================================================================
def enneper():
    def fn(U, V):
        u, v = U, V
        return np.stack([u - u ** 3 / 3 + u * v * v,
                         v - v ** 3 / 3 + u * u * v,
                         u * u - v * v], -1)

    P = param_cloud(fn, 900, 900, -2.6, 2.6, -2.6, 2.6, wrap_u=False)
    P = P[np.abs(P).max(1) < 3.0]
    f = sdf_from_points(P, pad=0.05, thick=1, res=290)
    return trace_surface(f, f.lo, f.hi, W, H, SS, azim=40, elev=22, k=0.95,
                         glow=0.20)


# ==========================================================================
#  6. Superformula (Gielis)
# ==========================================================================
def superformula(m=6, n1=0.30, n2=9.0, n3=9.0, a=1.0, b=1.0):
    return trace_surface(None, [-1.6] * 3, [1.6] * 3, W, H, SS,
                         azim=26, elev=20, k=0.22, maxsteps=420, thin=0.7,
                         kind=F_SUPERFORMULA,
                         p0=(m, n1, n2), p1=(n3, a, b))


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
#  8. Trefoil knot
# ==========================================================================
def trefoil():
    nu, nv = 1400, 40
    u = np.linspace(0, 2 * np.pi, nu, endpoint=False)
    v = np.linspace(0, 2 * np.pi, nv, endpoint=False)
    U, V = np.meshgrid(u, v, indexing="ij")

    r = 1.0 + 0.42 * np.cos(3 * U)
    cx = r * np.cos(2 * U)
    cy = r * np.sin(2 * U)
    cz = 0.55 * np.sin(3 * U)

    dr = -1.26 * np.sin(3 * U)
    dx = dr * np.cos(2 * U) - 2 * r * np.sin(2 * U)
    dy = dr * np.sin(2 * U) + 2 * r * np.cos(2 * U)
    dz = 1.65 * np.cos(3 * U)
    T = _norm(np.stack([dx, dy, dz], -1))

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
    def fn(U, V):
        t, u = U, V
        return np.stack([np.sin(t) * np.cos(u) ** 2,
                         np.sin(t) * np.sin(u) * np.cos(u),
                         np.cos(t) + 0.5 * (np.cos(2 * t) - 1)
                         + 0.5 * (np.cos(2 * t) - 2 * np.cos(u) ** 2)], -1)

    # t MUST span the full 2*pi.  For t in [0, pi] we have sin(t) >= 0, hence
    # x = sin(t)*cos(u)^2 >= 0 always -> only the x >= 0 half of the surface
    # is generated (measured: x range was [0, 0.977] instead of [-1, 1]) and
    # the render collapses to a small fragment.  u must also wrap fully so
    # the two crossed sheets are both present.
    P = param_cloud(fn, 1700, 1700, 0, 2 * np.pi, 0, 2 * np.pi)
    # No |P| clip: the surface is naturally bounded (|P|max = 2.63) and the
    # old < 2.2 threshold amputated the z tip, leaving a flat cut.
    f = sdf_from_points(P, pad=0.05, thick=1, res=420)
    return trace_surface(f, f.lo, f.hi, W, H, SS, azim=38, elev=18, k=0.95,
                         glow=0.14, thin=0.7, zoom=0.80)


# ==========================================================================
#  10. Boy's surface
# ==========================================================================
def boys_surface():
    def fn(U, V):
        u, v = U, V
        return np.stack([np.cos(u / 2) * np.cos(v) - np.sin(u / 2) * np.sin(2 * v),
                         np.cos(u / 2) * np.sin(v) + np.sin(u / 2) * np.cos(2 * v),
                         2.0 * np.sin(u / 2)], -1)

    P = param_cloud(fn, 1400, 1400, 0, 2 * np.pi, 0, 2 * np.pi)
    f = sdf_from_points(P, pad=0.05, thick=1, res=330)
    return trace_surface(f, f.lo, f.hi, W, H, SS, azim=30, elev=16, k=0.95,
                         glow=0.14, thin=0.7)


# ==========================================================================
#  11. Helicoid
# ==========================================================================
def helicoid():
    a = 0.62
    tmax = 2.55
    u = np.linspace(-tmax, tmax, 1100)
    # nv=46 undersampled the v direction by 3.7x relative to the voxel size
    # (dv=0.0556 vs vox=0.0151), which is what produced the concentric-ring
    # moire -- not insufficient resolution.  Raise nv so dv <= vox.
    v = np.linspace(-1.25, 1.25, 230)
    U, V = np.meshgrid(u, v, indexing="ij")
    cu, su = np.cos(U), np.sin(U)
    P = np.stack([((a * U) * cu - V * su).ravel(),
                  ((a * U) * su + V * cu).ravel(),
                  np.broadcast_to(U, U.shape).ravel() * 0.92], 1)
    f = sdf_from_points(P, pad=0.06, thick=1, res=420)
    return trace_surface(f, f.lo, f.hi, W, H, SS, azim=34, elev=16, k=0.95,
                         glow=0.14, thin=0.7, zoom=0.88)


# ==========================================================================
#  12. Gabriel's horn
# ==========================================================================
def gabriel_horn():
    eps = 0.055
    X, T = np.meshgrid(np.linspace(eps, 1.7, 1500),
                       np.linspace(0, 2 * np.pi, 120, endpoint=False),
                       indexing="ij")
    P = np.stack([X.ravel(), (1.0 / X * np.cos(T)).ravel(),
                  (1.0 / X * np.sin(T)).ravel()], 1)
    f = sdf_from_points(P, pad=0.06, thick=1, res=300)
    return trace_surface(f, f.lo, f.hi, W, H, SS, azim=62, elev=14, k=0.95,
                         glow=0.18)


# ==========================================================================
#  13. Heart surface
# ==========================================================================
def heart():
    return trace_surface(None, [-1.35] * 3, [1.35] * 3, W, H, SS,
                         azim=28, elev=16, k=0.45, maxsteps=340, thin=0.5,
                         kind=F_HEART)


# ==========================================================================
#  14. Apollonian gasket
# ==========================================================================
def apollonian(rounds=5, res=520, box=2.3, rmax=0.42, thick=0.007):
    """4 mutually tangent unit spheres at the tetrahedron vertices, plus the
    central gap sphere, then repeated sphere-in-sphere inversion.

    The previous revision was broken in two ways:

    1. The inversion centre was `(m*ci + ci)/(|ci|^2 - (m*r)^2)`.  Inversion is
       an INVOLUTION: applying it twice returns the original sphere, so
       re-inverting only ever oscillated between the seeds.  No new spheres
       were produced (measured: 4-5 spheres after 8 rounds), and the
       `radius > 3.0` guard then rejected nearly everything.
    2. `np.minimum` over *solid* balls filled the whole bounding box: the
       union's SDF was negative everywhere (measured frac<0 = 1.00000), so
       the renderer drew a solid block -- the released image is pure black.

    Correct construction: invert each sphere in EACH OTHER sphere, union the
    new ones into the working set, and repeat.  The count grows 4 -> 20 ->
    144 -> 396 -> 636 -> 6081.  Rendered as a SHELL (|d| - thick), because
    the gasket is the sphere surfaces, not the balls.
    """
    from scipy.ndimage import distance_transform_edt
    q = 1000.0

    def invert(a, ra, b, rb):
        dv = a - b
        den = float(dv @ dv) - rb * rb
        if abs(den) < 1e-12:
            return None
        return b + (rb * rb / den) * dv, abs(rb * rb * ra / den)

    v = np.array([[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]], float)
    v /= np.linalg.norm(v, axis=1, keepdims=True)
    R = np.sqrt(3.0 / 2.0)          # edge length == 2 -> the spheres touch
    cur = [(v[i] * R, 1.0) for i in range(4)] + [(np.zeros(3), R - 1.0)]
    keep = list(cur)
    seen = set()
    for c, r in keep:
        seen.add((round(c[0] * q), round(c[1] * q), round(c[2] * q),
                  round(r * q)))
    for _ in range(rounds):
        new, keys = [], set()
        for a, ra in cur:
            for b, rb in cur:
                if ra == rb and np.allclose(a, b):
                    continue
                out = invert(a, ra, b, rb)
                if out is None:
                    continue
                c2, r2 = out
                if r2 > rmax or r2 < 0.010:
                    continue
                if np.abs(c2).max() > box * 1.5:
                    continue
                k = (round(c2[0] * q), round(c2[1] * q), round(c2[2] * q),
                     round(r2 * q))
                if k in seen or k in keys:
                    continue
                keys.add(k)
                new.append((c2, r2))
        seen |= keys
        keep += new
        cur = new
    C = np.array([c for c, _ in keep])
    RR = np.array([r for _, r in keep])
    m = RR < 0.40                 # drop the 5 seed balls, keep the fractal
    C, RR = C[m], RR[m]
    g = np.linspace(-box, box, res).astype(np.float32)
    X, Y, Z = np.meshgrid(g, g, g, indexing="ij")
    occ = np.zeros((res, res, res), bool)
    vox = 2.0 * box / (res - 1)
    for c, r in zip(C, RR):        # bounding-box sub-slices keep memory flat
        lo = np.maximum(((c - r + box) / vox).astype(int) - 1, 0)
        hi = np.minimum(((c + r + box) / vox).astype(int) + 1, res - 1)
        if np.any(lo > hi):
            continue
        sub = (slice(lo[0], hi[0] + 1), slice(lo[1], hi[1] + 1),
               slice(lo[2], hi[2] + 1))
        d = np.sqrt((X[sub] - c[0]) ** 2 + (Y[sub] - c[1]) ** 2
                    + (Z[sub] - c[2]) ** 2) - r
        occ[sub] |= d <= 0
    din = distance_transform_edt(~occ, sampling=vox)
    dout = distance_transform_edt(occ, sampling=vox)
    sdf = (din - np.maximum(dout, vox)).astype(np.float32)
    f = grid_from_array(sdf, [-box] * 3, [box] * 3)
    return trace_surface(f, f.lo, f.hi, W, H, SS, azim=35, elev=18, k=0.9,
                         glow=0.24, zoom=0.92)


# ==========================================================================
#  15. Mandelbulb (power 8)
# ==========================================================================
def mandelbulb(power=8, iters=16):
    """The Mandelbulb: z <- z^power + c in spherical coordinates.

    Analytic distance-estimator field (kind F_MANDELBULB), no grid and no EDT
    -- renders in ~0.3 s instead of 61 s.

    ROOT CAUSE of the old "renders as a smooth tube" defect (fixed 2026-10-06)
    -------------------------------------------------------------------------
    The scene built its complex iterate as

        c = (X + 1j*Y).ravel() + 1j*Z.ravel()

    which is X + i*(Y+Z) -- the 3D coordinate was collapsed onto the complex
    plane, so the field depended on x and (y+z) only.  Measured proof: the
    y=0 and y=0.4 slices with z shifted by -0.4 were *bit-for-bit identical*.
    A field that is constant along the (0,1,-1) direction is a 2D set extruded
    into 3D, i.e. a prism -- which is exactly the "tube" that both the GPU and
    the CPU engine drew.  The old note blaming "no negative interior" and the
    surface renderer was a misdiagnosis; the field itself was the bug.

    The spherical power map needs all three coordinates, which is what
    _f_mandelbulb does.
    """
    return trace_surface(None, [-1.45] * 3, [1.45] * 3, W, H, SS,
                         azim=35, elev=30, k=0.95, maxsteps=420,
                         glow=0.12, light=0.62, thin=0.45, zoom=0.68,
                         contrast=1.00,
                         kind=F_MANDELBULB, p0=(float(power), float(iters), 0.0))


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
    f = grid_from_array((dout - din).astype(np.float32), [lo] * 3, [hi] * 3)
    return trace_surface(f, f.lo, f.hi, W, H, SS, azim=32, elev=20, k=0.92,
                         glow=0.20)


# ==========================================================================
#  17-19. attractors rendered as glowing filaments
# ==========================================================================
def _tube_from_points(P, rad=0.02, res=380, gain=1.0, wid=1.0, dens=5.0,
                      close=0, steps=170):
    lo = P.min(0) - rad * 1.2
    hi = P.max(0) + rad * 1.2
    ext = hi - lo
    nres = int(np.clip(round(res * float(ext.max()) / float(ext.max())), 64, 420))
    vox = float(ext.max()) / (nres - 1)
    rad = max(rad, 2.2 * vox)
    occ = np.zeros((nres, nres, nres), bool)
    idx = np.rint((P - lo) / vox).astype(np.int32)
    np.clip(idx, 0, nres - 1, out=idx)
    occ[idx[:, 0], idx[:, 1], idx[:, 2]] = True
    from scipy.ndimage import distance_transform_edt
    # A 1-D curve sampled at ~1-3 voxels per step leaves gaps in the occupancy
    # mask, and the EDT then resolves each sample as its own little blob --
    # that is the speckled "noise" look.  Dilating closes the curve into a
    # continuous tube.  close=0 keeps the previous behaviour.
    if close > 0:
        m = occ
        for _ in range(close):
            p = np.zeros_like(m)
            p[1:, :, :] |= m[:-1, :, :]; p[:-1, :, :] |= m[1:, :, :]
            p[:, 1:, :] |= m[:, :-1, :]; p[:, :-1, :] |= m[:, 1:, :]
            p[:, :, 1:] |= m[:, :, :-1]; p[:, :, :-1] |= m[:, :, 1:]
            m = m | p
            occ = m
    dout = distance_transform_edt(occ, sampling=vox)
    din = distance_transform_edt(~occ, sampling=vox)
    d = (dout - np.maximum(din, vox)).astype(np.float32)
    del occ, dout, din
    f = grid_from_array(d, lo, hi)
    return trace_glow(f, lo, hi, W, H, SS, azim=28, elev=16,
                      sigma=rad * wid, dens=dens, steps=steps, gain=gain,
                      colors=((0.30, 0.80, 1.0), (1.0, 0.62, 0.30)))


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
    P = P - P.mean(0)
    P /= np.abs(P).max() * 1.06
    return _tube_from_points(P, rad=0.0075, res=380, gain=0.42, dens=30.0)


def dejong():
    """x' = sin(a y) - cos(b x),  y' = sin(c x) - cos(d y).

    The previous revision produced a nearly black frame (measured max
    luminance 0.15) for two reasons:

    1. `_tube_from_points` was given the raw orbit and relies on `close` to
       bridge consecutive samples.  This map is a JUMPING map: the median
       step between consecutive orbit points is 0.707 in a domain of width
       ~2.0, i.e. ~133 voxels at res=380.  No affordable amount of binary
       dilation bridges that, so the tube stayed a cloud of disconnected
       specks and the volumetric integral had almost nothing to integrate.
    2. `gain=0.40` was an order of magnitude too small for how little
       emission the speck cloud carries.

    Fix: build the union of small balls around the samples with a single
    EDT (exact, no dilation needed), then glow that.  More samples (2e6)
    give a dense filament; a gamma lift brings the midtones up without
    clipping the highlights.
    """
    from scipy.ndimage import distance_transform_edt
    a, b, c, d = 1.4, -2.3, 2.4, -2.1
    n = 2000000
    x = np.empty(n); y = np.empty(n)
    x[0], y[0] = 0.1, 0.1
    for i in range(1, n):
        x[i] = np.sin(a * y[i - 1]) - np.cos(b * x[i - 1])
        y[i] = np.sin(c * x[i - 1]) - np.cos(d * y[i - 1])
    P = np.stack([x, y, 0.16 * (x * np.cos(0.7 * y) + y * np.sin(0.7 * y))], 1)
    P = P - P.mean(0)
    P /= np.abs(P).max() * 1.05
    res = 460
    lo = P.min(0) - 0.05
    hi = P.max(0) + 0.05
    vox = float((hi - lo).max()) / (res - 1)
    occ = np.zeros((res, res, res), bool)
    idx = np.rint((P - lo) / vox).astype(np.int32)
    np.clip(idx, 0, res - 1, out=idx)
    occ[idx[:, 0], idx[:, 1], idx[:, 2]] = True
    din = distance_transform_edt(~occ, sampling=vox).astype(np.float32)
    f = grid_from_array((din - 0.0135).astype(np.float32), lo, hi)
    img = trace_glow(f, lo, hi, W, H, SS, azim=28, elev=16, sigma=0.040,
                     dens=4.0, steps=240, gain=2.4,
                     colors=((0.32, 0.80, 1.0), (1.0, 0.64, 0.32)))
    return np.clip(img, 0, 1) ** 0.72      # lift midtones, keep highlights


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
    P = P - P.mean(0)
    P /= np.abs(P).max() * 1.05
    # The Clifford map is a *jumping* map: consecutive samples land ~238 vox
    # apart (measured), so the raw occupancy mask was 0.108% dense and broke
    # into disconnected specks -- that is the "noise".  close=2 bridges the
    # gaps into a continuous filament; gain is raised because the closed tube
    # integrates more emission than the speckled one did.
    return _tube_from_points(P, rad=0.0045, res=420, gain=0.50, dens=30.0,
                             close=2)


# ==========================================================================
#  20-21. atomic orbitals
# ==========================================================================
def orbital(l, m):
    # The occupancy grid MUST be at least as fine as the SDF grid.  It used
    # to be res=240 (voxel 0.0096) while sdf_from_occupancy ran at res=300
    # (capped 384 -> 0.0060), so the SDF was just trilinearly upsampling a
    # blockier mask -- raising the SDF res alone changed nothing, and the
    # blocky shells read as concentric-ring moire.  Both are now 384.
    res = 384
    # the object reaches r = R <= 0.96, so the old +/-1.15 box wasted ~20% of
    # the frame and made the object read as too small
    half = 0.94
    g = np.linspace(-half, half, res).astype(np.float32)
    X, Yc, Z = np.meshgrid(g, g, g, indexing="ij")
    r = np.sqrt(X * X + Yc * Yc + Z * Z) + 1e-9
    ct = np.clip(Z / r, -1, 1)
    st = np.sqrt(np.clip(1 - ct * ct, 1e-12, None))
    phi = np.arctan2(Yc, X)
    if l == 2 and m == 0:
        Ylm = 3 * ct * ct - 1
        c, R = 0.62, 0.90
    elif l == 3 and m == 0:
        Ylm = ct * (5 * ct * ct - 3)
        # c was 0.95, but Ylm = cos(3*theta) has max |Ylm| = 1.0, so only
        # |cos3t| > 0.95 survived -> two tiny disconnected blobs (measured
        # fill 2.07% vs 5.23% at c=0.5).  c=0.5 recovers the 5-lobe shape.
        c, R = 0.50, 0.96
    elif l == 2 and m == 2:
        Ylm = 3 * st * st * np.cos(2 * phi)
        c, R = 0.62, 0.90
    else:
        Ylm = 2 * ct
        c, R = 0.55, 0.90
    rad = R * np.sqrt(np.clip((np.abs(Ylm) - c) / max(2.0 - c, 1e-6), 0, 1))
    keep = r < rad
    del X, Yc, Z, r, ct, st, phi, Ylm, rad
    f = sdf_from_occupancy(keep, [g[0]] * 3, [g[-1]] * 3, thick=1, res=384,
                           smooth=0.8)
    # elev was 74 (near top-down): both orbitals are z-axis symmetric, so
    # that angle looks straight down the nodal cone and the lobes collapse
    # into overlapping discs.  el=35 shows the lobes separated.
    return trace_surface(f, f.lo, f.hi, W, H, SS, azim=24, elev=35, k=0.92,
                         glow=0.22, thin=0.6, zoom=0.88)


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
    args = sys.argv[1:]
    todo = [s for s in SCENES if s[0] in args] if args else SCENES
    outdir = os.environ.get("MATH3D_OUT", OUTDIR)
    times = []
    for key, title, fn in todo:
        t0 = time.time()
        try:
            log("start", key)
            img = fn()
            dt = time.time() - t0
            save(img, key, outdir)
            times.append((key, dt))
            log("done ", key, "%.2fs" % dt)
        except Exception:
            import traceback
            log("FAIL", key)
            traceback.print_exc()
            times.append((key, float("nan")))
    log("=== timings")
    for k, dt in times:
        log("  %-16s %7.2fs" % (k, dt))
    log("  TOTAL  %7.2fs" % sum(t for _, t in times if t == t))
    log("ALL FINISHED")