# -*- coding: utf-8 -*-
"""正确性校验：把 draw_solar.js 里的归一化数据按当前 board 还原成绝对坐标，
与原始成功稿 batch/b1..b7.json 逐点比对，误差应 <=1px。
stage b3 的原稿 = batch b3.json（水星/地球/斑块）+ batch b7.json（云朵）。"""
import json, io, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
JS = os.path.join(os.path.dirname(os.path.dirname(HERE)), "draw_solar.js")
SRC = os.path.join(HERE, "batch")
CX, CY, R = 1510, 720, 544

s = io.open(JS, encoding="utf-8").read()
m = re.search(r"var SOLAR = (\{.*?\});\n", s, re.S)
if not m:
    m = re.search(r"var SOLAR = (\{.*\});", s, re.S)
solar = json.loads(m.group(1))
print("解析出 stages:", len(solar["stages"]), "palette:", solar["palette"])

old = {}
for bk in ["b1", "b2", "b3", "b4", "b5", "b6"]:
    old[bk] = json.load(io.open(os.path.join(SRC, bk + ".json"), encoding="utf-8"))["ops"]
old["b3"] = old["b3"] + json.load(io.open(os.path.join(SRC, "b7.json"), encoding="utf-8"))["ops"]

total = 0
maxerr = 0
bad = []
for st in solar["stages"]:
    sid = st["id"]
    if sid == "bg":
        continue
    src_ops = [o for o in old[sid] if o.get("act") == "path"]
    new_ops = [o for o in st["ops"] if o.get("act") == "path"]
    assert len(src_ops) == len(new_ops), (sid, len(src_ops), len(new_ops))
    for a, b in zip(src_ops, new_ops):
        assert len(a["points"]) == len(b["uv"]), (sid, len(a["points"]), len(b["uv"]))
        for (sx, sy), (u, v) in zip(a["points"], b["uv"]):
            x = round(CX + u * R)
            y = round(CY + v * R)
            e = max(abs(x - sx), abs(y - sy))
            total += 1
            maxerr = max(maxerr, e)
            if e > 1:
                bad.append((sid, (sx, sy), (x, y), e))
        if a.get("duration") != b.get("duration"):
            bad.append((sid, "duration", a.get("duration"), b.get("duration")))
print("比对点数 =", total, "最大误差 =", maxerr, "px  越界 =", len(bad))
if bad:
    for row in bad[:10]:
        print("  ", row)
else:
    print("全部还原一致 ✅")
