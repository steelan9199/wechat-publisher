# -*- coding: utf-8 -*-
"""
后羿射日 batch 验证 + 预览渲染
- 验证 6 个 JSON: 合法 / 坐标在屏幕 3200x1440 内 / 每批 path<=10 时长<=16s
- 用 PIL 模拟画板圆 + 笔画渲染 preview.png (含笔宽模拟)
"""
import json, math, os
from PIL import Image, ImageDraw

BASE = os.path.dirname(os.path.abspath(__file__))
BATCH = os.path.join(BASE, "batch")
CX, CY, R = 1510, 720, 544
W, H = 3200, 1440

WIDTH = {"thick": 81, "mid": 45, "thin": 27}

# 颜色映射 (近似视觉)
COLOR_RGB = {
    "green": (0x4C, 0xD9, 0x64), "yellow": (0xF2, 0xC1, 0x30),
    "orange": (0xF0, 0x82, 0x28), "red": (0xE0, 0x3A, 0x3A),
    "purple": (0x8E, 0x44, 0xAD), "magenta": (0xE0, 0x3A, 0x9E),
    "blue": (0x30, 0x60, 0xF0), "lightblue": (0x8A, 0xC6, 0xF0),
    "white": (0xF0, 0xF0, 0xF0), "gray": (0x80, 0x80, 0x80),
}

def validate():
    problems = []
    for i in range(1, 7):
        p = os.path.join(BATCH, "b%d.json" % i)
        with open(p, "r", encoding="utf-8") as f:
            data = json.load(f)
        ops = data["ops"]
        npath = sum(1 for op in ops if op["act"] == "path")
        dur = sum(op.get("duration", 0) for op in ops if op["act"] == "path")
        if npath > 10:
            problems.append("b%d path=%d>10" % (i, npath))
        if dur > 16000:
            problems.append("b%d dur=%.1fs>16s" % (i, dur / 1000))
        for op in ops:
            if op["act"] == "path":
                for pt in op["points"]:
                    if not (0 <= pt[0] <= W and 0 <= pt[1] <= H):
                        problems.append("b%d 坐标越界 %s" % (i, pt))
    print("validation:", "OK" if not problems else problems)
    return problems

def render():
    img = Image.new("RGB", (W, H), (50, 50, 60))
    d = ImageDraw.Draw(img)
    # 画板圆背景(浅蓝) + 圆外深色
    d.ellipse([CX - R, CY - R, CX + R, CY + R], fill=COLOR_RGB["lightblue"], outline=(255, 255, 255), width=8)
    cur_color = None
    cur_size = "thick"
    for i in range(1, 7):
        with open(os.path.join(BATCH, "b%d.json" % i), "r", encoding="utf-8") as f:
            ops = json.load(f)["ops"]
        for op in ops:
            a = op["act"]
            if a == "bg":
                d.ellipse([CX - R, CY - R, CX + R, CY + R], fill=COLOR_RGB[op["color"]])
            elif a == "border":
                d.ellipse([CX - R, CY - R, CX + R, CY + R], outline=COLOR_RGB[op["color"]], width=10)
            elif a == "color":
                cur_color = COLOR_RGB[op["color"]]
            elif a == "size":
                cur_size = op["size"]
            elif a == "path":
                w = WIDTH[cur_size]
                pts = [(int(x), int(y)) for x, y in op["points"]]
                if len(pts) >= 2:
                    d.line(pts, fill=cur_color, width=w, joint="curve")
                for pt in pts:
                    d.ellipse([pt[0] - w // 2, pt[1] - w // 2, pt[0] + w // 2, pt[1] + w // 2], fill=cur_color)
    # 画板圆边界
    d.ellipse([CX - R, CY - R, CX + R, CY + R], outline=(255, 255, 255), width=6)
    out = os.path.join(BASE, "houyi_preview.png")
    img.crop([CX - R - 40, CY - R - 40, CX + R + 40, CY + R + 40]).resize((880, 880), Image.LANCZOS).save(out)
    print("preview saved:", out)

if __name__ == "__main__":
    validate()
    render()
