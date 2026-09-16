# -*- coding: utf-8 -*-
"""
本地 OCR / ASR 服务管理器（给 AI 使用）
=====================================
管理两个本地离线服务：
  - ocr: RapidOCR 图片文字识别   http://127.0.0.1:8765
  - asr: sherpa-onnx 音频转文字   http://127.0.0.1:8000

用法（脚本用任意 Python 3 运行即可，内部自动使用各服务固定 venv，不依赖调用方的 PATH）：
  python service_manager.py status  [ocr|asr|all]
  python service_manager.py start   [ocr|asr|all]   # 智能幂等：已运行则跳过
  python service_manager.py stop    [ocr|asr|all]
  python service_manager.py restart [ocr|asr|all]

输出：每服务一行人类可读摘要 + ---JSON--- 后的结构化结果。
退出码：任一服务 error 时返回 1，否则 0。
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request

SERVICES = {
    "ocr": {
        "name": "OCR",
        "desc": "RapidOCR 图片文字识别",
        "port": 8765,
        "health_url": "http://127.0.0.1:8765/health",
        "host": "127.0.0.1",
        "python": r"D:\software\RapidOCR\.venv\Scripts\python.exe",
        "probe_import": "rapidocr, fastapi",
        "script": r"D:\software\RapidOCR\ocr_server.py",
        "cwd": r"D:\software\RapidOCR",
        "args": [],
        "log_out": r"D:\software\RapidOCR\server.out.log",
        "log_err": r"D:\software\RapidOCR\server.err.log",
        "startup_sec": 30,
    },
    "asr": {
        "name": "ASR",
        "desc": "sherpa-onnx 音频转文字",
        "port": 8000,
        "health_url": "http://127.0.0.1:8000/health",
        "host": "127.0.0.1",
        "python": r"D:\software\sherpa-onnx\.venv\Scripts\python.exe",
        "probe_import": "sherpa_onnx, numpy",
        "script": r"D:\software\sherpa-onnx\asr_server.py",
        "cwd": r"D:\software\sherpa-onnx",
        "args": ["8000"],
        "log_out": r"D:\software\sherpa-onnx\server.out.log",
        "log_err": r"D:\software\sherpa-onnx\server.err.log",
        "startup_sec": 40,
    },
}

# --host 覆盖（None 表示各服务用自身默认 127.0.0.1）
HOST_OVERRIDE = None


def check_health(url, timeout=3):
    """返回 (ok: bool, detail: str)"""
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            if resp.status != 200:
                return False, "HTTP %d" % resp.status
            body = resp.read().decode("utf-8", "ignore")
            return True, body
    except Exception as e:
        return False, str(e)


def find_pids_by_port(port):
    """通过 netstat 查找监听指定端口的 PID（TCP/TCPv6），未找到返回 []"""
    try:
        out = subprocess.check_output(
            ["netstat", "-ano"], text=True, errors="ignore", timeout=20
        )
    except Exception:
        return []
    pat = re.compile(
        r"^\s*(TCP|TCPv6)\s+[^\s]*:%s\s+.*LISTENING\s+(\d+)\s*$"
        % re.escape(str(port)),
        re.IGNORECASE,
    )
    pids = set()
    for line in out.splitlines():
        m = pat.match(line)
        if m:
            pids.add(int(m.group(2)))
    return sorted(pids)


def probe_python(py, svc):
    """校验解释器能否导入该服务所需依赖；可用返回 True"""
    mods = svc.get("probe_import", "sherpa_onnx, numpy")
    try:
        r = subprocess.run(
            [py, "-c", "import %s" % mods],
            capture_output=True, timeout=20,
        )
        return r.returncode == 0
    except Exception:
        return False


def resolve_python(svc):
    """确定启动该服务使用的 Python 解释器路径；找不到返回 None。
    策略：优先服务自带固定 venv（对任意 AI 会话均有效），
    固定 venv 失效时才回退到 sys.executable / PATH 中的 python。
    """
    fixed = svc.get("python")
    if fixed and os.path.isfile(fixed) and probe_python(fixed, svc):
        return fixed
    candidates = []
    if sys.executable:
        candidates.append(sys.executable)
    for name in ("python", "py"):
        p = shutil.which(name)
        if p and p not in candidates:
            candidates.append(p)
    for cand in candidates:
        if probe_python(cand, svc):
            return cand
    return None


def status_service(key):
    svc = SERVICES[key]
    ok, detail = check_health(svc["health_url"])
    pids = find_pids_by_port(svc["port"])
    if ok:
        return {
            "status": "running",
            "service": key,
            "message": "%s 运行中（端口 %s，PID %s）" % (svc["desc"], svc["port"], pids or "未知"),
            "pid": pids,
            "health": detail,
        }
    return {
        "status": "stopped",
        "service": key,
        "message": "%s 未运行（端口 %s）" % (svc["desc"], svc["port"]),
        "pid": [],
        "health_error": detail,
    }


def start_service(key):
    svc = SERVICES[key]
    ok, detail = check_health(svc["health_url"])
    if ok:
        return {
            "status": "already_running",
            "service": key,
            "message": "%s 已就绪，无需启动" % svc["desc"],
            "pid": find_pids_by_port(svc["port"]),
            "health": detail,
        }
    py = resolve_python(svc)
    if not py:
        return {
            "status": "error",
            "service": key,
            "message": "未找到可用 Python 解释器（%s 依赖校验失败）" % svc.get("probe_import", ""),
            "hint": "固定 venv 缺失或损坏：OCR 用 %s，ASR 用 %s；重建方法见 SKILL.md『venv 重建』" % (
                SERVICES["ocr"]["python"], SERVICES["asr"]["python"]),
        }
    cmd = [py, svc["script"], str(svc["port"]), HOST_OVERRIDE or svc.get("host", "127.0.0.1")]
    try:
        with open(svc["log_out"], "a", encoding="utf-8") as fo, \
                open(svc["log_err"], "a", encoding="utf-8") as fe:
            proc = subprocess.Popen(
                cmd, cwd=svc["cwd"], stdout=fo, stderr=fe,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
                            | subprocess.DETACHED_PROCESS,
                close_fds=True,
            )
    except Exception as e:
        return {
            "status": "error",
            "service": key,
            "message": "启动进程失败: %s" % e,
        }
    deadline = time.time() + svc["startup_sec"]
    last_err = detail
    while time.time() < deadline:
        ok2, detail2 = check_health(svc["health_url"])
        if ok2:
            return {
                "status": "started",
                "service": key,
                "message": "%s 启动成功（PID %s）" % (svc["desc"], proc.pid),
                "pid": find_pids_by_port(svc["port"]),
                "health": detail2,
            }
        last_err = detail2
        time.sleep(2)
    return {
        "status": "error",
        "service": key,
        "message": "启动后 %ss 内健康检查未通过，最后错误: %s；请查看日志 %s"
                   % (svc["startup_sec"], last_err, svc["log_err"]),
    }


def stop_service(key):
    svc = SERVICES[key]
    pids = find_pids_by_port(svc["port"])
    if not pids:
        ok, _ = check_health(svc["health_url"])
        if ok:
            return {
                "status": "error",
                "service": key,
                "message": "端口 %s 未找到监听进程但健康检查通过，无法定位 PID" % svc["port"],
            }
        return {
            "status": "not_running",
            "service": key,
            "message": "%s 本来就没在运行" % svc["desc"],
        }
    killed = []
    for pid in pids:
        try:
            subprocess.run(
                ["taskkill", "/F", "/PID", str(pid)],
                capture_output=True, timeout=20,
            )
            killed.append(pid)
        except Exception:
            pass
    # 等待端口释放
    for _ in range(10):
        if not find_pids_by_port(svc["port"]):
            break
        time.sleep(1)
    ok, _ = check_health(svc["health_url"])
    if ok:
        return {
            "status": "error",
            "service": key,
            "message": "已终止 PID %s 但服务仍响应，可能有多实例" % killed,
        }
    return {
        "status": "stopped",
        "service": key,
        "message": "%s 已停止（终止 PID %s）" % (svc["desc"], killed),
    }


def restart_service(key):
    r1 = stop_service(key)
    r2 = start_service(key)
    if r2.get("status") in ("started", "already_running"):
        r2["status"] = "restarted"
        r2["message"] = "%s 已重启" % SERVICES[key]["desc"]
    return r2


def main():
    global HOST_OVERRIDE
    parser = argparse.ArgumentParser(description="本地 OCR/ASR 服务管理器")
    parser.add_argument("action", choices=["status", "start", "stop", "restart"])
    parser.add_argument("target", nargs="?", default="all",
                        choices=["ocr", "asr", "all"])
    parser.add_argument("--host", default=None,
                        help="服务监听地址：默认 127.0.0.1（仅本机）；传 0.0.0.0 允许局域网/手机访问（需配合防火墙放行）")
    args = parser.parse_args()
    HOST_OVERRIDE = args.host
    keys = ["ocr", "asr"] if args.target == "all" else [args.target]
    results = {}
    for k in keys:
        if args.action == "status":
            results[k] = status_service(k)
        elif args.action == "start":
            results[k] = start_service(k)
        elif args.action == "stop":
            results[k] = stop_service(k)
        elif args.action == "restart":
            results[k] = restart_service(k)
    for k in keys:
        r = results[k]
        print("[%s] %s - %s" % (k.upper(), r["status"], r["message"]))
    print("---JSON---")
    print(json.dumps(results, ensure_ascii=False, indent=2))
    if any(r.get("status") == "error" for r in results.values()):
        sys.exit(1)


if __name__ == "__main__":
    main()
