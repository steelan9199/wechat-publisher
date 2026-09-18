# -*- coding: utf-8 -*-
"""
后羿射日 球球皮肤 坐标生成器 v2（按参考图：黑剪影+红弓+火烧云+10太阳上弧）
画板: cx=1510, cy=720, r=544 (3200x1440 landscape)
笔宽: thin=27, medium=45, thick=81
色板: 蓝(深蓝夜空底) 红(边框/弓/箭头/火烧云红) 橙(太阳/火烧云橙) 黄(太阳心) 灰(后羿剪影/岩石) 白(弦)
"""
import json, math, os

CX, CY, R = 1510, 720, 544

def circle(cx, cy, rad, n=45, extra=True):
    pts = []
    step = 360.0 / n
    for i in range(n):
        th = math.radians(i * step)
        pts.append([round(cx + rad * math.cos(th), 1), round(cy + rad * math.sin(th), 1)])
    if extra:
        pts.append(pts[0])
    return pts

def small_circle(cx, cy, rad, n=12):
    pts = []
    for i in range(n):
        th = math.radians(i * 360.0 / n)
        pts.append([round(cx + rad * math.cos(th), 1), round(cy + rad * math.sin(th), 1)])
    pts.append(pts[0])
    return pts

def line(x1, y1, x2, y2, n=3):
    pts = []
    for i in range(n):
        t = i / (n - 1)
        pts.append([round(x1 + (x2 - x1) * t, 1), round(y1 + (y2 - y1) * t, 1)])
    return pts

def wave(x_start, x_end, y_base, amp, n=12, steps=3):
    """波浪弧线: 从左到右 y 在 y_base±amp 间波动"""
    pts = []
    for i in range(n):
        t = i / (n - 1)
        x = x_start + (x_end - x_start) * t
        y = y_base + amp * math.sin(t * math.pi * steps)
        pts.append([round(x, 1), round(y, 1)])
    return pts

def closed_poly(points):
    """闭合多边形: 首尾相连"""
    return points + [points[0]]

# ---------------- 10个太阳 (上排3 + 下排7, 两排交错, 粗笔间距≥R1+R2+89) ----------------
SUNS = [
    # (cx, cy, R, fill_center)
    (1330, 250, 30, True),   # S1 上排左
    (1510, 225, 38, True),   # S2 上排中(最大最亮)
    (1690, 250, 30, True),   # S3 上排右
    (1040, 420, 24, False),  # S4 下排最左(边缘裁切)
    (1200, 440, 28, True),   # S5
    (1340, 450, 32, True),   # S6
    (1510, 455, 36, True),   # S7 下排中(最大)
    (1670, 450, 32, True),   # S8
    (1830, 440, 28, True),   # S9
    (1980, 420, 24, False),  # S10 下排最右(边缘裁切)
]

def sun_outer(sx, sy, rad):
    n = 45 if rad >= 34 else (30 if rad >= 26 else 24)
    dur = 1900 if rad >= 34 else (1600 if rad >= 28 else 1400)
    return {"act": "path", "points": circle(sx, sy, rad, n=n), "duration": dur}

def sun_core(sx, sy):
    # 补心圈 r=12, 满足 0.4*thick=32.4
    return {"act": "path", "points": small_circle(sx, sy, 12, n=12), "duration": 800}

# ---------------- 批次 ----------------
b1 = {
    "ops": [
        {"act": "bg", "color": "blue"},
        {"act": "border", "color": "red"},
        {"act": "tool", "tool": "brush"},
        {"act": "color", "color": "orange"},
        {"act": "size", "size": "thick"},
        sun_outer(*SUNS[0][:3]),  # S1
        sun_outer(*SUNS[1][:3]),  # S2
        sun_outer(*SUNS[2][:3]),  # S3
        sun_outer(*SUNS[3][:3]),  # S4
        sun_outer(*SUNS[4][:3]),  # S5
    ]
}

b2 = {
    "ops": [
        sun_outer(*SUNS[5][:3]),  # S6
        sun_outer(*SUNS[6][:3]),  # S7
        sun_outer(*SUNS[7][:3]),  # S8
        sun_outer(*SUNS[8][:3]),  # S9
        sun_outer(*SUNS[9][:3]),  # S10
    ]
}

b3 = {
    "ops": [
        {"act": "color", "color": "yellow"},
        {"act": "size", "size": "thick"},
        sun_core(*SUNS[0][:2]),
        sun_core(*SUNS[1][:2]),
        sun_core(*SUNS[2][:2]),
        sun_core(*SUNS[4][:2]),
        sun_core(*SUNS[5][:2]),
    ]
}

b4 = {
    "ops": [
        sun_core(*SUNS[6][:2]),
        sun_core(*SUNS[7][:2]),
        sun_core(*SUNS[8][:2]),
        # 火烧云 橙色 (下部左右两侧波浪线)
        {"act": "color", "color": "orange"},
        {"act": "size", "size": "thick"},
        {"act": "path", "points": wave(950, 1380, 600, 30, n=14, steps=3), "duration": 1200},
        {"act": "path", "points": wave(980, 1350, 660, 25, n=14, steps=2), "duration": 1100},
        {"act": "path", "points": wave(1020, 1320, 710, 20, n=12, steps=2), "duration": 1000},
        {"act": "path", "points": wave(1640, 2060, 600, 30, n=14, steps=3), "duration": 1200},
        {"act": "path", "points": wave(1670, 2030, 660, 25, n=14, steps=2), "duration": 1100},
        {"act": "path", "points": wave(1700, 2000, 710, 20, n=12, steps=2), "duration": 1000},
    ]
}

b5 = {
    "ops": [
        # 火烧云 红色加深
        {"act": "color", "color": "red"},
        {"act": "size", "size": "thick"},
        {"act": "path", "points": wave(960, 1360, 630, 22, n=12, steps=2), "duration": 1000},
        {"act": "path", "points": wave(1650, 2050, 630, 22, n=12, steps=2), "duration": 1000},
        # 后羿剪影 灰色
        {"act": "color", "color": "gray"},
        {"act": "size", "size": "thick"},
        # 岩石(不规则闭合多边形)
        {"act": "path", "points": closed_poly([
            [1370, 1180], [1410, 1090], [1480, 1065], [1560, 1065],
            [1620, 1090], [1660, 1180]
        ]), "duration": 1500},
        # 头(2圈填充)
        {"act": "path", "points": circle(1540, 840, 34, n=30), "duration": 1200},
        {"act": "path", "points": small_circle(1540, 840, 12, n=12), "duration": 700},
        # 身体(竖椭圆2圈)
        {"act": "path", "points": [
            [1505, 880], [1490, 930], [1495, 990], [1510, 1010],
            [1530, 1010], [1545, 990], [1550, 930], [1535, 880],
            [1505, 880]
        ], "duration": 1300},
        {"act": "path", "points": [
            [1515, 900], [1508, 940], [1512, 985], [1525, 995],
            [1535, 985], [1540, 940], [1533, 900], [1515, 900]
        ], "duration": 900},
        # 左腿
        {"act": "path", "points": line(1505, 1000, 1485, 1065, n=3), "duration": 600},
        # 右腿
        {"act": "path", "points": line(1535, 1000, 1565, 1065, n=3), "duration": 600},
        # 左臂(前推弓)
        {"act": "path", "points": line(1505, 895, 1370, 850, n=4), "duration": 700},
        # 右臂(后拉弦到脸旁)
        {"act": "path", "points": line(1560, 895, 1475, 875, n=4), "duration": 700},
        # 发髻(飘起小弧)
        {"act": "size", "size": "mid"},
        {"act": "path", "points": [[1555, 815], [1585, 790], [1605, 760]], "duration": 600},
    ]
}

b6 = {
    "ops": [
        # 弓(红色弯弧, 从(1340,720)到(1340,980), 向左凸)
        {"act": "color", "color": "red"},
        {"act": "size", "size": "mid"},
        {"act": "path", "points": [
            [round(1340 - 90 * math.sin(math.pi * i / 20.0), 1),
             round(720 + 260 * i / 20.0, 1)]
            for i in range(21)
        ], "duration": 1800},
        # 弦(白色细线连弓两端)
        {"act": "color", "color": "white"},
        {"act": "size", "size": "thin"},
        {"act": "path", "points": line(1340, 720, 1340, 980, n=4), "duration": 600},
        # 箭杆(从拉弦点(1475,875)射向右上S3太阳(1690,250) R=30边缘)
        # 方向向量=(215,-625), 长度=sqrt(46225+390625)=660.7, 单位=(0.3255,-0.9466)
        # 边缘点=(1690-0.3255*30, 250+0.9466*30)=(1680,278)
        {"act": "color", "color": "red"},
        {"act": "size", "size": "thin"},
        {"act": "path", "points": line(1475, 875, 1680, 278, n=12), "duration": 900},
        # 箭头(垂直箭杆短横, 在(1680,278))
        {"act": "path", "points": [[1668, 285], [1680, 278], [1672, 265]], "duration": 400},
        # 箭羽(箭尾V形)
        {"act": "color", "color": "gray"},
        {"act": "size", "size": "thin"},
        {"act": "path", "points": [[1465, 890], [1475, 875], [1485, 890]], "duration": 400},
    ]
}

BATCHES = [b1, b2, b3, b4, b5, b6]

def main():
    outdir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "batch_v2")
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
