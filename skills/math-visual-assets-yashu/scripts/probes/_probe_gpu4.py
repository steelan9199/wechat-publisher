# -*- coding: utf-8 -*-
"""Probe 4: confirm the exact primitives the renderer will rely on."""
import numpy as np
import math
from numba_cuda_mlir import cuda

OUT = []


def log(*a):
    s = " ".join(str(x) for x in a)
    OUT.append(s)
    print(s, flush=True)


# ---------- A. math.* full set, no hasattr
@cuda.jit(device=True)
def m(v):
    a = math.sin(v)
    b = math.cos(v)
    c = math.tan(v)
    d = math.sqrt(abs(v) + 1.0)
    e = math.exp(-abs(v))
    f = math.log(abs(v) + 1.0)
    g = math.atan2(v, 2.0)
    h = math.floor(v)
    i2 = math.ceil(v)
    j = math.fabs(v)
    k2 = math.copysign(1.0, v)
    m2 = math.pow(abs(v) + 1.0, 2.5)
    n2 = math.acos(max(-1.0, min(1.0, v / 10.0)))
    o2 = math.asin(max(-1.0, min(1.0, v / 10.0)))
    p2 = math.atan(v)
    q2 = math.tanh(v)
    r2 = math.copysign(math.floor(abs(v) + 0.5), v)
    return a + b * .1 + c * .01 + d * .001 + e * .0001 + f * 1e-5 + g * 1e-6 \
        + h * 1e-7 + i2 * 1e-8 + j * 1e-9 + k2 * 1e-10 + m2 * 1e-11 \
        + n2 * 1e-12 + o2 * 1e-13 + p2 * 1e-14 + q2 * 1e-15 + r2 * 1e-16


@cuda.jit
def k_m(o):
    i = cuda.grid(1)
    if i < o.shape[0]:
        o[i] = m(float(i) * 0.37 - 1.0)


def t_math():
    try:
        dO = cuda.to_device(np.zeros(8, np.float32))
        k_m[1, 8](dO)
        cuda.synchronize()
        log("  math.* 17 fns OK")
    except Exception as e:
        log("  math.* FAIL:", str(e)[:300])


@cuda.jit(device=True)
def m2f(v):
    return math.isnan(v) + math.isinf(v)


@cuda.jit
def k_nan(o, a):
    i = cuda.grid(1)
    if i < o.shape[0]:
        o[i] = m2f(a[i])


def t_nan():
    try:
        A = np.array([1.0, np.nan, np.inf, -np.inf], np.float32)
        dA = cuda.to_device(A)
        dO = cuda.to_device(np.zeros(4, np.float32))
        k_nan[1, 4](dO, dA)
        cuda.synchronize()
        log("  math.isnan/isinf OK:", dO.copy_to_host(), "expect [0 1 1 1]")
    except Exception as e:
        log("  math.isnan FAIL:", str(e)[:200])


# ---------- B. numpy scalar funcs in kernel (no try)
@cuda.jit
def k_np1(o):
    i = cuda.grid(1)
    if i < o.shape[0]:
        v = float(i) * 0.2
        o[i] = np.sin(v) + np.sqrt(abs(v) + 1.0) + np.clip(v, 0.0, 1.0) \
            + np.minimum(v, 1.0) + np.abs(v) + np.sign(v)


def t_np1():
    try:
        dO = cuda.to_device(np.zeros(8, np.float32))
        k_np1[1, 8](dO)
        cuda.synchronize()
        log("  np scalar fns OK:", dO.copy_to_host()[:3])
    except Exception as e:
        log("  np scalar fns FAIL:", str(e)[:250].replace("\n", " "))


# ---------- C. flat-1D grid trilinear inside a DEVICE FUNCTION, vs CPU
@cuda.jit(device=True)
def d_tril_flat(g, nx, ny, nz, lo0, lo1, lo2, h0, h1, h2, x, y, z):
    gx = (x - lo0) / h0
    gy = (y - lo1) / h1
    gz = (z - lo2) / h2
    gx = min(max(gx, 0.0), float(nx - 1) * 0.99999)
    gy = min(max(gy, 0.0), float(ny - 1) * 0.99999)
    gz = min(max(gz, 0.0), float(nz - 1) * 0.99999)
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
    b00 = (i0 * ny + j0) * nz
    b10 = (i1 * ny + j0) * nz
    b01 = (i0 * ny + j1) * nz
    b11 = (i1 * ny + j1) * nz
    c000 = g[b00 + k0]
    c100 = g[b10 + k0]
    c010 = g[b01 + k0]
    c110 = g[b11 + k0]
    c001 = g[b00 + k1]
    c101 = g[b10 + k1]
    c011 = g[b01 + k1]
    c111 = g[b11 + k1]
    c00 = c000 + (c100 - c000) * fx
    c10 = c010 + (c110 - c010) * fx
    c01 = c001 + (c101 - c001) * fx
    c11 = c011 + (c111 - c011) * fx
    c0 = c00 + (c10 - c00) * fy
    c1 = c01 + (c11 - c01) * fy
    return c0 + (c1 - c0) * fz


@cuda.jit
def k_flat(o, g, nx, ny, nz, lo, h, pts):
    i = cuda.grid(1)
    if i < o.shape[0]:
        o[i] = d_tril_flat(g, nx, ny, nz, lo[0], lo[1], lo[2], h[0], h[1], h[2],
                           pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2])


def cpu_tril(sdf, n, lo, hi, x, y, z):
    h = (hi - lo) / np.maximum(n - 1, 1)
    g = np.array([x, y, z]) - lo
    g = np.clip(g / h, 0.0, (n - 1) * 0.99999)
    i0 = g.astype(np.int64)
    f = g - i0
    i1 = i0 + 1
    s = sdf
    x0, y0, z0 = i0
    x1, y1, z1 = i1
    c000 = s[x0, y0, z0]; c100 = s[x1, y0, z0]
    c010 = s[x0, y1, z0]; c110 = s[x1, y1, z0]
    c001 = s[x0, y0, z1]; c101 = s[x1, y0, z1]
    c011 = s[x0, y1, z1]; c111 = s[x1, y1, z1]
    fx, fy, fz = f
    c00 = c000 + (c100 - c000) * fx
    c10 = c010 + (c110 - c010) * fx
    c01 = c001 + (c101 - c001) * fx
    c11 = c011 + (c111 - c011) * fx
    c0 = c00 + (c10 - c00) * fy
    c1 = c01 + (c11 - c01) * fy
    return c0 + (c1 - c0) * fz


def t_flat():
    try:
        rng = np.random.default_rng(7)
        n = np.array([37, 41, 33])
        sdf = (rng.random(tuple(n)) * 2 - 1).astype(np.float32)
        lo = np.array([-1.3, -0.7, -2.1])
        hi = np.array([1.1, 0.9, 1.6])
        h = (hi - lo) / (n - 1)
        P = rng.uniform(lo - 0.2, hi + 0.2, size=(500, 3))
        dG = cuda.to_device(np.ascontiguousarray(sdf.ravel()))
        dP = cuda.to_device(np.ascontiguousarray(P.astype(np.float32).ravel()))
        dLo = cuda.to_device(lo.astype(np.float32))
        dH = cuda.to_device(h.astype(np.float32))
        dO = cuda.to_device(np.zeros(500, np.float32))
        k_flat[1, 500](dO, dG, int(n[0]), int(n[1]), int(n[2]), dLo, dH, dP)
        cuda.synchronize()
        g = dO.copy_to_host()
        err = 0.0
        for i in range(500):
            r = cpu_tril(sdf, n, lo, hi, *P[i])
            err = max(err, abs(g[i] - r))
        log("  flat trilinear device-fn OK, maxerr vs CPU = %.3e" % err)
    except Exception as e:
        log("  flat trilinear FAIL:", str(e)[:400])


# ---------- D. palette LUT lookup in device fn
@cuda.jit(device=True)
def pal(lut, t):
    n = lut.shape[0]
    x = t * float(n)
    if x < 0.0:
        x = 0.0
    if x > float(n - 1):
        x = float(n - 1)
    i = int(x)
    fr = x - float(i)
    j = min(i + 1, n - 1)
    r = lut[i, 0] + (lut[j, 0] - lut[i, 0]) * fr
    g = lut[i, 1] + (lut[j, 1] - lut[i, 1]) * fr
    b = lut[i, 2] + (lut[j, 2] - lut[i, 2]) * fr
    return r, g, b


@cuda.jit
def k_pal(o, lut):
    i = cuda.grid(1)
    if i < o.shape[0]:
        r, g, b = pal(lut, float(i) / 8.0)
        o[i * 3] = r
        o[i * 3 + 1] = g
        o[i * 3 + 2] = b


def t_pal():
    from matplotlib.colors import LinearSegmentedColormap
    try:
        P = LinearSegmentedColormap.from_list(
            "nebula", ["#0d2a4d", "#0d5f86", "#128f9e", "#3fc9b0", "#9fe6c8",
                       "#e8c877", "#e07a4a", "#b3305f", "#5b21a8"], N=512)
        lut = (P(np.arange(512) / 511.0)[:, :3]).astype(np.float32)
        dL = cuda.to_device(lut)
        dO = cuda.to_device(np.zeros(24, np.float32))
        k_pal[1, 8](dO, dL)
        cuda.synchronize()
        r = dO.copy_to_host().reshape(8, 3)
        ref = P(np.arange(8) / 8.0)[:, :3]
        log("  palette LUT OK, maxerr vs mpl = %.3e" % np.abs(r - ref).max())
    except Exception as e:
        log("  palette FAIL:", str(e)[:300])


# ---------- E. int loop bounds from runtime arg + early break; dynamic if
@cuda.jit
def k_dyn(o, n, k, eps, ms):
    i = cuda.grid(1)
    if i >= o.shape[0]:
        return
    t = 0.0
    pd = 0.0
    hit = 0.0
    for s in range(ms):
        d = math.sin(t * k) * math.cos(t * 0.7)
        if abs(d) < eps:
            hit = 1.0
            break
        if (d > 0.0) != (pd > 0.0) and pd != 0.0:
            hit = 2.0
            break
        st = k * abs(d)
        if st < eps * 0.1:
            st = eps * 0.1
        t = t + st
        pd = d
    o[i] = hit + t * 1e-6


def cpu_dyn(k, eps, ms):
    t = 0.0
    pd = 0.0
    hit = 0.0
    for s in range(ms):
        d = math.sin(t * k) * math.cos(t * 0.7)
        if abs(d) < eps:
            hit = 1.0
            break
        if (d > 0.0) != (pd > 0.0) and pd != 0.0:
            hit = 2.0
            break
        st = k * abs(d)
        if st < eps * 0.1:
            st = eps * 0.1
        t = t + st
        pd = d
    return hit + t * 1e-6


def t_dyn():
    try:
        n = 512
        dO = cuda.to_device(np.zeros(n, np.float32))
        k_dyn[1, n](dO, n, 0.62, 1.1e-4, 300)
        cuda.synchronize()
        g = dO.copy_to_host()
        err = max(abs(g[i] - cpu_dyn(0.62, 1.1e-4, 300)) for i in range(n))
        log("  dynamic-loop march OK, maxerr vs CPU = %.3e" % err)
    except Exception as e:
        log("  dynamic-loop FAIL:", str(e)[:300])


# ---------- F. multiple kernels w/ different signatures from same module
@cuda.jit
def k_a(o):
    i = cuda.grid(1)
    if i < o.shape[0]:
        o[i] = float(i)


@cuda.jit
def k_b(o, s, n):
    i = cuda.grid(1)
    if i < o.shape[0]:
        o[i] = float(i) * n + s


def t_multi():
    try:
        dO = cuda.to_device(np.zeros(8, np.float32))
        k_a[1, 8](dO)
        cuda.synchronize()
        k_b[1, 8](dO, 2.0, 3.0)
        cuda.synchronize()
        log("  multi-kernel distinct signatures OK:", dO.copy_to_host()[:3])
    except Exception as e:
        log("  multi FAIL:", str(e)[:300])


# ---------- G. bool array output
@cuda.jit
def k_boolout(o, a):
    i = cuda.grid(1)
    if i < o.shape[0]:
        o[i] = a[i] > 0.5


def t_boolout():
    try:
        A = np.array([1.0, -1.0, 0.9], np.float32)
        dA = cuda.to_device(A)
        dO = cuda.to_device(np.zeros(3, np.bool_))
        k_boolout[1, 3](dO, dA)
        cuda.synchronize()
        log("  bool array out OK:", dO.copy_to_host())
    except Exception as e:
        log("  bool array out FAIL:", str(e)[:250])


# ---------- H. global constant array captured by device fn (palette module-level)
PAL_LUT = np.zeros((8, 3), np.float32)


@cuda.jit(device=True)
def d_pal_glob(t):
    r, g, b = pal(PAL_LUT, t)
    return r + g + b


@cuda.jit
def k_glob(o):
    i = cuda.grid(1)
    if i < o.shape[0]:
        o[i] = d_pal_glob(float(i) / 8.0)


def t_glob():
    try:
        from numba_cuda_mlir import carray
        import numba_cuda_mlir.numba_cuda as nc
        # try capturing via carray-style global replacement
        global PAL_LUT
        PAL_LUT = np.linspace(0, 1, 24, dtype=np.float32).reshape(8, 3)
        try:
            dc = carray(PAL_LUT.ravel(), (8, 3))
            globals()["_PAL_DEV"] = dc
        except Exception as e:
            log("  carray(shape) err:", str(e)[:120])
        dO = cuda.to_device(np.zeros(8, np.float32))
        k_glob[1, 8](dO)
        cuda.synchronize()
        log("  module-global numpy captured in device fn OK:", dO.copy_to_host()[:3])
    except Exception as e:
        log("  global capture FAIL:", str(e)[:400])


def main():
    for name, fn in [("math", t_math), ("nan", t_nan), ("np", t_np1),
                     ("flat", t_flat), ("pal", t_pal), ("dyn", t_dyn),
                     ("multi", t_multi), ("boolout", t_boolout),
                     ("glob", t_glob)]:
        log("=== " + name)
        try:
            fn()
        except Exception:
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    main()
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir, "_out", "_probe4_out.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(OUT))