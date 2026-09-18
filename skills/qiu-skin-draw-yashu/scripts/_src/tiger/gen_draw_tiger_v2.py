# -*- coding: utf-8 -*-
"""老虎脸 v2 —— 用 QiuGeom 重建：填充一律【轮廓内缩】、曲线一律【密采样】。

与 v1 的差异（2026-09-18 用户指出）：
  v1 鼻子 = 3 条横线堆叠、吻部 = 7 条横线堆叠（横纹 + 边界锯齿）
  v1 曲线：嘴弧 16 点、颊纹 8 点、耳朵干脆是 2 点直线
  v2 全部改：填充走 Shape.rings()，曲线走 curve()，闭合 >=56 点，开放每 12px 一点

几何布局沿用已验证的那版（做完两次真机复现、与原稿差 0.37%），只改笔法不改形态。
"""
import io, json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.join(os.path.dirname(os.path.dirname(HERE)), "lib")
sys.path.insert(0, LIB)
from qiu_geom import Circle, Ellipse, Polygon, Blob, curve, line, stats, MIN_CLOSED_PTS

OUT_JS = os.path.join(os.path.dirname(HERE), "draw_tiger.js")
OUT_ABS = os.path.join(HERE, "tiger_v2_abs.json")   # 绝对坐标，供离线渲染预览

CX, CY, R = 1510.0, 720.0, 544.0
MIR = 2 * CX
WIDTH = {"thick": 81, "mid": 45, "thin": 27}        # 运行时实际值（由测量脚本得来）
STAGE_MAX_MS = 24000                                 # 单个 stage 手势总时长上限
MS_PER_PT = 30
MS_BASE = 400

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


def mir(p):
    return [MIR - p[0], p[1]]


def mirs(pts):
    return [mir(p) for p in pts]


def uvp(pts):
    return [[round((p[0] - CX) / R, 4), round((p[1] - CY) / R, 4)] for p in pts]


def dur(pts):
    return MS_BASE + MS_PER_PT * len(pts)


# ==========================================================================
# 构造各 stage 的 ops（绝对坐标 px）
# 每个元素： ("tool"/"size"/"color"/"bg", value) 或 ("path", size_key, points)
# ==========================================================================
def build_abs_stages():
    S = []

    # ---------- stage 0: 铺底色 ----------
    S.append([("bg", "bg")])

    # ---------- stage 1: 黄三角耳(轮廓内缩) + 品红内耳 ----------
    o = [("tool", "brush"), ("color", "ear"), ("size", "thick")]
    earL = Polygon([(1230, 335), (1155, 485), (1305, 485)])
    for ring in earL.rings(WIDTH["thick"]):
        o.append(("path", "thick", ring))
    for ring in Polygon([mir(v) for v in earL.verts]).rings(WIDTH["thick"]):
        o.append(("path", "thick", ring))
    o.append(("color", "inner"))
    o.append(("size", "mid"))
    for ring in Circle(1230, 432, 37).rings(WIDTH["mid"]):
        o.append(("path", "mid", ring))
    for ring in Circle(MIR - 1230, 432, 37).rings(WIDTH["mid"]):
        o.append(("path", "mid", ring))
    S.append(o)

    # ---------- stage 2: 白眼眶 ----------
    o = [("tool", "brush"), ("color", "eye"), ("size", "thick")]
    for ring in Circle(1365, 645, 90).rings(WIDTH["thick"]):
        o.append(("path", "thick", ring))
    for ring in Circle(MIR - 1365, 645, 90).rings(WIDTH["thick"]):
        o.append(("path", "thick", ring))
    S.append(o)

    # ---------- stage 3: 白吻部 ----------
    o = [("tool", "brush"), ("color", "muzzle"), ("size", "thick")]
    for ring in Ellipse(1510, 905, 200, 125).rings(WIDTH["thick"]):
        o.append(("path", "thick", ring))
    S.append(o)

    # ---------- stage 4: 蓝瞳 + 浅蓝高光 + 品红鼻 ----------
    o = [("tool", "brush"), ("color", "pupil"), ("size", "mid")]
    for ring in Circle(1365, 655, 42.5).rings(WIDTH["mid"]):
        o.append(("path", "mid", ring))
    for ring in Circle(MIR - 1365, 655, 42.5).rings(WIDTH["mid"]):
        o.append(("path", "mid", ring))
    o.append(("color", "shine"))
    o.append(("size", "thin"))
    o.append(("path", "thin", line([1338, 630], [1352, 630])))
    o.append(("path", "thin", line([1658, 630], [1672, 630])))
    o.append(("color", "nose"))
    o.append(("size", "mid"))
    # 倒三角鼻：Blob 圆角，避免锐角笔触毛刺
    nose = Blob([(1456, 802), (1564, 802), (1512, 866), (1508, 866)])
    for ring in nose.rings(WIDTH["mid"]):
        o.append(("path", "mid", ring))
    S.append(o)

    # ---------- stage 5: 红嘴 + 额头三道条纹 ----------
    o = [("tool", "brush"), ("color", "mouth"), ("size", "thin")]
    o.append(("path", "thin", curve([[1510, 866], [1510, 900]])))
    o.append(("path", "thin", curve([[1510, 898], [1478, 922], [1442, 936], [1408, 928], [1398, 910]])))
    o.append(("path", "thin", curve([[1510, 898], [1542, 922], [1578, 936], [1612, 928], [1622, 910]])))
    o.append(("size", "thick"))
    o.append(("path", "thick", curve([[1512, 400], [1508, 445], [1507, 490], [1509, 535], [1514, 570]])))
    o.append(("path", "thick", curve([[1398, 430], [1404, 468], [1412, 505], [1422, 540], [1434, 568]])))
    o.append(("path", "thick", curve([[1622, 430], [1616, 468], [1608, 505], [1598, 540], [1586, 568]])))
    S.append(o)

    # ---------- stage 6: 颊纹 + 胡须点 ----------
    o = [("tool", "brush"), ("color", "cheek"), ("size", "mid")]
    o.append(("path", "mid", curve([[1205, 672], [1242, 700], [1282, 722]])))
    o.append(("path", "mid", curve([[1178, 772], [1216, 798], [1258, 818]])))
    o.append(("path", "mid", curve([[1815, 672], [1778, 700], [1738, 722]])))
    o.append(("path", "mid", curve([[1842, 772], [1804, 798], [1762, 818]])))
    o.append(("size", "thin"))
    for y in (858, 916):
        o.append(("path", "thin", line([1400, y], [1414, y])))
        o.append(("path", "thin", line([1620, y], [1606, y])))
    S.append(o)

    return S


# ==========================================================================
# 自动拆分：把超时的 stage 按累计时长切成多块，并在每块开头恢复状态
# ==========================================================================
def split_stages(abs_stages):
    """返回 [(id, title, ops)]，ops 已转好 uv 并补了 duration"""
    out = []
    names = ["bg", "b1", "b2", "b3", "b4", "b5", "b6"]
    for raw in abs_stages:
        idx = len(out)
        base_id = names[idx] if idx < len(names) else "x%d" % idx
        base_title = TITLE.get(base_id, "")
        # 先算全部 path 的总时长
        total = sum(dur(op[2]) + 220 for op in raw if op[0] == "path")
        if base_id == "bg" or total <= STAGE_MAX_MS:
            out.append((base_id, base_title, raw))
            continue
        # 需要拆分
        blocks = []
        cur, cum = [], 0
        state = []
        for op in raw:
            if op[0] == "path":
                d = dur(op[2]) + 220
                if cum + d > STAGE_MAX_MS and cur:
                    blocks.append(list(state) + cur)
                    cur, cum = [], 0
                cur.append(op)
                cum += d
            else:
                cur.append(op)
                state.append(op)   # 状态指令在每块开头重放
                if op[0] == "size":
                    state = [s for s in state if s[0] != "size"] + [op]
                if op[0] == "color":
                    state = [s for s in state if s[0] != "color"] + [op]
        if cur:
            blocks.append(list(state) + cur)
        for bi, blk in enumerate(blocks):
            out.append(("%s%s" % (base_id, chr(ord("a") + bi)),
                        "%s (%d/%d)" % (base_title, bi + 1, len(blocks)), blk))
    return out


def to_ops(blk):
    ops = []
    for op in blk:
        if op[0] == "path":
            ops.append({"act": "path", "duration": dur(op[2]), "uv": uvp(op[2])})
        elif op[0] == "bg":
            ops.append({"act": "bg", "slot": op[1]})
        else:
            ops.append({"act": op[0], op[0]: op[1]} if op[0] in ("tool", "size")
                       else {"act": "color", "slot": op[1]})
    return ops


def main():
    stages_abs = build_abs_stages()
    blocks = split_stages(stages_abs)

    tiger = {
        "version": "2.0",
        "subject": "老虎脸",
        "geo": "uv=((x-cx)/r,(y-cy)/r)；填充=轮廓内缩(step=笔宽x0.7)；闭合>=56点；开放曲线每12px一点",
        "palette": PALETTE,
        "stages": [{"id": i, "title": t, "ops": to_ops(b)} for i, t, b in blocks],
    }

    npath = sum(1 for s in tiger["stages"] for o in s["ops"] if o["act"] == "path")
    npts = sum(len(o["uv"]) for s in tiger["stages"] for o in s["ops"] if o["act"] == "path")
    data_js = json.dumps(tiger, ensure_ascii=False, separators=(",", ":"))

    print("=== 新 data ===")
    for s in tiger["stages"]:
        ps = [o for o in s["ops"] if o["act"] == "path"]
        ms = sum(o["duration"] + 220 for o in ps)
        pts = sum(len(o["uv"]) for o in ps)
        print("  %-5s %-30s paths=%-3d pts=%-5d %.1fs" % (s["id"], s["title"], len(ps), pts, ms / 1000.0))
    print("  合计 stages=%d paths=%d pts=%d data=%.1fKB" % (
        len(tiger["stages"]), npath, npts, len(data_js) / 1024.0))

    body = io.open(os.path.join(HERE, "draw_tiger_body.js"), encoding="utf-8").read()
    js = body.replace("__DATA__", data_js)
    io.open(OUT_JS, "w", encoding="utf-8", newline="\n").write(js)
    print("  written js:", OUT_JS, "%.1fKB" % (len(js) / 1024.0))

    # 绝对坐标存档（供离线渲染预览）
    io.open(OUT_ABS, "w", encoding="utf-8").write(json.dumps(
        {"board": {"cx": CX, "cy": CY, "r": R}, "widths": WIDTH, "palette": PALETTE,
         "stages": [{"id": i, "paths": [{"size": op[1] if op[0] == "path" else None,
                                         "w": WIDTH[op[1]] if op[0] == "path" else None,
                                         "pts": op[2]} for op in blk if op[0] == "path"]}
                    for i, t, blk in blocks]}, ensure_ascii=False))


main()
