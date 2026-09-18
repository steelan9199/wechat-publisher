# -*- coding: utf-8 -*-
"""
后羿射日 球球皮肤 坐标生成器
画板: cx=1510, cy=720, r=544 (3200x1440 landscape)
构图: 浅蓝天空 + 十个橙色太阳沿上部弧线排列(中间大两侧小,最外侧被圆边裁切)
      + Q版后羿(黄脸/灰发髻/红衣)持紫弓, 箭向右上射出
生成: batch/b1.json ~ b6.json (无BOM UTF-8)
"""
import json, math, os

CX, CY, R = 1510, 720, 544

def circle(cx, cy, rad, n=45, extra=True):
    """闭合圆, θ 0..352 step 8, 末点=首点"""
    pts = []
    step = 360.0 / n
    for i in range(n):
        th = math.radians(i * step)
        pts.append([round(cx + rad * math.cos(th), 1), round(cy + rad * math.sin(th), 1)])
    if extra:
        pts.append(pts[0])
    return pts

def small_circle(cx, cy, rad, n=12):
    """小圆(发髻/眼睛/补心), 末点=首点"""
    pts = []
    for i in range(n):
        th = math.radians(i * 360.0 / n)
        pts.append([round(cx + rad * math.cos(th), 1), round(cy + rad * math.sin(th), 1)])
    pts.append(pts[0])
    return pts

def line(x1, y1, x2, y2, n=2):
    """直线密采样(少量中间点保证路径平滑)"""
    pts = []
    for i in range(n):
        t = i / (n - 1)
        pts.append([round(x1 + (x2 - x1) * t, 1), round(y1 + (y2 - y1) * t, 1)])
    return pts

def arc_bow():
    """弓身: (1360,620)->(1360,880) 向左凸130, 22点"""
    pts = []
    for i in range(22):
        t = i / 21.0
        x = 1360 - 130 * math.sin(math.pi * t)
        y = 620 + 260 * t
        pts.append([round(x, 1), round(y, 1)])
    return pts

def rect(cx, w, top, bot):
    """矩形闭合路径: 左上->右上->右下->左下->回起点"""
    return [[round(cx - w / 2, 1), top], [round(cx + w / 2, 1), top],
            [round(cx + w / 2, 1), bot], [round(cx - w / 2, 1), bot],
            [round(cx - w / 2, 1), top]]

# ---------------- 太阳布局 (10个: 上排4大 + 下排6小交错, 中间大两侧小) ----------------
SUNS = [
    # (cx, cy, R, fill)
    (1400, 300, 48, True),   # 1 上排左中
    (1620, 300, 48, True),   # 2 上排右中
    (1210, 300, 40, True),   # 3 上排左
    (1810, 300, 40, True),   # 4 上排右
    (1105, 490, 34, False),  # 5 下排左端
    (1275, 490, 38, False),  # 6 下排
    (1445, 490, 40, True),   # 7 下排中左
    (1575, 490, 40, True),   # 8 下排中右
    (1745, 490, 38, False),  # 9 下排
    (1915, 490, 34, False),  # 10 下排右端
]

def sun_paths(sx, sy, rad, fill):
    """返回该太阳的 path 列表 [(points, duration), ...]"""
    paths = []
    n = 45 if rad >= 42 else 24
    dur_outer = 2000 if rad >= 55 else (1800 if rad >= 45 else (1600 if rad >= 40 else 1400))
    paths.append((circle(sx, sy, rad, n=n), dur_outer))
    if fill:
        # 补心圈: 粗笔 w=81, 最内圈 <= 0.4*w=32.4
        paths.append((small_circle(sx, sy, 16, n=12), 1100))
    return paths

def build_sun_ops(sun_list):
    """返回 [op,...] 只含 path"""
    ops = []
    for (sx, sy, rad, fill) in sun_list:
        for pts, dur in sun_paths(sx, sy, rad, fill):
            ops.append({"act": "path", "points": pts, "duration": dur})
    return ops

# ---------------- 批次 ----------------
b1 = {
    "ops": [
        {"act": "bg", "color": "lightblue"},
        {"act": "border", "color": "red"},
        {"act": "tool", "tool": "brush"},
        {"act": "color", "color": "orange"},
        {"act": "size", "size": "thick"},
    ] + build_sun_ops(SUNS[0:3])   # 太阳1~3
}

b2 = {
    "ops": build_sun_ops(SUNS[3:8])  # 太阳4~8
}

b3 = {
    "ops": build_sun_ops(SUNS[8:10]) + [
        {"act": "color", "color": "yellow"},
        {"act": "size", "size": "thick"},
        # 头 R=50
        {"act": "path", "points": circle(1510, 630, 50, n=45), "duration": 2000},
        {"act": "path", "points": small_circle(1510, 630, 16, n=12), "duration": 1100},
        # 发髻 灰 R=20
        {"act": "color", "color": "gray"},
        {"act": "size", "size": "mid"},
        {"act": "path", "points": small_circle(1510, 572, 20, n=16), "duration": 1100},
    ]
}

b4 = {
    "ops": [
        # 眼睛 蓝 细
        {"act": "color", "color": "blue"},
        {"act": "size", "size": "thin"},
        {"act": "path", "points": small_circle(1488, 632, 6, n=8), "duration": 500},
        {"act": "path", "points": small_circle(1532, 632, 6, n=8), "duration": 500},
        # 嘴 红 细 (微笑弧)
        {"act": "color", "color": "red"},
        {"act": "path", "points": [[1498, 652], [1510, 657], [1522, 652]], "duration": 500},
        # 身体 红 粗 矩形3圈
        {"act": "size", "size": "thick"},
        {"act": "path", "points": rect(1510, 120, 695, 835), "duration": 1200},
        {"act": "path", "points": rect(1510, 56, 727, 803), "duration": 1100},
        {"act": "path", "points": rect(1510, 20, 760, 775), "duration": 900},
    ]
}

b5 = {
    "ops": [
        # 腰带 灰 中
        {"act": "color", "color": "gray"},
        {"act": "size", "size": "mid"},
        {"act": "path", "points": line(1462, 790, 1558, 790, n=3), "duration": 500},
        # 左臂 黄 (持弓上端)
        {"act": "color", "color": "yellow"},
        {"act": "path", "points": line(1455, 700, 1362, 640, n=4), "duration": 600},
        # 右臂 黄 (拉弦下端)
        {"act": "path", "points": line(1560, 800, 1362, 840, n=5), "duration": 650},
        # 腿 红 中
        {"act": "color", "color": "red"},
        {"act": "path", "points": line(1470, 830, 1465, 945, n=3), "duration": 600},
        {"act": "path", "points": line(1550, 830, 1555, 945, n=3), "duration": 600},
        # 脚 灰 中
        {"act": "color", "color": "gray"},
        {"act": "path", "points": line(1440, 950, 1490, 950, n=3), "duration": 500},
        {"act": "path", "points": line(1530, 950, 1580, 950, n=3), "duration": 500},
    ]
}

b6 = {
    "ops": [
        # 弓身 紫 中
        {"act": "color", "color": "purple"},
        {"act": "size", "size": "mid"},
        {"act": "path", "points": arc_bow(), "duration": 1800},
        # 弦 白 细
        {"act": "color", "color": "white"},
        {"act": "size", "size": "thin"},
        {"act": "path", "points": line(1360, 620, 1360, 880, n=4), "duration": 600},
        # 箭杆 灰 细 (射向右上太阳2(1620,300) R=48 的圆周边缘点(1596,342))
        {"act": "color", "color": "gray"},
        {"act": "path", "points": line(1362, 748, 1596, 342, n=10), "duration": 700},
        # 箭头 红 细 (垂直于箭杆的短横, 触到太阳2边缘)
        {"act": "color", "color": "red"},
        {"act": "path", "points": line(1584, 335, 1608, 349, n=3), "duration": 400},
        # 箭羽 灰 细 (箭尾 V 形)
        {"act": "color", "color": "gray"},
        {"act": "path", "points": [[1350, 762], [1362, 748], [1374, 762]], "duration": 400},
    ]
}

BATCHES = [b1, b2, b3, b4, b5, b6]

def main():
    outdir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "batch")
    os.makedirs(outdir, exist_ok=True)
    for i, b in enumerate(BATCHES, start=1):
        path = os.path.join(outdir, "b%d.json" % i)
        with open(path, "w", encoding="utf-8", newline="") as f:
            json.dump(b, f, ensure_ascii=False)
        npath = sum(1 for op in b["ops"] if op["act"] == "path")
        dur = sum(op.get("duration", 0) for op in b["ops"] if op["act"] == "path")
        print("b%d.json  ops=%d path=%d totalPathDur=%.1fs" % (i, len(b["ops"]), npath, dur / 1000))

if __name__ == "__main__":
    main()
