---
name: local-ocr-asr-manager-yashu
description: 管理本机两个本地离线 AI 服务——RapidOCR 图片文字识别（127.0.0.1:8765）与 sherpa-onnx 音频转文字（127.0.0.1:8000），提供启动、停止、重启、查看状态。当用户提到“打开/启动/停止/关闭/重启 OCR 或 ASR”“OCR / ASR 服务在跑吗”“检查本地识别服务状态”“把图片识别/音频转文字服务开起来”等涉及这两个本地服务生命周期或状态的话时使用。启动采用智能幂等：先探测健康状态，已运行则直接报告就绪，未运行才启动并验证。
---

# 本地 OCR / ASR 服务管理

用户口头要求打开 / 关闭 / 查看本地 OCR（图片文字识别）与 ASR（音频转文字）服务时使用本技能。

## 服务清单

| 服务 | 简称 | 端口 | 健康检查 | 固定解释器（venv） | 说明 |
|---|---|---|---|---|---|
| RapidOCR | ocr | 8765 | `GET http://127.0.0.1:8765/health` | `D:\software\RapidOCR\.venv\Scripts\python.exe` | 图片文字识别（PP-OCRv6） |
| sherpa-onnx | asr | 8000 | `GET http://127.0.0.1:8000/health` | `D:\software\sherpa-onnx\.venv\Scripts\python.exe` | 音频转文字（SenseVoice） |

两个服务默认只监听 `127.0.0.1`（仅本机可访问，全程离线）；如需从手机 / 局域网其他设备访问，见下文「局域网 / 手机访问」。

## 唯一入口：管理脚本

所有操作通过 `scripts/service_manager.py` 完成。**脚本用任意 Python 3 运行即可**（脚本本身只用标准库；两个服务各自使用上表的固定 venv 解释器，由脚本内部自动选定，不依赖调用方 `python` 的 PATH 解析）：

```powershell
python "<本技能目录>\scripts\service_manager.py" <action> <target> [--host <地址>]
```

- action：`status` | `start` | `stop` | `restart`
- target：`ocr` | `asr` | `all`（默认 `all`）
- `--host`（可选）：服务监听地址，默认 `127.0.0.1`（仅本机）；传 `0.0.0.0` 允许局域网 / 手机访问（需配合防火墙放行，见下文）

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

## 解释器策略（跨 AI 兼容的关键设计）

- 两个服务的解释器都是**固定 venv 绝对路径**（见服务清单），脚本解析顺序：**固定 venv → `sys.executable` → PATH 中 `python`/`py`**，并分别按服务校验依赖（OCR 校验 `rapidocr, fastapi`；ASR 校验 `sherpa_onnx, numpy`）。
- 因此**无论哪个 AI 会话、其 PATH 里 `python` 解析到哪个解释器，本技能都能正常工作**：ASR 不再依赖“PATH 里恰好有装了 sherpa_onnx 的 python”。
- 若固定 venv 被删除/损坏，脚本会回退探测并明确报错（提示见 JSON 的 `hint` 字段）。

## venv 重建（仅当固定 venv 缺失或损坏时）

```powershell
# OCR（RapidOCR，需 fastapi/uvicorn 等 Web 依赖）
uv venv "D:\software\RapidOCR\.venv"
uv pip install --python "D:\software\RapidOCR\.venv\Scripts\python.exe" rapidocr fastapi uvicorn numpy pillow pydantic requests

# ASR（sherpa-onnx，注意：asr_server.py 依赖 numpy，必须一并安装）
uv venv "D:\software\sherpa-onnx\.venv"
uv pip install --python "D:\software\sherpa-onnx\.venv\Scripts\python.exe" sherpa-onnx numpy
```

重建后分别验证导入：`& "…\Scripts\python.exe" -c "import rapidocr, fastapi"` 与 `import sherpa_onnx, numpy` 均无报错即恢复。

## 接口调用（服务就绪后）

服务启动后，其他程序 / AI 通过 HTTP 调用。**调用前先 `GET /health` 确认服务已运行；未运行则用上方管理脚本 `start` 启动，不要直接请求。**

> 本节只给**指路 + 一行 curl 速查**。完整参数表、响应结构、错误码、Python / 其他语言示例，一律以下方两个源文档为准（单一事实来源，避免重复维护漂移）。

### ASR 音频转文字（端口 8000）

- **接口规范文档**：`D:\software\sherpa-onnx\AI-USE-GUIDE.md`

| 接口 | 请求要点 | 响应要点 |
|---|---|---|
| `GET /health` | 无 | `{"status":"ok", ...}` |
| `POST /transcribe` | body **直接放音频文件二进制**（不要 JSON / base64）；支持 wav/mp3/m4a/flac/ogg/aac，上限 500MB | JSON：`text`（完整文本）、`segments`（分段+时间）、`duration_sec` |
| `POST /srt` | 同上 | 标准 SRT 字幕文本（`text/plain`） |

```bash
curl http://127.0.0.1:8000/health
curl -X POST --data-binary "@audio.mp3" http://127.0.0.1:8000/transcribe
curl -X POST --data-binary "@audio.mp3" http://127.0.0.1:8000/srt -o subtitle.srt
```

### OCR 图片文字识别（端口 8765）

- **接口规范文档**：`D:\software\RapidOCR\README-AI.md`

| 接口 | 请求要点 | 响应要点 |
|---|---|---|
| `GET /health` | 无 | `{"code":0, "message":"ok", ...}` |
| `POST /ocr` | `multipart/form-data` 上传 `file` 字段（png/jpg/bmp/webp/tiff） | 统一结构：`data.full_text` 分行全文（最常用）、`data.lines`、`data.items` |
| `POST /ocr/base64` | JSON body：`{"image_base64": "<不含前缀的base64>"}` | 同上 |
| `POST /ocr/url` | JSON body：`{"url": "https://..."}` | 同上 |

```bash
curl http://127.0.0.1:8765/health
curl -X POST "http://127.0.0.1:8765/ocr" -F "file=@image.png"
curl -X POST "http://127.0.0.1:8765/ocr/base64" -H "Content-Type: application/json" -d '{"image_base64":"<b64字符串>"}'
curl -X POST "http://127.0.0.1:8765/ocr/url" -H "Content-Type: application/json" -d '{"url":"https://example.com/image.png"}'
```

**通用约定**：
- OCR 识别为空时 `code` 仍为 `0`，`full_text` 为 `""`——先看 `code`，再看 `full_text`。
- OCR 错误走 HTTP 400/422 + `{"detail": ...}`；ASR 错误走 HTTP 4xx/5xx + `{"error": ...}`；网络层失败 = 服务未启动。
- 参数细节（`min_score`、`use_det` 等）和调用示例详见对应源文档。

## 局域网 / 手机访问

让手机（或其他设备）调用电脑上的 OCR / ASR API，前提是**手机和电脑在同一局域网（同一 WiFi）**，步骤如下：

**1. 以 `0.0.0.0` 启动服务**（监听所有网卡，不再只绑本机）：

```powershell
python "<本技能目录>\scripts\service_manager.py" start all --host 0.0.0.0
```

**2. 防火墙放行端口**（一次性配置，已配好；重装系统后需重做）：

```powershell
netsh advfirewall firewall add rule name="Local OCR 8765" dir=in action=allow protocol=TCP localport=8765
netsh advfirewall firewall add rule name="Local ASR 8000" dir=in action=allow protocol=TCP localport=8000
```

**3. 查电脑局域网 IP**（找 `192.168.x.x` 那个，`198.18.x.x` 等是虚拟网卡）：

```powershell
ipconfig | findstr /i "IPv4"
```

**4. 手机访问地址**：`http://<电脑局域网IP>:8765`（OCR）和 `http://<电脑局域网IP>:8000`（ASR），接口路径同「接口调用」章节。

**注意事项**：
- **安全**：`0.0.0.0` 会把服务暴露给整个局域网，且两个服务均无鉴权——仅在可信网络使用，用完后建议 `stop` 或改回默认 `127.0.0.1` 重启。
- **IP 变化**：路由器重启 / DHCP 换租期后电脑 IP 可能变化，手机访问地址需同步更新（可用 `ipconfig` 重新确认）。
- **不在同一网络**（手机用 4G/5G 流量等）：局域网 IP 无法直连，需要内网穿透（ngrok / frp / tailscale 等），不在本技能范围。
- 服务重启后仍需带 `--host 0.0.0.0` 启动，否则回到仅本机模式。

## 常见坑

- **运行脚本的解释器**：任意 Python 3 均可，脚本内部自动使用各服务固定 venv；不要手动指定 `python` 解析，也不要用 `python` 直跑 `asr_server.py`（那样依赖 PATH 里的解释器）。
- **服务是独立进程**：以 DETACHED 方式启动，与 AI 会话无关，会话结束服务继续运行；停止按监听端口定位 PID 后终止，不误杀其他进程。
- **启动等待**：OCR / ASR 首次启动需加载模型（数秒），脚本会自动轮询健康检查，无需人工等待。
- **日志位置**：OCR → `D:\software\RapidOCR\server.{out,err}.log`；ASR → `D:\software\sherpa-onnx\server.{out,err}.log`。启动失败时以 `server.err.log` 排查。
