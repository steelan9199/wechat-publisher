# -*- coding: utf-8 -*-
"""太阳系皮肤 batch 生成器：太阳 + 6 行星环绕
画板几何：cx=1510 cy=720 r=544（横屏 3200x1440，来自 qiu-board 存储）
笔宽：thick=81 mid=45 thin=27
配色：bg=blue 边框=orange
"""
import math, json, os, sys

CX, CY, R = 1510.0, 720.0, 544.0
W_THICK, W_MID, W_THIN = 81, 45, 27

def circle(cx, cy, rad, step=8):
    """整圆闭合采样：45 等距点 + 回起点（首尾重合铁律）"""
    pts = []
    n = int(round(360 / step))
    for i in range(n):
        th = math.radians(i * step)
        pts.append([round(cx + rad * math.cos(th), 1), round(cy + rad * math.sin(th), 1)])
    pts.append(pts[0])
    return pts

def ellipse(cx, cy, a, b, step=8):
    """扁椭圆闭合采样（土星环用）"""
    return circle(cx, cy, 1, step)  # placeholder
    # 实际实现如下（上面占位避免误用）
    # 见 ellipse_impl

def ellipse_impl(cx, cy, a, b, step=8):
    pts = []
    n = int(round(360 / step))
    for i in range(n):
        th = math.radians(i * step)
        pts.append([round(cx + a * math.cos(th), 1), round(cy + b * math.sin(th), 1)])
    pts.append(pts[0])
    return pts

def chord(cx, cy, rad, dy, inset=26):
    """圆内水平弦线段（木星条纹），两端缩进 inset 避免笔触露出球缘"""
    half = math.sqrt(max(0.0, rad * rad - dy * dy))
    half = min(half, rad - inset)
    return [[cx - half, cy + dy], [cx + half, cy + dy]]

def path_op(points, duration, gap=None):
    op = {"act": "path", "points": points, "duration": duration}
    if gap is not None:
        op["gap"] = gap
    return op

# ---- 行星布局: (名, 颜色, 半径px, 轨道px, 角度°, 填充圈半径列表) ----
PLANETS = [
    ("mercury", "gray",      38, 300, 340, [38, 4]),
    ("earth",   "blue",      62, 315,  25, [62, 28, 18]),
    ("mars",    "red",       46, 348,  95, [46, 12]),
    ("jupiter", "orange",    90, 457, 150, [90, 29, 16]),
    ("saturn",  "yellow",    72, 479, 215, [72, 11]),
    ("neptune", "lightblue", 50, 446, 285, [50, 16]),
]

def center(orb, theta):
    th = math.radians(theta)
    return (CX + orb * math.cos(th), CY + orb * math.sin(th))

C = {name: (center(orb, th), rad) for name, col, rad, orb, th, rings in PLANETS}

# ================= 批次组装 =================
b1 = [
    {"act": "bg", "color": "blue"},
    {"act": "border", "color": "orange"},
    {"act": "tool", "tool": "brush"},
    {"act": "color", "color": "orange"},
    {"act": "size", "size": "thick"},
]
for rr in (185.0, 124.0):
    b1.append(path_op(circle(CX, CY, rr), 2200))

b2 = [
    {"act": "color", "color": "yellow"},
    {"act": "size", "size": "thick"},
]
for rr in (100.0, 39.0, 16.0):
    b2.append(path_op(circle(CX, CY, rr), 1800 if rr > 40 else 1400))

# 批次3：水星(灰) + 地球(蓝) + 大陆斑块(浅绿=green)
b3 = [
    {"act": "color", "color": "gray"},
    {"act": "size", "size": "mid"},
]
(mx, my), mr = C["mercury"]
for rr in PLANETS[0][5]:
    b3.append(path_op(circle(mx, my, rr), 900))
(ex, ey), er = C["earth"]
for rr in PLANETS[1][5]:
    b3.append(path_op(circle(ex, ey, rr), 1200))
b3.append({"act": "color", "color": "green"})
for (dx, dy) in ((-18, -8), (14, 10)):
    b3.append(path_op([[ex + dx - 4, ey + dy], [ex + dx + 4, ey + dy]], 300))

# 批次4：火星(红) + 木星(橙)
b4 = [
    {"act": "color", "color": "red"},
    {"act": "size", "size": "mid"},
]
(rx, ry), rr = C["mars"]
for r_ in PLANETS[2][5]:
    b4.append(path_op(circle(rx, ry, r_), 1000))
b4.append({"act": "color", "color": "orange"})
b4.append({"act": "size", "size": "thick"})
(jx, jy), jr = C["jupiter"]
for r_ in PLANETS[3][5]:
    b4.append(path_op(circle(jx, jy, r_), 1600))

# 批次5：木星条纹(红细) + 土星(黄) + 土星环(白细椭圆)
b5 = [
    {"act": "color", "color": "red"},
    {"act": "size", "size": "thin"},
]
for dy in (-22.0, 14.0):
    b5.append(path_op(chord(jx, jy, jr, dy), 900))
b5.append({"act": "color", "color": "yellow"})
b5.append({"act": "size", "size": "thick"})
(sx, sy), sr = C["saturn"]
for r_ in PLANETS[4][5]:
    b5.append(path_op(circle(sx, sy, r_), 1400))
b5.append({"act": "color", "color": "white"})
b5.append({"act": "size", "size": "thin"})
b5.append(path_op(ellipse_impl(sx, sy, sr + 26.0, round(sr * 0.45)), 2000))

# 批次6：海王星(浅蓝) + 星星(白细)
b6 = [
    {"act": "color", "color": "lightblue"},
    {"act": "size", "size": "mid"},
]
(nx, ny), nr = C["neptune"]
for r_ in PLANETS[5][5]:
    b6.append(path_op(circle(nx, ny, r_), 1000))
b6.append({"act": "color", "color": "white"})
b6.append({"act": "size", "size": "thin"})
for (sx_, sy_) in ((1330, 380), (1730, 470), (1290, 1020), (1660, 1060)):
    b6.append(path_op([[sx_ - 5, sy_], [sx_ + 5, sy_]], 300))

# ---- 写出（无 BOM UTF-8）----
out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "batch")
os.makedirs(out_dir, exist_ok=True)
batches = {1: b1, 2: b2, 3: b3, 4: b4, 5: b5, 6: b6}
for k, ops in batches.items():
    fp = os.path.join(out_dir, "b%d.json" % k)
    with open(fp, "w", encoding="utf-8") as f:
        json.dump({"ops": ops}, f, ensure_ascii=False)
    npath = sum(1 for o in ops if o["act"] == "path")
    total_dur = sum(o.get("duration", 0) for o in ops if o["act"] == "path")
    print("b%d.json: %d ops, %d paths, 画笔时长 %.1fs" % (k, len(ops), npath, total_dur / 1000.0))

# ---- 自检输出 ----
print("\n[自检] 行星中心坐标与距圆心距离:")
for name, col, rad, orb, th, rings in PLANETS:
    (x, y), r_ = C[name]
    d = math.hypot(x - CX, y - CY)
    print("  %-8s 颜色=%-9s r=%3d 轨道=%3d 角度=%3d° -> (%.0f, %.0f) 距圆心=%.0f 外缘距边=%.0fpx%s" % (
        name, col, rad, orb, th, x, y, d, R - d - rad,
        "  [被圆边裁切!]" if d + rad > R else ""))
