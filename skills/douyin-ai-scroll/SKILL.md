---
name: douyin-ai-scroll
description: AI 自主刷抖音 Skill（v2 本地离线版）。用户要求 AI 用手机刷抖音/短视频并真正听懂内容、按 AI 自己的兴趣评分时使用。触发场景：让 AI 自己刷抖音/刷短视频（如"帮我刷抖音"、"AI 去刷一会儿抖音"、"刷一个小时抖音并说说看了什么"、"AI 自主刷视频"），需要模拟真人刷抖音、记录看过哪些视频/直播间、给内容打分并解释为什么感兴趣。全程自动操作手机（AutoJS 中继），本地离线 ASR（sherpa-onnx）+ 本地离线 OCR（RapidOCR）+ AI 视觉分析截图，刷完后由 AI 亲自复盘评分并生成报告。
---

# AI 自主刷抖音（v2 本地离线版）

三阶段架构：
1. **采集**（`scripts/scroll.py`）：全自动刷，把每个视频/直播间的 ASR 文本、截图、音频、动作写入 sqlite。不做评分。
2. **AI 视觉分析**（`scripts/vision_analyzer.py` + AI 亲自做）：AI 逐个 Read 截图，提取作者/标题/点赞/评论/收藏/转发/内容概要，写回数据库。
3. **复盘评分**（AI 亲自做）：读文本 + AI视觉信息 → 按 `references/scoring.md` 标准亲自打分写理由 → 生成复盘报告交付。

## 前置条件（先检查，不满足先解决）

### 1. 手机 AutoJS 中继
```powershell
curl.exe http://localhost:9421/health
```
返回 `"phone":"connected"` 即正常。

### 2. 本地 ASR 服务（sherpa-onnx）
```powershell
# 检查
curl.exe http://127.0.0.1:8000/health
# 未启动则运行
python D:\software\sherpa-onnx\asr_server.py 8000
```
- 模型：SenseVoice（阿里达摩院），支持中/粤/英/日/韩
- 速度：8秒音频约0.25秒识别完成
- 全程离线，无限流

### 3. 本地 OCR 服务（RapidOCR）
```powershell
# 检查
curl.exe http://127.0.0.1:8765/health
# 未启动则双击运行
D:\software\RapidOCR\start_server.bat
```
- 模型：PP-OCRv6（ONNXRuntime推理）
- 速度：CPU单张约0.5~2秒
- 准确率：置信度普遍0.93~1.00
- **返回格式**：`data.full_text` 为按行从上到下、行内从左到右排序的全文（行间 `\n` 分隔），代码中**只使用 full_text**，不解析 items/box/score 以节约开销
- **失败直接抛异常停止程序，不回退手机端OCR**

### 4. 手机状态
- 手机上有抖音，屏幕常亮、音量适中（录音走麦克风，需外放）
- 依赖已就绪：AutoJS 技能（`autojs-mobile-automation-yashu-public`）

## 执行流程

### 阶段一：采集

```powershell
cd <本技能目录>\scripts

# 冒烟测试 2 分钟（验证全流程）
python scroll.py --smoke 2

# 正式刷 N 分钟
python scroll.py --minutes 30

# 可选参数
python scroll.py --minutes 60 --keep-audio      # 强制保留音频
python scroll.py --minutes 60 --skip-asr-check  # 跳过启动时服务检查
```

脚本自动：开抖音 → 循环（本地OCR直播检测 → 直播间只听 / 普通视频听N窗口+ASR）→ 全部写入 sqlite + 截图 + 音频。
结束时输出 `会话 #<id>` 和统计。**等待期间无需干预**；用户想提前停就 Ctrl+C，数据已落库。

启动时自动检查 sherpa-onnx 和 RapidOCR 服务状态，未启动则报错退出。

### 阶段二：AI 视觉分析（采集完成后）

```powershell
# 列出当前会话所有待分析截图路径
python vision_analyzer.py list <session_id>
```

AI 逐个 Read 截图，按以下 JSON 格式分析每个视频/直播间：
```json
{
  "author": "@重阳2077",
  "title": "第31集 | 100多个AI应用开源合集...",
  "like_count": 89,
  "comment_count": 12,
  "favorite_count": 118,
  "share_count": 7,
  "content_summary": "视频介绍了一个GitHub开源项目...",
  "is_live": 0,
  "raw_note": "可选补充备注"
}
```

然后调用 `VisionAnalyzer.write_video_result(video_id, result)` / `write_live_result(live_id, result)` 写回数据库。

### 阶段三：复盘评分 + 生成报告

```powershell
# 1. 读待评分文本（含AI视觉提取的作者/标题/互动数据）
python report.py dump <session_id>

# 2. AI 逐条理解、打分、写理由、贴主题标签，生成 scores.json
#    评分标准见 references/scoring.md

# 3. 写回评分
python report.py score <session_id> scores.json

# 4. 生成报告骨架
python report.py report <session_id>
```

AI 补写「我的偏好画像」「自我总结」两节（用第一人称，从高分内容/主题标签/AI视觉提取的作者类型归纳）。

## 硬约束（不可违反）

- 手机上只有抖音，**禁止打开其他 APP**
- **直播间禁止点赞/评论/送礼**：脚本只录音理解，听满上限自动上滑离开；直播入口卡片也进入只听模式（v2不再跳过）
- 普通视频可点赞/评论，由采集脚本按概率"看心情"执行
- **OCR失败直接停止程序**：RapidOCR服务不可用时抛异常退出，不回退手机端OCR
- 全流程只读+轻互动，不删除/修改任何用户数据
- ASR/OCR均为本地离线服务，数据不上传云端

## 数据位置

所有媒体文件统一存到配置的 `media_root`（默认：`F:\obsidian\obsidian-data-master\53AI手机自动化\03AI手机看懂某音视频\04媒体文件\`）：

```
04媒体文件/
├── screenshots/           # 截图，按 session_<id>/ 分组
│   └── session_5/
│       ├── v7.jpg
│       └── live1.jpg
├── audio/                 # 音频（默认保留），按 session_<id>/ 分组
│   └── session_5/
│       ├── v7_w1.wav
│       └── live1_w1.wav
└── database/              # 数据库文件
    └── douyin_ai.db
```

- 数据库表：`sessions`（每次运行）、`videos`（视频+评分+AI视觉信息+截图/音频路径）、`lives`（直播间）、`windows`（每窗口原始文本+音频路径）
- **videos 表 v2 新增字段**：author, title, like_count, comment_count, favorite_count, share_count, content_summary, is_live, ai_vision_raw, audio_path
- 可用 `python report.py export <session_id>` 导出 JSON（含截图/音频路径）

## 直播检测（v2 简化版）

不再区分"直播卡片"和"真直播间"，统一检测为 `live`，只要命中任意直播关键词即进入只听模式。

直播关键词（24个，config.json 的 `live_keywords`）：
```
直播间、直播中、正在直播、直播发现、直播广场、
小时榜、人气榜、礼物、粉丝团、福袋、连麦、
付费连线、匿名连线、加入连线、直播连线、正在连线、连线中、
人正在看、人气、主播、观众、说点什么、关注了主播、来了
```

## 常见坑

- **PowerShell 引号**：手动调用 `run-task.js` 传 JSON 参数需转义 `\"`；本项目脚本用 Python subprocess 无此问题
- **PowerShell 不支持 `&&`**：多命令用 `;` 分隔，或写成 .py 脚本运行
- **手机熄屏/锁屏**：截黑屏+OCR空+录音失败 → 让用户点亮解锁后重试，不是脚本 bug
- **OCR空结果**：纯画面帧无文字属正常，`full_text` 为空字符串时 `detect_live` 返回 `none`（按普通视频处理）
- **OCR导航过滤**：`full_text` 按行返回后，代码会跳过前 `ocr_skip_top_lines`（默认2）行和后 `ocr_skip_bottom_lines`（默认2）行，排除顶部状态栏/导航栏和底部Tab栏的干扰；如误判可在 config.json 调整这两个值
- **中继断了**：`scroll.py` 打开抖音失败会直接报错退出；恢复连接后重跑会新建会话
- **ASR失败**：v2会打印详细错误信息（不再只显示"ASR失败"），连续失败时有指数退避（2s→5s→10s→20s→30s）
- **"来了"关键词可能偏泛**：直播间"某某某来了"系统提示，普通视频中偶尔也可能出现，如误判较多可从 config.json 移除
- **评分质量**：理由必须引用文本具体内容，禁止"关键词命中"式理由；AI视觉提取的作者/标题/互动数据可作为评分参考
