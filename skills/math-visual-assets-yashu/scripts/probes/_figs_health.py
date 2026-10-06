# -*- coding: utf-8 -*-
"""成品图体检：对 assets/figs 下所有 PNG 报 max / std / 主体像素占比。

阈值（与 timings-22.md §七 一致）：max >= 0.53、std >= 0.074、subj >= 1%。

预期会有 3 张被标（形态使然，不是缺陷，不要"修"）：
  * 17_lorenz / 18_dejong  -> DARK（细丝 / 云雾状，刻意压低曝光）
  * 12_gabriel_horn       -> LOWCONTRAST（y = 1/x 极细长，对比度天然低）
真实全局最小值：max = 0.47、std = 0.058。

用法：
    python _figs_health.py
"""
import glob
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.join(HERE, os.pardir, os.pardir)
D = os.path.join(SKILL, "assets", "figs")

bad = []
for p in sorted(glob.glob(os.path.join(D, "*.png"))):
    a = np.asarray(Image.open(p).convert("L"), np.float32) / 255.0
    med = np.median(a, axis=1, keepdims=True)
    subj = float((np.abs(a - med) > 0.02).mean())
    flag = ""
    if a.max() < 0.53:
        flag += " DARK"
    if a.std() < 0.074:
        flag += " LOWCONTRAST"
    if subj < 0.01:
        flag += " SPARSE"
    if flag:
        bad.append(os.path.basename(p))
    print("%-24s max=%.2f std=%.3f subj=%.2f%%%s"
          % (os.path.basename(p), a.max(), a.std(), subj * 100, flag))
print("\ncount =", len(glob.glob(os.path.join(D, "*.png"))))
print("flagged:", bad if bad else "none")
print("expect  : ['12_gabriel_horn.png', '17_lorenz.png', '18_dejong.png']")

