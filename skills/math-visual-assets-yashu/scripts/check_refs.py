# -*- coding: utf-8 -*-
"""Check that the gallery page and the image folder agree.

Verifies three things:
  1. every image referenced by index.html exists on disk
  2. no image is left unreferenced (orphans)
  3. the reference count matches the expected gallery size

Paths resolve relative to this file, so it can be run from any cwd.
"""
import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.dirname(HERE)
HTML = os.path.join(SKILL, "assets", "index.html")
FIGS = os.path.join(SKILL, "assets", "figs")
EXPECTED = 22          # 画廊图数量；新增图形时同步改这里

if not os.path.exists(HTML):
    sys.exit("index.html not found at %s" % HTML)
if not os.path.isdir(FIGS):
    sys.exit("figs/ not found at %s" % FIGS)

s = io.open(HTML, encoding="utf-8").read()
html = s
keys = re.findall(r'k:"([a-z0-9_]+)"', s)

print("refs:", len(keys))

missing = [k for k in keys
           if not os.path.exists(os.path.join(FIGS, k + ".png"))]
print("missing imgs:", missing if missing else "none")

have = {f[:-4] for f in os.listdir(FIGS) if f.endswith(".png")}
extra = sorted(have - set(keys))
print("unused figs:", extra if extra else "none")

if len(keys) != EXPECTED:
    print("WARNING: expected %d refs, found %d" % (EXPECTED, len(keys)))
if missing or extra or len(keys) != EXPECTED:
    sys.exit(1)

# cross-check the page's own structure: grid containers vs DATA entries
ids = re.findall(r'id="(g\d+)"', html)
data = re.findall(r'g:"(g\d+)",\s*k:"([a-z0-9_]+)"', html)
ghosts = sorted({g for g, _ in data} - set(ids))
orphans = sorted(set(ids) - {g for g, _ in data})
dupes = sorted({k for _, k in data
                if [k2 for _, k2 in data].count(k) > 1})
print("grid containers:", len(ids), "| DATA entries:", len(data))
print("ghost containers:", ghosts if ghosts else "none")
print("orphan containers:", orphans if orphans else "none")
print("duplicate keys:", dupes if dupes else "none")
if ghosts or orphans or dupes:
    sys.exit(1)

print("OK: gallery consistent (%d images, %d sections)"
      % (len(keys), len(ids)))
