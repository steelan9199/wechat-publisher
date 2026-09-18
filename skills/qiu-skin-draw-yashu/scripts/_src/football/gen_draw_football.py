# -*- coding: utf-8 -*-
"""gen_draw_football.py — 生成 draw_football.js 造型数据（归一化 uv）

简化版：五边形是直线边，直接用相似五边形向内缩，不用密采样法向量库。
几何：截角二十面体正对一个五边形的正交投影。
  中心五边形 R=160，粗笔 w=81，每圈内缩 0.7*81≈57，到 R<=40 停
  外围 5 个五边形：D=0.894*r，R=110，角度 -90/54/126/-18/-162
"""
import os, json, math
HERE = os.path.dirname(os.path.abspath(__file__))

CX, CY, R = 1510.0, 720.0, 544.0
W = 81.0
STEP = W * 0.7  # 56.7

def uv(x, y):
    return [round((x - CX) / R, 4), round((y - CY) / R, 4)]

def pentagon_ring(cx_, cy_, rad, rot_deg=-90):
    pts = []
    for k in range(5):
        th = math.radians(rot_deg + 72 * k)
        pts.append(uv(cx_ + rad * math.cos(th), cy_ + rad * math.sin(th)))
    pts.append(pts[0][:])
    return pts

def fill_pentagon(cx_, cy_, rad, dur_first=1700, dur_rest=1400):
    ops = []
    r = rad
    i = 0
    while r > W / 2:
        ops.append({"act": "path",
                    "duration": dur_first if i == 0 else dur_rest,
                    "uv": pentagon_ring(cx_, cy_, r)})
        r -= STEP
        i += 1
    return ops

center_ops = fill_pentagon(CX, CY, 160)

outer_ops = []
D = 0.894 * R
for ang in [-90, 54, 126, -18, -162]:
    ox = CX + D * math.cos(math.radians(ang))
    oy = CY + D * math.sin(math.radians(ang))
    outer_ops.extend(fill_pentagon(ox, oy, 110, dur_first=1500, dur_rest=1200))

FOOTBALL = {
    "version": "1.0",
    "subject": "足球",
    "geo": "uv=((x-cx)/r,(y-cy)/r); truncated icosahedron ortho projection facing a pentagon",
    "palette": {"bg": "white", "border": "blue", "pent": "blue"},
    "stages": [
        {"id": "bg", "title": "白底+蓝边框+回画笔", "ops": [
            {"act": "bg", "slot": "bg"},
            {"act": "border", "slot": "border"},
            {"act": "tool", "tool": "brush"},
            {"act": "color", "slot": "pent"},
            {"act": "size", "size": "thick"},
        ]},
        {"id": "center", "title": "中心大蓝五边形", "ops": center_ops},
        {"id": "rim", "title": "外围5个贴边裁切蓝五边形", "ops": outer_ops},
    ],
}

if __name__ == "__main__":
    out = os.path.join(HERE, "football_data.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(FOOTBALL, f, ensure_ascii=False, indent=2)
    total = sum(1 for st in FOOTBALL["stages"] for op in st["ops"] if op["act"] == "path")
    print("written:", out)
    for st in FOOTBALL["stages"]:
        n = sum(1 for op in st["ops"] if op["act"] == "path")
        print(f"  {st['id']:8s} {n} paths")
    print("total paths:", total)
