# -*- coding: utf-8 -*-
"""Probe 2: isolate the boolean-comparison discrepancy found in probe 1."""
import numpy as np
import math
from numba_cuda_mlir import cuda

OUT = []


def log(*a):
    s = " ".join(str(x) for x in a)
    OUT.append(s)
    print(s, flush=True)


# ---- which libdevice names exist
names = [n for n in dir(cuda.libdevice) if not n.startswith("_")]
want = ["sin", "cos", "tan", "fabs", "sqrt", "exp", "log", "pow", "floor",
        "ceil", "atan2", "abs2", "fmax", "fmin", "max", "min", "exp2",
        "isnan", "isinf", "trunc", "fma", "powf", "sign"]
log("present:", [w for w in want if w in names])
log("MISSING:", [w for w in want if w not in names])


@cuda.jit
def k_bool(o, a):
    i = cuda.grid(1)
    if i >= o.shape[0]:
        return
    x = a[i]
    # 10 separate tests, one per output slot
    j = i * 8
    o[j + 0] = 1.0 if (x > 0.0) else 0.0
    o[j + 1] = 1.0 if (x < 0.0) else 0.0
    o[j + 2] = 1.0 if (x == 0.0) else 0.0
    b1 = (x > 0.0)
    b2 = (x < 0.0)
    o[j + 3] = 1.0 if (b1 != b2) else 0.0
    o[j + 4] = 1.0 if (b1 == b2) else 0.0
    o[j + 5] = 1.0 if ((b1 != b2) and True) else 0.0
    # xor via float compare
    o[j + 6] = 1.0 if (float(b1) != float(b2)) else 0.0
    o[j + 7] = 1.0 if (math.copysign(1.0, x) != math.copysign(1.0, 1.0)) else 0.0


def t_bool():
    A = np.array([1.0, -1.0, 0.0, np.nan, np.inf, -np.inf, 1e-40, -1e-40], np.float32)
    dA = cuda.to_device(A)
    dO = cuda.to_device(np.zeros(len(A) * 8, np.float32))
    k_bool[1, len(A)](dO, dA)
    cuda.synchronize()
    o = dO.copy_to_host().reshape(-1, 8)
    hdr = [">0", "<0", "==0", "b1!=b2", "b1==b2", "and", "f!=f", "copysign"]
    log("  value        " + "".join("%-10s" % h for h in hdr))
    for i, v in enumerate(A):
        log("  %-12s " % str(v) + "".join("%-10d" % int(t) for t in o[i]))


# ---- arithmetic bool ops
@cuda.jit
def k_arith(o):
    i = cuda.grid(1)
    if i >= o.shape[0]:
        return
    b1 = i == 0
    b2 = i == 1
    o[i * 3 + 0] = float(int(b1) + int(b2))
    o[i * 3 + 1] = 1.0 if (b1 or b2) else 0.0
    o[i * 3 + 2] = 1.0 if (not b1) else 0.0


def t_arith():
    n = 4
    dO = cuda.to_device(np.zeros(n * 3, np.float32))
    k_arith[1, n](dO)
    cuda.synchronize()
    log("  arith (i,b1+b2,or,not b1):")
    log("  " + str(dO.copy_to_host().reshape(-1, 3)).replace("\n", " "))


# ---- isnan via libdevice
@cuda.jit
def k_nan(o, a):
    i = cuda.grid(1)
    if i >= o.shape[0]:
        return
    x = a[i]
    o[i * 4 + 0] = 1.0 if cuda.libdevice.isnan(x) else 0.0
    o[i * 4 + 1] = 1.0 if cuda.libdevice.isinf(x) else 0.0
    o[i * 4 + 2] = 1.0 if (x != x) else 0.0
    o[i * 4 + 3] = 1.0 if math.isnan(x) else 0.0


def t_nan():
    A = np.array([1.0, np.nan, np.inf, -np.inf], np.float32)
    dA = cuda.to_device(A)
    dO = cuda.to_device(np.zeros(len(A) * 4, np.float32))
    k_nan[1, len(A)](dO, dA)
    cuda.synchronize()
    o = dO.copy_to_host().reshape(-1, 4)
    log("  nan probes [libdevice.isnan, isinf, x!=x, math.isnan]:")
    for i, v in enumerate(A):
        log("   ", v, o[i])


# ---- reproduce the march sign-flip test in isolation
@cuda.jit
def k_flip(hit, a, b):
    i = cuda.grid(1)
    if i >= hit.shape[0]:
        return
    d = a[i]
    pd = b[i]
    ad = cuda.libdevice.fabs(d)
    if ad < 1e-4:
        hit[i] = 1        # close
        return
    if (d > 0.0) != (pd > 0.0):
        if pd != 0.0:
            hit[i] = 2    # flip
            return
    hit[i] = 0


def t_flip():
    A = np.array([1.0, -1.0, 1e-6, -1e-6, 1.0, -1.0, 1.0, -1.0], np.float32)
    B = np.array([-1.0, 1.0, 1.0, -1.0, 0.0, 0.0, -1.0, 1.0], np.float32)
    dA, dB = cuda.to_device(A), cuda.to_device(B)
    dH = cuda.to_device(np.zeros(len(A), np.int32))
    k_flip[1, len(A)](dH, dA, dB)
    cuda.synchronize()
    log("  d / pd  ->  hit(0 none,1 close,2 flip)")
    for i in range(len(A)):
        log("   %8g %8g -> %d" % (A[i], B[i], dH.copy_to_host()[i]))


# ---- combined short-circuit and/or with early return inside nested if
@cuda.jit
def k_nest(o, a):
    i = cuda.grid(1)
    if i >= o.shape[0]:
        return
    x = a[i]
    r = 0.0
    if x > 0.0:
        if x > 10.0:
            r = 1.0
        else:
            r = 2.0
    else:
        if x < -10.0:
            r = 3.0
        else:
            r = 4.0
    o[i] = r


def t_nest():
    A = np.array([5.0, 50.0, -5.0, -50.0], np.float32)
    dA = cuda.to_device(A)
    dO = cuda.to_device(np.zeros(4, np.float32))
    k_nest[1, 4](dO, dA)
    cuda.synchronize()
    log("  nested if/else:", dO.copy_to_host(), "expect[2,1,4,3]")


# ---- does a bool survive as a local across statements?
@cuda.jit
def k_carry(o, a):
    i = cuda.grid(1)
    if i >= o.shape[0]:
        return
    x = a[i]
    b1 = (x > 0.0)
    s = 0.0
    if b1:
        s = 1.0
    b2 = (x < 0.0)
    if b2:
        s = s + 10.0
    o[i] = s


def t_carry():
    A = np.array([1.0, -1.0, 0.0, 1.0], np.float32)
    dA = cuda.to_device(A)
    dO = cuda.to_device(np.zeros(4, np.float32))
    k_carry[1, 4](dO, dA)
    cuda.synchronize()
    log("  carried bool:", dO.copy_to_host(), "expect[1,10,0,1]")


# ---- int32 loop with break inside for
@cuda.jit
def k_loop(o, n):
    i = cuda.grid(1)
    if i >= o.shape[0]:
        return
    s = 0.0
    for j in range(n):
        if j > 3:
            break
        s += float(j)
    o[i] = s


def t_loop():
    dO = cuda.to_device(np.zeros(4, np.float32))
    k_loop[1, 4](dO, 10)
    cuda.synchronize()
    log("  loop+break:", dO.copy_to_host(), "expect[6,6,6,6]")


# ---- while loop
@cuda.jit
def k_while(o):
    i = cuda.grid(1)
    if i >= o.shape[0]:
        return
    t = 0.0
    while t < 5.0:
        t += 1.0
    o[i] = t


def t_while():
    dO = cuda.to_device(np.zeros(4, np.float32))
    k_while[1, 4](dO)
    cuda.synchronize()
    log("  while:", dO.copy_to_host(), "expect[5,5,5,5]")


# ---- nested device function with loop
@cuda.jit(device=True)
def shadow(x, y, z):
    s = 1.0
    t = 0.015
    for _ in range(22):
        d = math.cos(x + 0.6 * t) * math.cos(y + 0.6 * t) * math.cos(z + 0.6 * t)
        r = 8.0 * d / t
        if r < s:
            s = r
        t = t + min(max(d, 0.03), 0.34)
    return min(max(s, 0.0), 1.0)


@cuda.jit
def k_devfn(o, n):
    i = cuda.grid(1)
    if i >= o.shape[0]:
        return
    o[i] = shadow(0.1 * i, 0.2, 0.3)


def t_devfn():
    dO = cuda.to_device(np.zeros(8, np.float32))
    k_devfn[1, 8](dO, 22)
    cuda.synchronize()
    log("  device fn w/ loop:", dO.copy_to_host()[:4])


def main():
    for name, fn in [("bool", t_bool), ("arith", t_arith), ("nan", t_nan),
                     ("flip", t_flip), ("nested", t_nest), ("carry", t_carry),
                     ("loop", t_loop), ("while", t_while), ("devfn", t_devfn)]:
        log("=== " + name)
        try:
            fn()
        except Exception as e:
            import traceback
            traceback.print_exc()
            log("  FAIL " + repr(e))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback
        traceback.print_exc()
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir, "_out", "_probe2_out.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(OUT))