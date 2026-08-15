---
name: "video-course-recorder-yashu"
description: "自动启停视频课程录制所需的辅助程序。激活条件：用户消息须包含以下关键词之一:`我要录制视频课程`、`开始录制视频课程`、`准备录课`、`视频课程录完了`、`录课结束`、`停止录制`。"
---

# 视频课程录制助手 (Win11)

此技能专为 **Windows 11** 用户设计，一键启停录制视频课程所需的四个辅助程序：

- **PointerFocus** — 鼠标高亮/聚焦效果
- **Carnac** — 实时按键显示
- **OBS Studio** — 录屏/推流
- **NVIDIA Broadcast** — AI降噪/虚拟背景

---

## 启动与关闭顺序说明

四个程序之间存在依赖关系，启动和关闭顺序必须严格遵守，不可随意调整：

```
音频链路：麦克风 → NVIDIA Broadcast（降噪） → OBS（录制）
```

- **NVIDIA Broadcast** 是 OBS 的音频输入源。OBS 不直接采集麦克风，而是采集 Broadcast 降噪后的音频流。
- 因此：**Broadcast 必须在 OBS 之前启动**，确保 OBS 启动时音频源已就绪。
- 关闭时则相反：**OBS 必须在 Broadcast 之前关闭**，避免 OBS 还在录制时音频源被切断。

启动顺序（正向，先启依赖，后启消费者）：

| 顺序 | 程序             | 原因                                         |
| ---- | ---------------- | -------------------------------------------- |
| 1    | NVIDIA Broadcast | 音频降噪源，OBS 依赖其音频输出，必须最先启动 |
| 2    | PointerFocus     | 独立工具，无依赖，中间位置任意               |
| 3    | Carnac           | 独立工具，无依赖，中间位置任意               |
| 4    | OBS Studio       | 依赖 Broadcast 的音频流，必须最后启动        |

关闭顺序（反向，先关消费者，后关依赖）：

| 顺序 | 程序             | 原因                           |
| ---- | ---------------- | ------------------------------ |
| 1    | OBS Studio       | 先停止录制，不再需要音频输入   |
| 2    | Carnac           | 独立工具，无依赖               |
| 3    | PointerFocus     | 独立工具，无依赖               |
| 4    | NVIDIA Broadcast | OBS 已关闭，音频源可以安全关闭 |

总结：**启动正序（Broadcast 最先，OBS 最后），关闭反序（OBS 最先，Broadcast 最后）。**

---

## 启动录课环境

当用户表达"开始录制视频课程"意图时，按顺序执行以下命令启动四个程序：

```powershell
Start-Process -FilePath "C:\Program Files\NVIDIA Corporation\NVIDIA Broadcast\NVIDIA Broadcast.exe" -WorkingDirectory "C:\Program Files\NVIDIA Corporation\NVIDIA Broadcast"
Start-Process -FilePath "D:\software\PointerFocus\pointerfocus2.4\PointerFocus\PointerFocus.exe" -WorkingDirectory "D:\software\PointerFocus\pointerfocus2.4\PointerFocus"
Start-Process -FilePath "C:\Users\Administrator\AppData\Local\carnac\Carnac.exe" -WorkingDirectory "C:\Users\Administrator\AppData\Local\carnac"
Start-Process -FilePath "D:\software\obs\obs-studio\bin\64bit\obs64.exe" -WorkingDirectory "D:\software\obs\obs-studio\bin\64bit"
```

检查四个进程都正常启动后，提示用户：

> 录课环境已就绪。PointerFocus、Carnac、OBS、NVIDIA Broadcast 已启动，祝录制顺利！

---

## 关闭录课环境

当用户表达"视频课程录完了"意图时，按顺序强制关闭四个程序：

```powershell
Stop-Process -Name "obs64" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "Carnac" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "PointerFocus" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "NVIDIA Broadcast" -Force -ErrorAction SilentlyContinue
```

确认关闭后，提示用户：

> 四个录课程序已全部关闭。

---

## 核心原则

1. **仅 Windows 11** — 此技能硬编码了 Windows 11 的程序路径，不适用于其他系统
2. **启动与关闭对称** — 关闭顺序与启动顺序相反（先启后关），确保依赖关系不被破坏。OBS 依赖 Broadcast 的音频输入，因此 Broadcast 最先启动、最后关闭。
3. **静默错误处理** — 关闭时使用 `-ErrorAction SilentlyContinue`，避免进程已退出时报错
4. **使用 PowerShell** — 使用 `Start-Process` / `Stop-Process`，更可靠且输出更清晰
