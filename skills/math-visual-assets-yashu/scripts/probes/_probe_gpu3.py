# -*- coding: utf-8 -*-
"""Probe 3: what I actually need to write the renderer."""
import numpy as np
import math
from numba_cuda_mlir import cuda

OUT = []


def log(*a):
    s = " ".join(str(x) for x in a)
    OUT.append(s)
    print(s, flush=True)


# ---------- 1. math.* availability in device fn
@cuda.jit(device=True)
def m_all(v):
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
    s2 = math.isnan(v)
    t2 = math.ldexp(v, 2) if hasattr(math, "ldexp") else v
    return a + b * 0.1 + c * 0.01 + d * 0.001 + e * 0.0001 + f * 1e-5 \
        + g * 1e-6 + h * 1e-7 + i2 * 1e-8 + j * 1e-9 + k2 * 1e-10 \
        + m2 * 1e-11 + n2 * 1e-12 + o2 * 1e-13 + p2 * 1e-14 + q2 * 1e-15 \
        + r2 * 1e-16 + s2 * 1e-17 + t2 * 1e-18


@cuda.jit
def k_m(o):
    i = cuda.grid(1)
    if i < o.shape[0]:
        o[i] = m_all(float(i) * 0.37 - 1.0)


def t_math():
    try:
        dO = cuda.to_device(np.zeros(8, np.float32))
        k_m[1, 8](dO)
        cuda.synchronize()
        log("  math.* all OK:", dO.copy_to_host()[:3])
    except Exception as e:
        log("  math.* FAIL:", str(e)[:400])


# ---------- 2. numpy funcs in device fn
@cuda.jit
def k_np(o):
    i = cuda.grid(1)
    if i < o.shape[0]:
        v = float(i) * 0.2
        try:
            a = np.clip(v, 0.0, 1.0)
        except Exception:
            a = v
        try:
            b = np.sqrt(abs(v) + 1.0)
        except Exception:
            b = v
        try:
            c = np.sin(v)
        except Exception:
            c = v
        try:
            d = np.sign(v)
        except Exception:
            d = v
        try:
            e = np.minimum(v, 1.0)
        except Exception:
            e = v
        o[i] = a + b + c + d + e


def t_np():
    try:
        dO = cuda.to_device(np.zeros(8, np.float32))
        k_np[1, 8](dO)
        cuda.synchronize()
        log("  numpy in kernel OK:", dO.copy_to_host()[:3])
    except Exception as e:
        log("  numpy in kernel FAIL:", str(e)[:300])


# ---------- 3. device fn returning tuple
@cuda.jit(device=True)
def d_tuple(x, y, z):
    n = math.sqrt(x * x + y * y + z * z) + 1e-20
    return (x / n, y / n, z / n)


@cuda.jit
def k_tup(o):
    i = cuda.grid(1)
    if i < o.shape[0]:
        v = float(i) + 1.0
        a, b, c = d_tuple(v, 2.0, 3.0)
        o[i] = a + b * 2.0 + c * 3.0


def t_tuple():
    try:
        dO = cuda.to_device(np.zeros(8, np.float32))
        k_tup[1, 8](dO)
        cuda.synchronize()
        r = dO.copy_to_host()
        v = 1.0
        a, b, c = d_tuple_cpu(v, 2.0, 3.0)
        log("  tuple ret OK gpu=%.6f cpu=%.6f" % (r[0], a + b * 2 + c * 3))
    except Exception as e:
        log("  tuple ret FAIL:", str(e)[:300])


def d_tuple_cpu(x, y, z):
    n = math.sqrt(x * x + y * y + z * z) + 1e-20
    return x / n, y / n, z / n


# ---------- 4. many-arg kernel (render kernel needs ~30 params)
@cuda.jit
def k_args(o, sdf, p0, p1, p2, p3, p4, p5, p6, p7, p8, p9,
           p10, p11, p12, p13, p14, p15, p16, p17, p18, p19, p20):
    i = cuda.grid(1)
    if i < o.shape[0]:
        o[i] = sdf[i % sdf.shape[0]] * 0.0 + p0 + p1 + p20


def t_args():
    try:
        dO = cuda.to_device(np.zeros(64, np.float32))
        dS = cuda.to_device(np.arange(64, dtype=np.float32))
        k_args[1, 64](dO, dS, *([1.0] * 21))
        cuda.synchronize()
        log("  23-arg kernel OK:", dO.copy_to_host()[0])
    except Exception as e:
        log("  23-arg FAIL:", str(e)[:300])


# ---------- 5. int32 indexing arithmetic & 2D array in kernel
@cuda.jit
def k_2d(o, a):
    i, j = cuda.grid(2)
    if i < o.shape[0] and j < o.shape[1]:
        o[i, j] = a[j, i] * 2.0


def t_2d():
    try:
        A = np.arange(12, dtype=np.float32).reshape(3, 4)
        dA = cuda.to_device(A)
        dO = cuda.to_device(np.zeros((4, 3), np.float32))
        k_2d[(1, 2), (4, 2)](dO, dA)
        cuda.synchronize()
        log("  2D grid OK:", dO.copy_to_host()[0], "expect", A[:, 0] * 2)
    except Exception as e:
        log("  2D grid FAIL:", str(e)[:300])


# ---------- 6. cuda.grid(1) with 2D launch config & block dim query
def t_cfg():
    for n in (1 << 20, 3_000_000):
        try:
            tpb = cuda.get_current_device().MAX_THREADS_PER_BLOCK
            log("  MAX_THREADS_PER_BLOCK =", tpb)
        except Exception as e:
            log("  devattr FAIL", str(e)[:200])
        break


# ---------- 7. big grid upload + timing
def t_big():
    import time
    try:
        G = np.random.rand(420, 420, 420).astype(np.float32)
        t0 = time.time()
        dG = cuda.to_device(G)
        cuda.synchronize()
        t1 = time.time()
        log("  upload 420^3 f32 (296MB): %.3f s" % (t1 - t0))
        back = dG.copy_to_host()
        log("  download ok, max diff", np.abs(back - G).max())
        del dG, back, G
    except Exception as e:
        log("  big grid FAIL", str(e)[:300])


# ---------- 8. timing: block size sweep for a march-like kernel
@cuda.jit(device=True)
def gy(x, y, z):
    return (math.cos(x) * math.cos(y) + math.cos(y) * math.cos(z)
            + math.cos(z) * math.cos(x))


@cuda.jit
def k_bench(o, n, k, eps, maxsteps):
    i = cuda.grid(1)
    if i >= n:
        return
    px = i % 1720
    py = i // 1720
    ax = (px + 0.5) / 1720 * 2 - 1
    ay = 1 - (py + 0.5) / 1720 * 2
    f = 1.0 / math.tan(math.radians(30.0) * 0.5)
    dx = ax
    dy = ay
    dz = -f
    nrm = math.sqrt(dx * dx + dy * dy + dz * dz)
    dx /= nrm
    dy /= nrm
    dz /= nrm
    t = 0.0
    cnt = 0.0
    pd = 0.0
    for _ in range(maxsteps):
        d = gy(dx * t - 1.5, dy * t, dz * t + 1.0)
        ad = abs(d)
        if ad < eps:
            break
        if (d > 0.0) != (pd > 0.0) and pd != 0.0:
            break
        s = k * ad
        if s < 1e-5:
            s = 1e-5
        t = t + s
        pd = d
        cnt += 1.0
    o[i] = cnt


def t_bench():
    import time
    n = 1720 * 1720
    for tpb in (64, 128, 256, 512):
        try:
            dO = cuda.to_device(np.zeros(n, np.float32))
            blocks = (n + tpb - 1) // tpb
            k_bench[blocks, tpb](dO, n, 0.62, 1.1e-4, 300)   # warm/compile
            cuda.synchronize()
            t0 = time.time()
            k_bench[blocks, tpb](dO, n, 0.62, 1.1e-4, 300)
            cuda.synchronize()
            t1 = time.time()
            log("  tpb=%4d  %d blocks  march 1720^2x300 = %.4f s" % (tpb, blocks, t1 - t0))
        except Exception as e:
            log("  tpb=%d FAIL %s" % (tpb, str(e)[:200]))


# ---------- 9. carray usage
def t_carray():
    from numba_cuda_mlir import carray
    try:
        A = np.zeros(16, np.float32)
        dA = carray(A)
        log("  carray OK type", type(dA))
        @cuda.jit
        def kk(o):
            i = cuda.grid(1)
            if i < o.shape[0]:
                o[i] = A[i] + 1.0
        dO = cuda.to_device(np.zeros(16, np.float32))
        kk[1, 16](dO, dA)
        cuda.synchronize()
        log("  carray captured-in-kernel OK:", dO.copy_to_host()[:3])
    except Exception as e:
        log("  carray FAIL", str(e)[:300])


# ---------- 10. read-only grid interpolation with a captured device array
@cuda.jit(device=True)
def d_tril(g, nx, ny, nz, lo0, lo1, lo2, h0, h1, h2, x, y, z):
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
    i1 = i0 + 1
    j1 = j0 + 1
    k1 = k0 + 1
    if i1 > nx - 1:
        i1 = nx - 1
    if j1 > ny - 1:
        j1 = ny - 1
    if k1 > nz - 1:
        k1 = nz - 1
    c000 = g[i0, j0, k0]
    c100 = g[i1, j0, k0]
    c010 = g[i0, j1, k0]
    c110 = g[i1, j1, k0]
    c001 = g[i0, j0, k1]
    c101 = g[i1, j0, k1]
    c011 = g[i0, j1, k1]
    c111 = g[i1, j1, k1]
    c00 = c000 + (c100 - c000) * fx
    c10 = c010 + (c110 - c010) * fx
    c01 = c001 + (c101 - c001) * fx
    c11 = c011 + (c111 - c011) * fx
    c0 = c00 + (c10 - c00) * fy
    c1 = c01 + (c11 - c01) * fy
    return c0 + (c1 - c0) * fz


@cuda.jit
def k_tri(o, g):
    i = cuda.grid(1)
    if i < o.shape[0]:
        nx, ny, nz = g.shape[0], g.shape[1], g.shape[2]
        v = d_tril(g, nx, ny, nz, -1.0, -1.0, -1.0, 2.0 / (nx - 1), 2.0 / (ny - 1),
                   2.0 / (nz - 1), (i % 7) * 0.5 - 1.5, (i % 5) * 0.6 - 1.2,
                   (i % 3) * 0.8 - 0.8)
        o[i] = v


def t_tri():
    from scipy.ndimage import map_coordinates
    try:
        G = (np.random.rand(40, 41, 42) * 2 - 1).astype(np.float32)
        dG = cuda.to_device(G)
        n = 32
        dO = cuda.to_device(np.zeros(n, np.float32))
        k_tri[1, n](dO, dG)
        cuda.synchronize()
        r = dO.copy_to_host()
        err = 0.0
        for i in range(n):
            c = np.array([(i % 7) * 0.5 - 1.5, (i % 5) * 0.6 - 1.2, (i % 3) * 0.8 - 0.8])
            idx = np.clip((c + 1.0) / 2.0 * np.array([39, 40, 41]), 0, None)
            ref = map_coordinates(G, idx, order=1, mode="nearest")
            err = max(err, abs(float(r[i]) - float(ref)))
        log("  trilinear-on-GPU maxerr vs scipy = %.3e" % err)
    except Exception as e:
        log("  trilinear FAIL", str(e)[:400])


# ---------- 11. 3D device array captured in device function (not passed as arg)
@cuda.jit
def k_cap(o, g, pal):
    i = cuda.grid(1)
    if i < o.shape[0]:
        o[i] = d_tril(g, g.shape[0], g.shape[1], g.shape[2], -1.0, -1.0, -1.0,
                      0.05, 0.05, 0.05, 0.1 * i - 1.0, 0.0, 0.0) \
            + pal[i % pal.shape[0], 0]


def t_cap():
    try:
        G = (np.random.rand(40, 41, 42)).astype(np.float32)
        P = np.arange(256 * 3, dtype=np.float32).reshape(256, 3)
        dG = cuda.to_device(G)
        dP = cuda.to_device(P)
        dO = cuda.to_device(np.zeros(8, np.float32))
        k_cap[1, 8](dO, dG, dP)
        cuda.synchronize()
        log("  captured 3D-array + palette-LUT in kernel OK:", dO.copy_to_host()[:3])
    except Exception as e:
        log("  captured FAIL", str(e)[:400])


# ---------- 12. float32 kernel arg vs float64 python float
def t_scalar_type():
    @cuda.jit
    def k_s(o, a, b):
        i = cuda.grid(1)
        if i < o.shape[0]:
            o[i] = a * b
    try:
        dO = cuda.to_device(np.zeros(4, np.float32))
        k_s[1, 4](dO, 0.62, 1.1e-4)
        cuda.synchronize()
        log("  python-float scalar args OK:", dO.copy_to_host())
    except Exception as e:
        log("  scalar FAIL", str(e)[:300])
    try:
        dO = cuda.to_device(np.zeros(4, np.float64))
        k_s2[1, 4](dO, np.float32(0.62), np.float32(1.1e-4))
        cuda.synchronize()
        log("  np.float32 scalar args OK")
    except Exception as e:
        log("  np.float32 scalar FAIL", str(e)[:300])


@cuda.jit
def k_s2(o, a, b):
    i = cuda.grid(1)
    if i < o.shape[0]:
        o[i] = a * b


def main():
    for name, fn in [("math", t_math), ("numpy", t_np), ("tuple", t_tuple),
                     ("args", t_args), ("2dgrid", t_2d), ("cfg", t_cfg),
                     ("carray", t_carray), ("scalar", t_scalar_type),
                     ("trilinear", t_tri), ("capture", t_cap),
                     ("biggrid", t_big), ("bench", t_bench)]:
        log("=== " + name)
        try:
            fn()
        except Exception as e:
            import traceback
            log("  EXC " + str(e)[:500])


if __name__ == "__main__":
    main()
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir, "_out", "_probe3_out.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(OUT))