# -*- coding: utf-8 -*-
"""Pin down scipy's boundary convention exactly, then verify a candidate
index-mapping against scipy on a 1-D array."""
import numpy as np
from scipy.ndimage import gaussian_filter1d

LOG = []


def log(*a):
    s = " ".join(str(x) for x in a)
    LOG.append(s)
    print(s, flush=True)


n = 7
sigma = 1.3
a = np.arange(n, dtype=np.float64) + 1.0     # 1..7, easy to reason about
w, r = None, int(4.0 * sigma + 0.5)
x = np.arange(-r, r + 1, dtype=np.float64)
wt = np.exp(-0.5 * (x / sigma) ** 2)
wt /= wt.sum()

ref = gaussian_filter1d(a, sigma, mode="reflect")
log("input :", a)
log("scipy reflect:", np.round(ref, 5))

# candidate A: half-sample symmetric  (d c b a | a b c d)  index -1 -> 0
def idxA(i, n):
    while i < 0 or i >= n:
        i = -i - 1 if i < 0 else 2 * n - 1 - i
    return i


# candidate B: whole-sample symmetric (d c b | a b c d | c b a) index -1 -> 1
def idxB(i, n):
    if i < 0:
        i = -1 - i          # -1 -> 1, -2 -> 2
    elif i >= n:
        i = 2 * n - 1 - i   # n -> n-1, n+1 -> n-2
    # may still be out of range for very large offsets; fold again
    while i < 0 or i >= n:
        i = -i - 1 if i < 0 else 2 * n - 1 - i
    return i


# candidate C: clamp (edge replication)
def idxC(i, n):
    return min(max(i, 0), n - 1)


for name, f in (("A half-sample", idxA), ("B whole-sample", idxB),
                ("C clamp", idxC)):
    out = np.zeros(n)
    for i in range(n):
        s = 0.0
        for k in range(-r, r + 1):
            s += wt[k + r] * a[f(i + k, n)]
        out[i] = s
    log("%-18s maxdiff=%.3e" % (name, np.abs(out - ref).max()), np.round(out, 5))

log("")
log("r=%d weights=%s" % (r, np.round(wt, 4)))

with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir, "_out", "_edge_out.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(LOG))