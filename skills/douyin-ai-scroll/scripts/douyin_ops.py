# -*- coding: utf-8 -*-
"""
douyin_ops.py — 手机操作封装层（通过 AutoJS 中继下发模板任务）
所有坐标基于 1440x3200 真机实测校准。
"""
import json
import os
import re
import subprocess
import tempfile
import urllib.request
import urllib.error

AUTOJS_SKILL_DIR = (
    r"C:\Users\Administrator\AppData\Local\DoubaoWork\User Data\Profile 1"
    r"\.doubaowork\agent_mode\workspace\.user_skills\autojs-mobile-automation-yashu-public"
)

_HERE = os.path.dirname(os.path.abspath(__file__))


def _load_config():
    with open(os.path.join(_HERE, "config.json"), "r", encoding="utf-8") as f:
        return json.load(f)


CFG = _load_config()


def run_task(template, args=None, timeout=120):
    """下发 AutoJS 模板任务，返回内层 result（已二次解析 JSON）。"""
    cmd = ["node", "scripts/run-task.js", template]
    if args:
        cmd += ["--args", json.dumps(args, ensure_ascii=False)]
    try:
        p = subprocess.run(
            cmd, cwd=AUTOJS_SKILL_DIR, capture_output=True, text=True,
            timeout=timeout, encoding="utf-8", errors="replace")
    except subprocess.TimeoutExpired:
        return {"ok": 0, "err": f"任务 {template} 超时"}
    except FileNotFoundError:
        return {"ok": 0, "err": "找不到 node 或 AutoJS 技能目录"}
    out = (p.stdout or "").strip()
    if not out:
        return {"ok": 0, "err": f"任务 {template} 无输出"}
    try:
        outer = json.loads(out)
    except json.JSONDecodeError:
        return {"ok": 0, "err": f"回执解析失败: {out[:300]}"}
    result_raw = outer.get("result")
    if isinstance(result_raw, str):
        try:
            inner = json.loads(result_raw)
        except json.JSONDecodeError:
            inner = {"ok": 0, "err": f"result 解析失败: {result_raw[:300]}"}
    elif isinstance(result_raw, dict):
        inner = result_raw
    else:
        inner = {}
    inner["_task_id"] = outer.get("taskId", "")
    return inner


# ---------- 基础 ----------
def wait(ms):
    return run_task("wait", {"ms": int(ms)})


def key_back():
    return run_task("key", {"name": "back"})


def open_douyin():
    return run_task("open-app", {"pkg": CFG["douyin_pkg"]})


def swipe_up():
    return run_task("swipe", dict(CFG["swipe_coords"]))


def tap(x, y):
    return run_task("tap-point", {"x": int(x), "y": int(y)})


# ---------- 抖音互动 ----------
def like():
    x, y = CFG["like_coord"]
    return tap(x, y)


def open_comment_panel():
    x, y = CFG["comment_coord"]
    return tap(x, y)


def input_comment(text):
    x, y = CFG["comment_input_coord"]
    r1 = tap(x, y)
    if r1.get("ok") != 1:
        return r1
    wait(700)
    return run_task("input-text", {"text": text})


def send_comment():
    r = run_task("tap-text", {"text": CFG["send_comment_text"]})
    if r.get("ok") != 1:
        return tap(*CFG.get("send_comment_coord", [1296, 1776]))
    return r


def close_comment_panel():
    key_back()
    wait(500)
    key_back()
    wait(700)


# ---------- 感知 ----------

def _rapidocr_url():
    return CFG.get("rapidocr_url", "http://127.0.0.1:8765")


def rapidocr_health_check(timeout=5):
    """检查本地 RapidOCR 服务是否可用"""
    try:
        req = urllib.request.Request(_rapidocr_url() + "/health", method="GET")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            return body.get("code") == 0
    except Exception:
        return False


def rapidocr_ocr(image_path, timeout=60):
    """
    调用本地 RapidOCR /ocr 接口，直接上传图片文件。
    返回 {"ok":1, "full_text":"按行从上到下、行内从左到右的全文"}
    或 {"ok":0, "err":"原因"}
    只提取 full_text，不解析 items/box/score，节约内存与传递开销。
    """
    if not os.path.exists(image_path):
        return {"ok": 0, "err": f"截图文件不存在: {image_path}"}
    try:
        boundary = "----DouyinScrollBoundary" + str(int(os.times()[4] * 1000))
        filename = os.path.basename(image_path)
        with open(image_path, "rb") as f:
            file_data = f.read()

        body = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
            f"Content-Type: application/octet-stream\r\n\r\n"
        ).encode("utf-8") + file_data + f"\r\n--{boundary}--\r\n".encode("utf-8")

        req = urllib.request.Request(
            _rapidocr_url() + "/ocr",
            data=body,
            method="POST",
        )
        req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            result = json.loads(resp.read().decode("utf-8"))

        if result.get("code") != 0:
            return {"ok": 0, "err": result.get("message", "RapidOCR返回错误")}
        data = result.get("data", {})
        return {"ok": 1, "full_text": data.get("full_text", "")}
    except urllib.error.URLError as e:
        return {"ok": 0, "err": f"RapidOCR连接失败: {e.reason}（服务未启动？运行 D:\\software\\RapidOCR\\start_server.bat）"}
    except Exception as e:
        return {"ok": 0, "err": f"RapidOCR异常: {e}"}


def ocr_detail(region=None):
    """手机端 OCR（保留作为回退）"""
    args = {"detail": True}
    if region:
        args.update(region)
    return run_task("ocr", args)


def parse_bounds(bounds_str):
    m = re.match(r"Rect\((\d+), (\d+) - (\d+), (\d+)\)", bounds_str or "")
    if m:
        return tuple(int(g) for g in m.groups())
    return None


def ocr_texts_filtered():
    """
    整屏 OCR，返回过滤掉顶部/底部导航后的纯文本字符串。
    RapidOCR 的 full_text 已按行从上到下、行内从左到右排序，
    这里仅按行数跳过顶部状态栏/导航栏和底部Tab栏，不做坐标级过滤。
    失败时直接抛出异常，由上层停止程序（不回退手机端OCR）。
    """
    shot = screenshot()
    if shot.get("ok") != 1:
        raise RuntimeError(f"截图失败，无法进行OCR: {shot.get('err', '未知错误')}")
    img_path = shot.get("path")
    if not img_path or not os.path.exists(img_path):
        raise RuntimeError(f"截图文件不存在，无法进行OCR: {img_path}")

    r = rapidocr_ocr(img_path)
    if r.get("ok") != 1:
        raise RuntimeError(f"RapidOCR识别失败: {r.get('err', '未知错误')}")

    full_text = r.get("full_text", "") or ""
    lines = full_text.split("\n")
    skip_top = CFG.get("ocr_skip_top_lines", 2)
    skip_bottom = CFG.get("ocr_skip_bottom_lines", 2)
    if len(lines) > skip_top + skip_bottom:
        lines = lines[skip_top:len(lines) - skip_bottom]
    return "\n".join(lines)


# ---------- 录音 / 下载 ----------
def record_audio(duration):
    return run_task("record-audio", {"duration": int(duration)})


def download_file(phone_path, save_as=None):
    args = {"name": phone_path}
    if save_as:
        args["saveAs"] = save_as
    return run_task("download-file", args)


def screenshot():
    """整屏截图，返回 PC 端 PNG/JPG 路径"""
    return run_task("screenshot")
