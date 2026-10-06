# -*- coding: utf-8 -*-
"""Probe numba-cuda-mlir API surface: what actually compiles and runs."""
import numpy as np
from numba_cuda_mlir import cuda

OUT = []


def log(*a):
    s = " ".join(str(x) for x in a)
    OUT.append(s)
    print(s, flush=True)


log("cuda module:", cuda)
try:
    from numba_cuda_mlir import carray
    log("carray OK", carray)
except Exception as e:
    carray = None
    log("carray FAIL", repr(e))

log("libdevice attrs sample:")
ld = cuda.libdevice
names = [n for n in dir(ld) if not n.startswith("_")]
log("  count", len(names))
log("  sin cos tan fabs sqrt exp log pow floor ceil",
    all(hasattr(ld, n) for n in
        ["sin", "cos", "tan", "fabs", "sqrt", "exp", "log", "pow",
         "floor", "ceil", "atan2", "abs2", "fmax", "fmin", "exp2"]))
log("  has rsqrt/rcp/erf/tanh/asin/acos:", [n for n in ["rsqrt", "rcp", "erf", "tanh", "asin", "acos", "atan", "sinf", "cosf"] if hasattr(ld, n)])


# ---------------------------------------------------------------- device fn
@cuda.jit(device=True)
def fld_gyroid(x, y, z):
    return (cuda.libdevice.cos(x) * cuda.libdevice.cos(y)
            + cuda.libdevice.cos(y) * cuda.libdevice.cos(z)
            + cuda.libdevice.cos(z) * cuda.libdevice.cos(x))


@cuda.jit(device=True)
def fld_dispatch(kind, x, y, z):
    if kind == 0:
        return fld_gyroid(x, y, z)
    elif kind == 1:
        r = cuda.libdevice.sqrt(x * x + y * y + z * z) + 1e-9
        ct = cuda.libdevice.fmin(cuda.libdevice.fmax(z / r, -1.0), 1.0)
        st = cuda.libdevice.sqrt(cuda.libdevice.fmax(1.0 - ct * ct, 1e-12))
        phi = cuda.libdevice.atan2(y, x)
        c = cuda.libdevice.fabs(cuda.libdevice.cos(6.0 * phi) / 1.0)
        t1 = c ** 9.0
        t2 = cuda.libdevice.fabs(cuda.libdevice.sin(6.0 * phi / 4.0)) ** 9.0
        ra = (t1 + t2) ** (-1.0 / 0.30)
        if ra > 2.2:
            ra = 2.2
        lat = 0.45 + 0.55 * st
        target = ra * lat
        if target > 1.35:
            target = 1.35
        return r - target
    else:
        return (x * x + y * y + z * z - 1.0) ** 3 - x * x * y * y * z * z


# ------------------------------------------------------- kernel: grid trilin
@cuda.jit
def kern(out, kind, sdf, nx, ny, nz, lo0, lo1, lo2, h0, h1, h2, n):
    i = cuda.grid(1)
    if i >= n:
        return
    # 1) analytic dispatch, 2) trilinear on flat 1D sdf
    if kind == 9:
        gx = i * h0 + lo0
        gy = i * h1 + lo1
        gz = i * h2 + lo2
        fx = (gx - lo0) / h0
        fx = fx - float(int(fx))
        fx = fx if fx >= 0.0 else fx + 1.0
        fy = gy / h1
        fy = fy - float(int(fy))
        fz = gz / h2
        fz = fz - float(int(fz))
        ix = min(int(fx), nx - 2)
        iy = min(int(fy), ny - 2)
        iz = min(int(fz), nz - 2)
        a = fx - float(ix)
        b = fy - float(iy)
        c = fz - float(iz)
        base = (ix * ny + iy) * nz + iz
        c000 = sdf[base]
        c100 = sdf[base + ny * nz]
        c010 = sdf[base + nz]
        c110 = sdf[base + ny * nz + nz]
        c001 = sdf[base + 1]
        c101 = sdf[base + ny * nz + 1]
        c011 = sdf[base + nz + 1]
        c111 = sdf[base + ny * nz + nz + 1]
        c00 = c000 + (c100 - c000) * a
        c10 = c010 + (c110 - c010) * a
        c01 = c001 + (c101 - c001) * a
        c11 = c011 + (c111 - c011) * a
        c0 = c00 + (c10 - c00) * b
        c1 = c01 + (c11 - c01) * b
        out[i] = c0 + (c1 - c0) * c
    else:
        x = i * 0.01
        out[i] = fld_dispatch(kind, x, x * 0.5, x * 0.25)


# --------------------------------------------------- kernel: march + normal
@cuda.jit
def kern_march(hit, tp, out, kind, lo, hi, k, eps, maxsteps, minstep):
    i = cuda.grid(1)
    if i >= hit.shape[0]:
        return
    # simple analytic ray along +x from a grid of rays
    rox = -3.0
    roy = (i % 64) * 0.1 - 3.2
    roz = (i // 64) * 0.1 - 3.2
    rdx = 1.0
    rdy = 0.0
    rdz = 0.0
    t = 0.0
    tmax = 6.0
    pd = 0.0
    h = False
    th = 0.0
    for _ in range(maxsteps):
        p0 = rox + rdx * t
        p1 = roy + rdy * t
        p2 = roz + rdz * t
        d = fld_dispatch(kind, p0, p1, p2)
        ad = cuda.libdevice.fabs(d)
        if ad < eps:
            h = True
            th = t
            break
        # sign flip
        if (d > 0.0) != (pd > 0.0) and pd != 0.0:
            a = t - k * cuda.libdevice.fabs(pd)
            b = t
            sa = pd
            for _ in range(8):
                m = 0.5 * (a + b)
                sm = fld_dispatch(kind, rox + rdx * m, roy + rdy * m, roz + rdz * m)
                same = (sm > 0.0) == (sa > 0.0)
                if same:
                    a = m
                else:
                    b = m
            h = True
            th = 0.5 * (a + b)
            break
        st = k * ad
        if st < minstep:
            st = minstep
        t = t + st
        pd = d
        if t > tmax:
            break
    hit[i] = h
    tp[i] = th
    if h:
        p0 = rox + rdx * th
        p1 = roy + rdy * th
        p2 = roz + rdz * th
        e = eps * 1.6
        gx = fld_dispatch(kind, p0 + e, p1, p2) - fld_dispatch(kind, p0 - e, p1, p2)
        gy = fld_dispatch(kind, p0, p1 + e, p2) - fld_dispatch(kind, p0, p1 - e, p2)
        gz = fld_dispatch(kind, p0, p1, p2 + e) - fld_dispatch(kind, p0, p1, p2 - e)
        n = cuda.libdevice.sqrt(gx * gx + gy * gy + gz * gz) + 1e-20
        out[i] = (gx / n) * 0.5 + (gy / n) * 0.5 + (gz / n) * 0.5
    else:
        out[i] = -1.0


def main():
    n = 4096
    # --- analytic dispatch test
    try:
        out = np.zeros(n, np.float32)
        d_out = cuda.to_device(out)
        kern[128, 128](d_out, 0, d_out, nx, ny, nz, 0.0, 0.0, 0.0,
                       1.0, 1.0, 1.0, n)
        cuda.synchronize()
        res = d_out.copy_to_host()
        log("TEST analytic kind=0 OK, out[100]=", res[100])
        ref = (np.cos(1.0) * np.cos(0.5) + np.cos(0.5) * np.cos(0.25)
               + np.cos(0.25) * np.cos(1.0))
        log("  ref", ref, "diff", abs(float(res[100]) - ref))
    except Exception as e:
        import traceback
        log("TEST analytic FAIL", repr(e))
        traceback.print_exc()

    for kd in (1, 2):
        try:
            out = np.zeros(n, np.float32)
            d_out = cuda.to_device(out)
            kern[128, 128](d_out, kd, d_out, 1, 1, 1, 0.0, 0.0, 0.0,
                           1.0, 1.0, 1.0, n)
            cuda.synchronize()
            res = d_out.copy_to_host()
            log("TEST analytic kind=%d OK out[100]=%s" % (kd, res[100]))
        except Exception as e:
            log("TEST analytic kind=%d FAIL %r" % (kd, e))

    # --- trilinear test
    try:
        nx = ny = nz = 8
        g = np.linspace(-1, 1, nx)
        X, Y, Z = np.meshgrid(g, g, g, indexing="ij")
        sdf = (X + 2 * Y - 3 * Z).astype(np.float32)
        d_sdf = cuda.to_device(sdf.ravel().copy())
        out = np.zeros(n, np.float32)
        d_out = cuda.to_device(out)
        kern[128, 128](d_out, 9, d_sdf, nx, ny, nz, -1.0, -1.0, -1.0,
                       2.0 / 7, 2.0 / 7, 2.0 / 7, n)
        cuda.synchronize()
        res = d_out.copy_to_host()
        # reference trilinear for fractional coords
        from scipy.ndimage import map_coordinates
        err = 0.0
        for i in range(0, 200):
            c = [(i * 2.0 / 7) % 2 - 1, (i * 2.0 / 7 * 0.5) % 2 - 1, (i * 0.11) % 2 - 1]
            c = [float(np.clip(v, -1, 1)) for v in c]
            idx = [(c[j] + 1) / 2 * 7 for j in range(3)]
            ref = map_coordinates(sdf, np.array([idx]), order=1, mode="nearest")[0]
            err = max(err, abs(float(res[i]) - ref))
        log("TEST trilinear OK maxerr=", err)
    except Exception as e:
        import traceback
        log("TEST trilinear FAIL", repr(e))
        traceback.print_exc()

    # --- march test on gyroid, compare with CPU
    try:
        N = 64 * 64
        hit_d = cuda.to_device(np.zeros(N, np.bool_))
        tp_d = cuda.to_device(np.zeros(N, np.float32))
        o_d = cuda.to_device(np.zeros(N, np.float32))
        L = 1.05 * np.pi
        kern_march[16, 16](hit_d, tp_d, o_d, 0, -L, L, 0.62, 1.1e-4 * 2 * L, 300, 1e-5)
        cuda.synchronize()
        gh = hit_d.copy_to_host()
        gt = tp_d.copy_to_host()
        go = o_d.copy_to_host()

        def cpufield(x, y, z):
            return (np.cos(x) * np.cos(y) + np.cos(y) * np.cos(z)
                    + np.cos(z) * np.cos(x))
        ch = np.zeros(N, bool)
        ct = np.zeros(N)
        for i in range(N):
            roy = (i % 64) * 0.1 - 3.2
            roz = (i // 64) * 0.1 - 3.2
            t = 0.0
            pd = 0.0
            for s in range(300):
                d = cpufield(-3.0 + t, roy, roz)
                ad = abs(d)
                if ad < 1.1e-4 * 2 * L:
                    ch[i] = True
                    ct[i] = t
                    break
                if (d > 0) != (pd > 0) and pd != 0:
                    a = t - 0.62 * abs(pd)
                    b = t
                    sa = pd
                    for _ in range(8):
                        m = 0.5 * (a + b)
                        sm = cpufield(-3.0 + m, roy, roz)
                        same = (sm > 0) == (sa > 0)
                        if same:
                            a = m
                        else:
                            b = m
                    ch[i] = True
                    ct[i] = 0.5 * (a + b)
                    break
                t = t + max(0.62 * ad, 1e-5)
                pd = d
                if t > 6.0:
                    break
        log("TEST march hits gpu=%d cpu=%d agree=%d" % (gh.sum(), ch.sum(), (gh == ch).sum()))
        m = gh & ch
        if m.sum():
            log("  t maxdiff", np.abs(gt[m] - ct[m]).max())
    except Exception as e:
        import traceback
        log("TEST march FAIL", repr(e))
        traceback.print_exc()

    # --- 3D array indexing in kernel?
    try:
        @cuda.jit
        def k3(o, a):
            i = cuda.grid(1)
            if i < a.shape[0]:
                o[i] = a[i, 1, 2]

        A = np.arange(4 * 3 * 5, dtype=np.float32).reshape(4, 3, 5)
        dA = cuda.to_device(A)
        dO = cuda.to_device(np.zeros(4, np.float32))
        k3[1, 4](dO, dA)
        cuda.synchronize()
        log("TEST 3D-index OK", dO.copy_to_host())
    except Exception as e:
        log("TEST 3D-index FAIL", repr(e))

    # --- write into 3D output from kernel
    try:
        @cuda.jit
        def k3w(o):
            i = cuda.grid(1)
            if i < o.shape[0]:
                o[i, 2, 1] = float(i)

        dO = cuda.to_device(np.zeros((8, 3, 2), np.float32))
        k3w[1, 8](dO)
        cuda.synchronize()
        log("TEST 3D-write OK", dO.copy_to_host()[:, 2, 1])
    except Exception as e:
        log("TEST 3D-write FAIL", repr(e))

    # --- float64 support?
    try:
        @cuda.jit
        def k64(o):
            i = cuda.grid(1)
            if i < o.shape[0]:
                o[i] = math_sqrt(float(i))

        @cuda.jit(device=True)
        def math_sqrt(v):
            return cuda.libdevice.sqrt(v)

        dO = cuda.to_device(np.zeros(8, np.float64))
        k64[1, 8](dO)
        cuda.synchronize()
        log("TEST float64 OK", dO.copy_to_host()[:3])
    except Exception as e:
        log("TEST float64 FAIL", repr(e))

    # --- python `math` module in device fn?
    try:
        @cuda.jit(device=True)
        def dmath(v):
            return math.sin(v)

        @cuda.jit
        def km(o):
            i = cuda.grid(1)
            if i < o.shape[0]:
                o[i] = dmath(float(i))

        dO = cuda.to_device(np.zeros(8, np.float32))
        km[1, 8](dO)
        cuda.synchronize()
        log("TEST math.sin OK", dO.copy_to_host()[:3])
    except Exception as e:
        log("TEST math.sin FAIL", repr(e))

    # --- np.isfinite / nan handling
    try:
        @cuda.jit
        def knf(o, a):
            i = cuda.grid(1)
            if i < a.shape[0]:
                v = a[i]
                o[i] = 0.0 if v != v else 1.0

        dA = cuda.to_device(np.array([np.nan, 1.0, np.inf, -np.inf], np.float32))
        dO = cuda.to_device(np.zeros(4, np.float32))
        knf[1, 4](dO, dA)
        cuda.synchronize()
        log("TEST nan-detect OK", dO.copy_to_host())
    except Exception as e:
        log("TEST nan-detect FAIL", repr(e))


import math  # noqa

if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback
        traceback.print_exc()
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir, "_out", "_probe_out.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(OUT))