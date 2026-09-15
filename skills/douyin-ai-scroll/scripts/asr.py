# -*- coding: utf-8 -*-
"""
asr.py — 本地 sherpa-onnx 语音转文本封装
通过本地 HTTP 服务（SenseVoice 模型）识别音频，全程离线，无限流。
服务地址由 config.json 的 sherpa_onnx_url 配置，默认 http://127.0.0.1:8000
"""
import json
import os
import urllib.request
import urllib.error


def _get_server_url():
    """从 config.json 读取服务地址，默认 8000 端口"""
    try:
        cfg_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
        with open(cfg_path, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        return cfg.get("sherpa_onnx_url", "http://127.0.0.1:8000")
    except Exception:
        return "http://127.0.0.1:8000"


def health_check(timeout=5):
    """检查本地 ASR 服务是否可用"""
    url = _get_server_url() + "/health"
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            return body.get("status") == "ok"
    except Exception:
        return False


def asr_file(audio_path, language="zh", timeout=120):
    """
    本地音频文件 → 识别文本。
    返回 {"ok":1, "text":..., "segments":[...], "duration":..., "elapsed":...}
    或 {"ok":0, "err":"原因"}
    """
    if not os.path.exists(audio_path):
        return {"ok": 0, "err": f"音频文件不存在: {audio_path}"}
    if os.path.getsize(audio_path) == 0:
        return {"ok": 0, "err": "音频文件为空"}

    url = _get_server_url() + "/transcribe"
    try:
        with open(audio_path, "rb") as f:
            data = f.read()
        req = urllib.request.Request(url, data=data, method="POST")
        req.add_header("Content-Type", "application/octet-stream")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        text = body.get("text", "")
        return {
            "ok": 1,
            "text": text,
            "segments": body.get("segments", []),
            "duration": body.get("duration_sec"),
            "elapsed": body.get("elapsed_sec"),
        }
    except urllib.error.HTTPError as e:
        try:
            err_body = json.loads(e.read().decode("utf-8"))
            err_msg = err_body.get("error", str(e))
        except Exception:
            err_msg = f"HTTP {e.code}"
        return {"ok": 0, "err": f"ASR HTTP错误: {err_msg}"}
    except urllib.error.URLError as e:
        return {"ok": 0, "err": f"ASR连接失败: {e.reason}（服务未启动？运行 python D:\\software\\sherpa-onnx\\asr_server.py 8000）"}
    except Exception as e:
        return {"ok": 0, "err": f"ASR异常: {e}"}
