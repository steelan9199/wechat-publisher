"""
球球大作战皮肤反解器：从一张成品皮肤截图反推出绘制步骤脚本。

用法:
  python undo_skin.py <截图路径> [--out <输出目录>]

输出:
  <out>/draw_script.json   绘制步骤脚本（每步：颜色/笔粗/工具/路径点）
  <out>/step1_circle.png   圆检测可视化
  <out>/step1_swatches.png 主色色卡
  <out>/step2_layers.png   分层结果
  <out>/step3_preview.png  画板坐标纸预览

依赖:
  pip install opencv-python-headless numpy

原理:
  1. 霍夫圆检测定位画板圆
  2. K-means聚类 + 最近邻匹配到球球10色色板
  3. 每色二值化 → cv2.findContours提取色块轮廓
  4. Douglas-Peucker简化 + 密集采样插值
  5. 按面积判断笔粗（>3000px粗笔 / >300px中笔 / 其余细笔）
  6. 图片坐标 → 画板坐标映射（圆心1510,720, 安全半径500）
  7. 输出可被autojs qiu-draw-path执行的JSON
"""
import cv2
import numpy as np
import json
import argparse
from pathlib import Path

# === 画板常量（3200×1440横屏实测，换机型需改）===
BOARD_CX = 1510
BOARD_CY = 720
BOARD_SAFE_R = 500  # 安全作画区半径（避免被圆边裁切）

# === 球球10色色板（RGB）===
# 首次使用某图时用--auto-palette从K-means聚类结果自动生成，
# 再根据实际色板校准。这里是黄发墨镜头像实测值。
DEFAULT_PALETTE = {
    "白":   (254, 254, 253),
    "黄":   (247, 205,  74),
    "橙":   (232, 133,  52),
    "红":   (225,  81,  61),
    "蓝":   ( 52, 119, 245),
    "浅绿": (140, 220, 100),
    "紫":   (160,  80, 200),
    "品红": (230,  80, 160),
    "浅蓝": (130, 200, 240),
    "灰":   (150, 150, 150),
}

# === 绘制顺序规则 ===
# 按"后画的盖先画的"——面积大的底层先画，前景细节后画
# 这个顺序可以根据图案类型调整
DEFAULT_LAYER_ORDER = ["橙", "黄", "红", "蓝", "白"]  # 从底到面

# === 笔粗判断阈值（图片像素面积）===
THICK_MIN_AREA = 3000   # >此值用粗笔
MEDIUM_MIN_AREA = 300   # >此值用中笔，否则细笔


def detect_circle(img):
    """霍夫圆检测找画板圆，返回(cx, cy, r)"""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = cv2.medianBlur(gray, 5)
    h, w = gray.shape[:2]
    circles = cv2.HoughCircles(blur, cv2.HOUGH_GRADIENT, dp=1.2,
                                minDist=min(w, h) // 2,
                                param1=100, param2=80,
                                minRadius=min(w, h) // 4,
                                maxRadius=min(w, h) // 2)
    if circles is not None:
        circles = np.round(circles[0]).astype(int)
        cx, cy, r = sorted(circles, key=lambda c: -c[2])[0]
        return int(cx), int(cy), int(r)
    return w // 2, h // 2, min(w, h) // 2


def auto_palette(rgb, circle_mask, k=8):
    """K-means聚类自动探测主色（首次用某图时参考）"""
    pix = rgb[circle_mask > 0].astype(np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    _, labels, centers = cv2.kmeans(pix, k, None, criteria, 10, cv2.KMEANS_PP_CENTERS)
    centers = np.uint8(centers)
    counts = np.bincount(labels.flatten())
    order = np.argsort(-counts)
    print("=== K-means主色（按面积降序）===")
    for i, idx in enumerate(order):
        pct = counts[idx] / len(pix) * 100
        r, g, b = centers[idx]
        print(f"  [{i+1}] RGB=({r:3d},{g:3d},{b:3d})  占比={pct:5.1f}%")
    return centers[order]


def segment_layers(rgb, cx, cy, r, palette, color_threshold=4000):
    """每个像素归类到最近色板色，返回 {色名: mask} 和 {色名: 轮廓列表}"""
    h, w = rgb.shape[:2]
    circle_mask = np.zeros((h, w), dtype=np.uint8)
    cv2.circle(circle_mask, (cx, cy), int(r * 0.95), 255, -1)

    names = list(palette.keys())
    colors = np.array([palette[n] for n in names], dtype=np.float32)
    pix = rgb.astype(np.float32)
    dist = np.sum((pix[:, :, None, :] - colors[None, None, :, :]) ** 2, axis=3)
    assign = np.argmin(dist, axis=2)
    mindist = np.min(dist, axis=2)

    layers = {}
    for i, name in enumerate(names):
        m = ((assign == i) & (circle_mask > 0) &
             (mindist < color_threshold)).astype(np.uint8) * 255
        area = int(np.sum(m > 0))
        if area < 100:
            continue
        contours, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        valid = [c for c in contours if cv2.contourArea(c) > 50]
        if valid:
            layers[name] = {"mask": m, "contours": valid, "area": area}
            print(f"  [{name:4s}] 面积={area:6d}px  轮廓数={len(valid)}")
    return layers, circle_mask


def simplify_contours(contours, epsilon_ratio=0.01):
    """Douglas-Peucker简化轮廓"""
    polys = []
    for c in contours:
        area = cv2.contourArea(c)
        perim = cv2.arcLength(c, True)
        eps = epsilon_ratio * perim
        approx = cv2.approxPolyDP(c, eps, True)
        pts = approx.reshape(-1, 2).tolist()
        polys.append({"area": float(area), "points_px": pts, "n_pts": len(pts)})
    polys.sort(key=lambda p: -p["area"])
    return polys


def densify(points, target_spacing=35):
    """把稀疏顶点插值成密集点序列（闭合路径），点间距≤target_spacing"""
    pts = np.array(points, dtype=np.float64)
    pts_closed = np.vstack([pts, pts[0:1]])
    result = []
    for i in range(len(pts_closed) - 1):
        p1, p2 = pts_closed[i], pts_closed[i + 1]
        seg_len = float(np.linalg.norm(p2 - p1))
        n = max(2, int(seg_len / target_spacing))
        for j in range(n):
            t = j / n
            result.append([p1[0] + (p2[0] - p1[0]) * t,
                           p1[1] + (p2[1] - p1[1]) * t])
    return result


def px_to_board(px, py, img_cx, img_cy, scale):
    """图片像素坐标 → 画板坐标"""
    return [round(BOARD_CX + (px - img_cx) * scale),
            round(BOARD_CY + (py - img_cy) * scale)]


def decide_brush(area_px):
    if area_px > THICK_MIN_AREA:
        return "粗笔"
    elif area_px > MEDIUM_MIN_AREA:
        return "中笔"
    else:
        return "细笔"


def build_draw_script(layers, img_cx, img_cy, img_r, palette, layer_order=None):
    """从分层结果构建绘制步骤脚本"""
    if layer_order is None:
        layer_order = DEFAULT_LAYER_ORDER
    scale = BOARD_SAFE_R / img_r

    steps = []
    # Step 0: 边框（如果有橙色/深色外圈）
    steps.append({
        "step": 0, "type": "set_border", "color": "橙",
        "note": "画板外圈圆环设色（按需改色名）",
    })

    for color_name in layer_order:
        if color_name not in layers:
            continue
        info = layers[color_name]
        polys = simplify_contours(info["contours"])
        for i, poly in enumerate(polys):
            pts_board = [px_to_board(x, y, img_cx, img_cy, scale)
                         for x, y in poly["points_px"]]
            brush = decide_brush(poly["area"])
            spacing = {"粗笔": 35, "中笔": 30, "细笔": 20}[brush]
            pts_dense = densify(pts_board, target_spacing=spacing)
            steps.append({
                "step": len(steps),
                "type": "draw_path",
                "color": color_name,
                "brush": brush,
                "tool": "画笔",
                "n_points": len(pts_dense),
                "duration_ms": max(800, len(pts_dense) * 25),
                "points": [[round(x), round(y)] for x, y in pts_dense],
                "note": f"{color_name} #{i} (面积{poly['area']:.0f}px, {brush})",
            })

    return steps, scale


def main():
    ap = argparse.ArgumentParser(description="球球皮肤反解器")
    ap.add_argument("image", help="皮肤截图路径")
    ap.add_argument("--out", default=None, help="输出目录（默认在图片旁建undo_out/）")
    ap.add_argument("--auto-palette", action="store_true",
                    help="只跑K-means自动探测主色，不输出脚本")
    args = ap.parse_args()

    src = Path(args.image)
    out = Path(args.out) if args.out else src.parent / "undo_out"
    out.mkdir(parents=True, exist_ok=True)

    img = cv2.imread(str(src))
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    h, w = rgb.shape[:2]
    print(f"图片: {w}×{h}")

    # 1. 找圆
    cx, cy, r = detect_circle(img)
    print(f"画板圆: ({cx},{cy}) r={r}")
    circle_mask = np.zeros((h, w), dtype=np.uint8)
    cv2.circle(circle_mask, (cx, cy), int(r * 0.95), 255, -1)

    # 可视化圆
    vis = rgb.copy()
    cv2.circle(vis, (cx, cy), r, (255, 0, 0), 2)
    cv2.imwrite(str(out / "step1_circle.png"), cv2.cvtColor(vis, cv2.COLOR_RGB2BGR))

    # 2. 自动探测色
    auto_palette(rgb, circle_mask)

    if args.auto_palette:
        print("\n--auto-palette 模式：只探测颜色，不输出脚本")
        return

    # 3. 分层
    print("\n=== 颜色分层 ===")
    layers, _ = segment_layers(rgb, cx, cy, r, DEFAULT_PALETTE)

    # 保存分层可视化
    layers_vis = np.zeros_like(rgb)
    for name, info in layers.items():
        m = info["mask"]
        layers_vis[m > 0] = DEFAULT_PALETTE.get(name, (200, 200, 200))
    cv2.imwrite(str(out / "step2_layers.png"), cv2.cvtColor(layers_vis, cv2.COLOR_RGB2BGR))

    # 4. 构建脚本
    print("\n=== 生成绘制脚本 ===")
    steps, scale = build_draw_script(layers, cx, cy, r, DEFAULT_PALETTE)

    script = {
        "meta": {
            "source": str(src),
            "board": {"cx": BOARD_CX, "cy": BOARD_CY, "safe_r": BOARD_SAFE_R},
            "scale": round(scale, 3),
            "n_steps": len(steps),
        },
        "steps": steps,
    }
    with open(out / "draw_script.json", "w", encoding="utf-8") as f:
        json.dump(script, f, ensure_ascii=False, indent=2)

    # 打印摘要
    for s in steps:
        if s["type"] == "set_border":
            print(f"  [{s['step']:2d}] 边框→{s['color']}")
        elif s["type"] == "draw_path":
            print(f"  [{s['step']:2d}] {s['color']:4s} {s['brush']:4s} "
                  f"{s['n_points']:3d}点 {s['duration_ms']:5d}ms  ({s['note']})")

    # 5. 画板预览
    canvas = np.full((1440, 3200, 3), 240, dtype=np.uint8)
    cv2.circle(canvas, (BOARD_CX, BOARD_CY), BOARD_SAFE_R, (200, 200, 200), 2)
    cmap = {n: tuple(c) for n, c in DEFAULT_PALETTE.items()}
    for s in steps:
        if s["type"] == "draw_path":
            c = cmap.get(s["color"], (255, 255, 255))
            pts = np.array(s["points"], dtype=np.int32)
            th = {"粗笔": 15, "中笔": 8, "细笔": 4}[s["brush"]]
            cv2.polylines(canvas, [pts], True, c, th)
    cv2.imwrite(str(out / "step3_preview.png"), canvas)

    print(f"\n输出目录: {out}")
    print(f"  draw_script.json  — 绘制脚本")
    print(f"  step3_preview.png — 画板预览")


if __name__ == "__main__":
    main()
