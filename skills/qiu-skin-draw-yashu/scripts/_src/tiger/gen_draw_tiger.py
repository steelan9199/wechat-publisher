# -*- coding: utf-8 -*-
"""把本次成功稿 b1..b6.json 的绝对坐标反归一化 -> 生成自包含 AutoJS 脚本 draw_tiger.js
约定: u=(x-cx)/r, v=(y-cy)/r  (cx,cy,r 来自手机存储 qiu-board/board)
"""
import json, os, io

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = HERE   # 本目录内的 b1~b6.json 原始坐标
OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), "draw_tiger.js")

CX, CY, R = 1510.0, 720.0, 544.0

SLOTS = {
    "b1": ["bg", "ear", "inner"],
    "b2": ["eye"],
    "b3": ["muzzle"],
    "b4": ["pupil", "shine", "nose"],
    "b5": ["mouth"],
    "b6": ["cheek"],
}
TITLE = {
    "b1": "黄三角耳 + 品红内耳",
    "b2": "白眼眶",
    "b3": "白吻部",
    "b4": "蓝瞳 + 浅蓝高光 + 品红鼻",
    "b5": "红嘴 + 额头三道条纹",
    "b6": "颊纹 + 胡须点",
}
PALETTE = {
    "bg": "orange", "ear": "yellow", "inner": "magenta", "eye": "white",
    "muzzle": "white", "pupil": "blue", "shine": "lightblue",
    "nose": "magenta", "mouth": "red", "cheek": "red",
}


def uv(p):
    return [round((p[0] - CX) / R, 4), round((p[1] - CY) / R, 4)]


tiger = {"version": "1.0", "subject": "老虎脸",
         "geo": "uv = ((x-cx)/r, (y-cy)/r)",
         "palette": PALETTE, "stages": []}

tiger["stages"].append({
    "id": "bg", "title": "铺整脸底色",
    "ops": [{"act": "bg", "slot": "bg"}],
})

for bkey in ["b1", "b2", "b3", "b4", "b5", "b6"]:
    with io.open(os.path.join(SRC, bkey + ".json"), encoding="utf-8") as f:
        data = json.load(f)
    slots = SLOTS[bkey]
    si = 0
    ops = []
    for op in data["ops"]:
        act = op.get("act")
        if act in ("bg", "border"):
            ops.append({"act": act, "slot": slots[si]})
            si += 1
            continue
        if act == "color":
            ops.append({"act": "color", "slot": slots[si]})
            si += 1
            continue
        if act == "size":
            ops.append({"act": "size", "size": op["size"]})
            continue
        if act == "tool":
            ops.append({"act": "tool", "tool": op["tool"]})
            continue
        if act == "path":
            ops.append({
                "act": "path",
                "duration": op.get("duration", 1500),
                "uv": [uv(p) for p in op["points"]],
            })
            continue
        if act == "wait":
            ops.append({"act": "wait", "ms": op.get("ms", 300)})
            continue
        raise SystemExit("unsupported act: " + act)
    assert si == len(slots), (bkey, si, len(slots))
    tiger["stages"].append({"id": bkey, "title": TITLE[bkey], "ops": ops})

data_js = json.dumps(tiger, ensure_ascii=False, separators=(",", ":"))
nstage = len(tiger["stages"])
npath = sum(1 for s in tiger["stages"] for o in s["ops"] if o["act"] == "path")
print("stages=%d paths=%d data_bytes=%d" % (nstage, npath, len(data_js)))

with io.open(os.path.join(HERE, "draw_tiger_body.js"), encoding="utf-8") as f:
    BODY = f.read()

js = BODY.replace("__DATA__", data_js)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with io.open(OUT, "w", encoding="utf-8", newline="\n") as f:
    f.write(js)
print("written:", OUT, len(js), "bytes")
