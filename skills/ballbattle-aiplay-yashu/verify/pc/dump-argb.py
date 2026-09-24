# -*- coding: utf-8 -*-
# 把手机截图按生产口径降采样成 400x180 ARGB 原始像素，供 Node 端"真代码重放"用
# 用法: python dump-argb.py <jpg...> --out <dir>
import sys, os
from PIL import Image

W, H = 400, 180
args = sys.argv[1:]
out_dir = r"D:/empty/_calib/argb"
if "--out" in args:
    i = args.index("--out")
    if i + 1 >= len(args):
        sys.exit("dump-argb.py: --out 后面缺目录参数")
    out_dir = args[i + 1]
    del args[i:i + 2]        # 必须摘掉，否则 --out 的值会被当成输入图（旧版就是这么崩的）
srcs = [a for a in args if not a.startswith("--")]
if not srcs:
    sys.exit("dump-argb.py: 没有输入图。用法: python dump-argb.py <jpg...> --out <dir>")
os.makedirs(out_dir, exist_ok=True)
for p in srcs:
    img = Image.open(p).convert("RGB").resize((W, H), Image.BOX)
    buf = bytearray()
    px = img.load()
    for y in range(H):
        for x in range(W):
            r, g, b = px[x, y]
            v = (255 << 24) | (r << 16) | (g << 8) | b      # ARGB，与 getPixels 口径一致（含 alpha）
            buf += v.to_bytes(4, "little", signed=False)
    name = os.path.splitext(os.path.basename(p))[0]
    q = os.path.join(out_dir, name + ".argb")
    open(q, "wb").write(buf)
    print("wrote", q, len(buf), "bytes")
