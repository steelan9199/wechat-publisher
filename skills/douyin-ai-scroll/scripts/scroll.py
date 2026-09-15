# -*- coding: utf-8 -*-
"""
scroll.py — 采集主循环（v2 升级版）
========================================
职责（阶段一：采集）：脚本自动刷满指定时长，把每个视频/直播间的
ASR 文本、截图、动作、互动写入 sqlite。**不做精确评分和AI视觉分析**
——评分与AI视觉分析由 AI 在复盘阶段亲自完成（见 SKILL.md）。

v2 升级：
- ASR 换成本地 sherpa-onnx（离线、无限流、速度快）
- 截图/音频/数据库统一存到 media_root（config.json 配置）
- ASR 失败时打印详细错误，增加指数退避
- 启动时自动检查 sherpa-onnx 服务状态

流程（每"窗口"≈8 秒）：
  OCR 直播检测 → 直播间（含直播卡片/真直播间，统一处理）: 只听不操作(上限后上滑离开)
              → 普通视频: 固定听 N 窗口 → 广告兜底词提前滑走
                          → 看心情互动(概率点赞/评论) → 上滑下一个

用法:
  python scroll.py [--minutes 60] [--smoke 2] [--keep-audio]
"""
import argparse
import json
import os
import random
import shutil
import sys
import time

import asr as asr_mod
import db as db_mod
import douyin_ops as ops

_HERE = os.path.dirname(os.path.abspath(__file__))


def load_config():
    with open(os.path.join(_HERE, "config.json"), "r", encoding="utf-8") as f:
        return json.load(f)


CFG = load_config()
MEDIA_ROOT = CFG.get("media_root", os.path.join(_HERE, "..", "data"))

# ASR 连续失败退避计数器
_asr_fail_count = 0
_asr_backoff_sec = 0


# ---------------- 工具 ----------------

def detect_live(text):
    """OCR 文本 → 'live' / 'none'（不再区分直播卡片和真直播间，统一按直播间处理）"""
    if not text:
        return "none"
    for kw in CFG["live_keywords"]:
        if kw in text:
            return "live"
    return "none"


def is_ad(text):
    """广告兜底词（仅流控，不算评分）"""
    t = text or ""
    return any(k in t for k in CFG["ad_block_keywords"])


def _asr_with_backoff(pc_path):
    """
    带指数退避的 ASR 调用。
    连续失败时等待时间递增（2s→5s→10s→20s），避免持续触发问题。
    返回 asr_file 的结果 dict。
    """
    global _asr_fail_count, _asr_backoff_sec

    # 如果之前有连续失败，先退避等待
    if _asr_backoff_sec > 0:
        print(f"  [ASR退避] 等待 {_asr_backoff_sec}s 后重试...")
        time.sleep(_asr_backoff_sec)

    res = asr_mod.asr_file(pc_path)
    if res.get("ok") == 1:
        _asr_fail_count = 0
        _asr_backoff_sec = 0
        return res

    # 第一次失败：等1.5秒重试一次
    err1 = res.get("err", "未知错误")
    print(f"  [ASR失败1] {err1}")
    time.sleep(1.5)
    res = asr_mod.asr_file(pc_path)
    if res.get("ok") == 1:
        _asr_fail_count = 0
        _asr_backoff_sec = 0
        return res

    # 第二次失败：记录并增加退避
    err2 = res.get("err", "未知错误")
    print(f"  [ASR失败2] {err2}")
    _asr_fail_count += 1
    # 指数退避：2, 5, 10, 20, 30（封顶30秒）
    backoff_table = [0, 2, 5, 10, 20, 30]
    idx = min(_asr_fail_count, len(backoff_table) - 1)
    _asr_backoff_sec = backoff_table[idx]
    return res


def capture_window(session_id, tag, keep_audio):
    """录音→下载→ASR 完整链路。返回 {"ok":1,"text":...,"audio_path":...} 或 {"ok":0,"err":...}"""
    r = ops.record_audio(CFG["listen_window_sec"])
    if r.get("ok") != 1:
        return {"ok": 0, "err": "录音失败"}
    phone_path = r.get("path")
    if not phone_path:
        return {"ok": 0, "err": "录音无路径"}

    dl = ops.download_file(phone_path)
    if dl.get("ok") != 1:
        time.sleep(1.5)
        dl = ops.download_file(phone_path)
    if dl.get("ok") != 1:
        return {"ok": 0, "err": "下载失败"}
    pc_path = dl.get("path")
    if not pc_path:
        return {"ok": 0, "err": "下载无路径"}

    audio_saved_path = ""
    if keep_audio:
        aud_dir = os.path.join(MEDIA_ROOT, "audio", f"session_{session_id}")
        os.makedirs(aud_dir, exist_ok=True)
        try:
            dest = os.path.join(aud_dir, f"{tag}.wav")
            shutil.move(pc_path, dest)
            pc_path = dest
            audio_saved_path = dest
        except OSError as e:
            print(f"  [音频归档失败] {e}")

    res = _asr_with_backoff(pc_path)
    if res.get("ok") != 1:
        return {"ok": 0, "err": res.get("err", "ASR失败"), "audio_path": audio_saved_path}
    return {"ok": 1, "text": res.get("text", ""), "audio_path": audio_saved_path}


def save_screenshot(session_id, tag):
    """
    截屏并归档到 media_root/screenshots/session_<id>/<tag>.jpg。
    返回本地持久路径；截图关闭或失败时返回 None。
    """
    if not CFG.get("capture_screenshots", True):
        return None
    r = ops.screenshot()
    if r.get("ok") != 1:
        return None
    pc_path = r.get("path")
    if not pc_path:
        return None
    shot_dir = os.path.join(MEDIA_ROOT, "screenshots", f"session_{session_id}")
    os.makedirs(shot_dir, exist_ok=True)
    dest = os.path.join(shot_dir, f"{tag}.jpg")
    try:
        shutil.copy(pc_path, dest)
    except OSError:
        return None
    return dest


# ---------------- 直播间（只听不操作） ----------------

def run_live_listen(dbin, session_id):
    live_id = dbin.add_live(session_id)
    shot = save_screenshot(session_id, f"live{live_id}")
    if shot:
        dbin.set_live_screenshot(live_id, shot)
    live_windows = 0
    max_w = CFG["live_max_windows"]
    while live_windows < max_w:
        res = capture_window(session_id, f"live{live_id}_w{live_windows+1}", KEEP_AUDIO)
        if res.get("ok") == 1:
            dbin.add_live_window(live_id, session_id, res["text"], res.get("audio_path", ""))
            print(f"  [直播间#{live_id} 窗口{live_windows+1}] {res['text'][:60]}")
        else:
            print(f"  [直播间#{live_id} 窗口失败] {res.get('err')}")
            time.sleep(2)
        live_windows += 1

        if live_windows % CFG["live_check_every"] == 0:
            try:
                text = ops.ocr_texts_filtered()
                if text and detect_live(text) != "live":
                    dbin.finish_live(live_id, "detected_exit")
                    print(f"  [直播间#{live_id}] 检测到已离开直播间")
                    return
            except RuntimeError as e:
                print(f"  [直播间#{live_id}] OCR检测失败: {e}")
                # OCR失败不中断直播间监听，继续听完上限
        time.sleep(0.5)

    ops.swipe_up()
    time.sleep(1.0)
    dbin.finish_live(live_id, "max_windows")
    print(f"  [直播间#{live_id}] 听满上限，上滑离开")


# ---------------- 普通视频 ----------------

def handle_video(dbin, session_id, video_id):
    """固定听 N 窗口 + 广告提前滑 + 看心情互动。返回 (action, liked, commented, comment_text)"""
    liked = commented = 0
    comment_text = ""
    action = "watching"
    ad_hit = False

    for w in range(CFG["windows_per_video"]):
        res = capture_window(session_id, f"v{video_id}_w{w+1}", KEEP_AUDIO)
        if res.get("ok") != 1:
            print(f"  [窗口失败] {res.get('err')}")
            time.sleep(2)
            continue
        text = res["text"]
        dbin.add_video_window(video_id, session_id, text, res.get("audio_path", ""))
        print(f"  [视频#{video_id} 窗口{w+1}] {text[:60]}")
        if is_ad(text):
            ad_hit = True
            break

    if ad_hit:
        action = "ad_block"
        ops.swipe_up()
        time.sleep(1.2)
        dbin.finish_video(video_id, action)
        return

    # 看心情互动：有实质文本时按概率点赞/评论（每视频最多各一次）
    rows = dbin.conn.execute(
        "SELECT text_full FROM videos WHERE id=?", (video_id,)).fetchone()
    full_text = (rows[0] if rows else "") or ""
    if len(full_text.strip()) >= 8:
        if random.random() < CFG["like_probability"]:
            ops.like()
            liked = 1
            time.sleep(0.6)
        if random.random() < CFG["comment_probability"]:
            cmt = random.choice(CFG["comment_templates"])
            if do_comment(cmt):
                commented = 1
                comment_text = cmt
            time.sleep(0.8)

    ops.swipe_up()
    time.sleep(1.2)
    dbin.finish_video(video_id, action, liked, commented, comment_text)


def do_comment(text):
    try:
        r1 = ops.open_comment_panel()
        if r1.get("ok") != 1:
            return False
        ops.wait(1000)
        r2 = ops.input_comment(text)
        if r2.get("ok") != 1:
            ops.close_comment_panel()
            return False
        ops.wait(700)
        r3 = ops.send_comment()
        ops.wait(700)
        ops.close_comment_panel()
        return r3.get("ok") == 1
    except Exception:  # noqa: BLE001
        return False


# ---------------- 主循环 ----------------

KEEP_AUDIO = False


def check_asr_service():
    """启动前检查本地 sherpa-onnx ASR 服务"""
    print("[检查] 本地 ASR 服务 (sherpa-onnx)...")
    if asr_mod.health_check(timeout=5):
        print("  ✓ ASR 服务正常")
        return True
    else:
        print("  ✗ ASR 服务未响应！")
        print(f"  请先启动: python D:\\software\\sherpa-onnx\\asr_server.py 8000")
        print("  等待5-10秒加载模型后，用 curl http://127.0.0.1:8000/health 确认")
        return False


def check_ocr_service():
    """启动前检查本地 RapidOCR 服务"""
    print("[检查] 本地 OCR 服务 (RapidOCR)...")
    if ops.rapidocr_health_check(timeout=5):
        print("  ✓ OCR 服务正常")
        return True
    else:
        print("  ✗ OCR 服务未响应！")
        print(f"  请先启动: D:\\software\\RapidOCR\\start_server.bat")
        print("  等待服务就绪后，用 curl http://127.0.0.1:8765/health 确认")
        return False


def main():
    global KEEP_AUDIO
    ap = argparse.ArgumentParser()
    ap.add_argument("--minutes", type=int, default=None)
    ap.add_argument("--smoke", type=int, default=0, help="冒烟测试 N 分钟")
    ap.add_argument("--keep-audio", action="store_true", help="保留录音 wav 到 media_root/audio/")
    ap.add_argument("--skip-asr-check", action="store_true", help="跳过启动时ASR服务检查")
    args = ap.parse_args()

    # KEEP_AUDIO：命令行参数优先，其次 config.json，默认 False
    KEEP_AUDIO = args.keep_audio or CFG.get("keep_audio", False)

    minutes = args.minutes or (args.smoke if args.smoke else 60)
    total_sec = int(minutes * 60)
    start = time.time()

    print(f"[采集] 目标 {minutes} 分钟，每视频听 {CFG['windows_per_video']} 窗口")
    print(f"[采集] 媒体文件根目录: {MEDIA_ROOT}")
    print(f"[采集] 保留音频: {'是' if KEEP_AUDIO else '否'}")

    # 检查 ASR 服务
    if not args.skip_asr_check:
        if not check_asr_service():
            print("[错误] ASR 服务未启动，无法继续。请先启动服务后重试。")
            print("  如需跳过检查，加 --skip-asr-check 参数")
            sys.exit(1)

    # 检查 OCR 服务
    if not check_ocr_service():
        print("[错误] OCR 服务未启动，无法继续。请先启动服务后重试。")
        sys.exit(1)

    # 打开抖音（兼作中继连通性验证）
    r = ops.open_douyin()
    if r.get("ok") != 1:
        print(f"[错误] 打开抖音失败: {r.get('err')}，请检查手机中继连接")
        sys.exit(1)
    ops.wait(2500)

    dbin = db_mod.DB()
    session_id = dbin.new_session(minutes)
    print(f"[采集] 会话 #{session_id} 开始，数据将写入 {db_mod.DB_PATH}")

    consecutive_fail = 0
    try:
        while time.time() - start < total_sec:
            # 直播检测（RapidOCR，失败直接抛异常停止）
            try:
                text = ops.ocr_texts_filtered()
            except RuntimeError as e:
                print(f"\n[致命错误] OCR失败，停止采集: {e}")
                break
            state = detect_live(text)
            if state == "live":
                print("[直播间] 进入只听模式……")
                run_live_listen(dbin, session_id)
                consecutive_fail = 0
                continue

            # 普通视频
            video_id = dbin.add_video(session_id)
            shot = save_screenshot(session_id, f"v{video_id}")
            if shot:
                dbin.set_video_screenshot(video_id, shot)
            before = dbin.session_stats(session_id)
            handle_video(dbin, session_id, video_id)
            after = dbin.session_stats(session_id)
            consecutive_fail = 0
            # 进度
            elapsed = time.time() - start
            print(f"[进度] 已用 {int(elapsed)}s / {total_sec}s | "
                  f"视频 {after['videos']} 直播间 {after['lives']}")

    except KeyboardInterrupt:
        print("\n[中断] 用户终止采集")

    stats = dbin.session_stats(session_id)
    dbin.finish_session(session_id, stats)
    dbin.close()
    print(f"\n[采集完成] 会话 #{session_id}")
    print(f"  视频 {stats['videos']} 个 | 直播间 {stats['lives']} 个 | "
          f"录音窗口 {stats['windows']} 个 | 点赞 {stats['likes']} | 评论 {stats['comments']}")
    print(f"  数据库: {db_mod.DB_PATH}")
    print(f"  截图: {os.path.join(MEDIA_ROOT, 'screenshots', f'session_{session_id}')}")
    if KEEP_AUDIO:
        print(f"  音频: {os.path.join(MEDIA_ROOT, 'audio', f'session_{session_id}')}")
    print("  下一步：")
    print("    1. AI 视觉分析：python vision_analyzer.py list <session_id>  → AI逐个Read截图分析写回")
    print("    2. ASR文本评分：python report.py dump <session_id> → AI评分 → report.py score 写回")
    print("    3. 生成报告：python report.py report <session_id>")


if __name__ == "__main__":
    main()
