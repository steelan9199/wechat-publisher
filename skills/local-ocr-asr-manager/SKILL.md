---
name: local-ocr-asr-manager
description: 管理本机两个本地离线 AI 服务——RapidOCR 图片文字识别（http://127.0.0.1:8765）与 sherpa-onnx 音频转文字（http://127.0.0.1:8000）。当用户说“打开OCR”“打开ASR”“一起打开/全开”“启动服务”“检查/查看OCR或ASR服务状态”“停止/关闭OCR或ASR”“重启OCR或ASR”等涉及启动、停止、查看这两个本地服务状态的话时使用。打开采用智能幂等：先探测健康状态，已运行则直接报告就绪，未运行才启动并验证。
---

# 本地 OCR / ASR 服务管理

用户口头要求打开 / 关闭 / 查看本地 OCR（图片文字识别）与 ASR（音频转文字）服务时使用本技能。

## 服务清单

| 服务 | 简称 | 端口 | 健康检查 | 说明 |
|---|---|---|---|---|
| RapidOCR | ocr | 8765 | `GET http://127.0.0.1:8765/health` | 图片文字识别（PP-OCRv6，项目 venv 解释器） |
| sherpa-onnx | asr | 8000 | `GET http://127.0.0.1:8000/health` | 音频转文字（SenseVoice，`python` 解释器） |

两个服务均只监听 `127.0.0.1`，仅本机可访问，全程离线。

## 唯一入口：管理脚本

所有操作通过 `scripts/service_manager.py` 完成（脚本必须用含 sherpa_onnx 的 `python` 运行）：

```powershell
python "<本技能目录>\scripts\service_manager.py" <action> <target>
```

- action：`status` | `start` | `stop` | `restart`
- target：`ocr` | `asr` | `all`（默认 `all`）

## 意图映射

| 用户说法 | action | target |
|---|---|---|
| 打开OCR / 启动OCR / 把OCR开起来 | start | ocr |
| 打开ASR / 启动ASR | start | asr |
| 一起打开 / 两个都开 / 全开 | start | all |
| 检查 / 查看服务状态 | status | all（或用户指定的服务） |
| 停止 / 关闭OCR | stop | ocr |
| 停止 / 关闭ASR | stop | asr |
| 重启 / 重开服务 | restart | 用户指定 |

## 汇报规范

- 脚本先打印每服务一行摘要，`---JSON---` 之后是结构化结果，**以 JSON 的 `status` 字段为准**，各取值对应向用户汇报的内容：
  - `running` / `already_running` → “服务已就绪 / 正在运行”
  - `started` / `restarted` → “启动 / 重启成功”
  - `stopped` / `not_running` → “已停止 / 本来就没在运行”
  - `error` → 向用户说明失败原因（端口占用、解释器缺失、启动后健康检查超时），并附日志路径
- 不要重复探测：脚本内部已完成幂等检查与启动后验证，按其输出汇报即可。

## 常见坑

- **运行脚本的解释器**：用 `python`（Python 3.14.7，已装 sherpa_onnx）。OCR 服务脚本内部自动使用其 venv 解释器（`D:\software\RapidOCR\.venv\Scripts\python.exe`），ASR 使用运行脚本的解释器或探测到的可用 `python`。
- **服务是独立进程**：以 DETACHED 方式启动，与 AI 会话无关，会话结束服务继续运行；停止按监听端口定位 PID 后终止，不误杀其他进程。
- **启动等待**：OCR / ASR 首次启动需加载模型（数秒），脚本会自动轮询健康检查，无需人工等待。
- **日志位置**：OCR → `D:\software\RapidOCR\server.{out,err}.log`；ASR → `D:\software\sherpa-onnx\server.{out,err}.log`。启动失败时以 `server.err.log` 排查。
