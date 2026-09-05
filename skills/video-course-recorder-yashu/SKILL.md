---
name: "video-course-recorder-yashu"
description: "自动启停视频课程录制所需的辅助程序。激活条件：用户消息须包含以下关键词之一:`我要录制视频课程`、`开始录制视频课程`、`准备录课`、`视频课程录完了`、`录课结束`、`停止录制`。"
---

# 视频课程录制助手 (Win11)

此技能专为 **Windows 11** 用户设计，一键启停录制视频课程所需的四个辅助程序：

- **PointerFocus** — 鼠标高亮/聚焦效果
- **Carnac** — 实时按键显示
- **OBS** — 录屏
- **NVIDIA Broadcast** — AI 降噪/虚拟背景

---

## 启动与关闭顺序说明

四个程序之间存在依赖关系，启动和关闭顺序必须严格遵守：

```
音频链路：麦克风 → NVIDIA Broadcast（降噪） → OBS（录制）
```

- **NVIDIA Broadcast** 是 OBS 的音频输入源。OBS 不直接采集麦克风，而是采集 Broadcast 降噪后的音频流。
- 因此：**Broadcast 必须在 OBS 之前启动**，确保 OBS 启动时音频源已就绪。
- 关闭时相反：**OBS 必须在 Broadcast 之前关闭**。

启动顺序（正向）：

| 顺序 | 程序             | 原因                                      |
| ---- | ---------------- | ----------------------------------------- |
| 1    | NVIDIA Broadcast | 音频降噪源，OBS 依赖其音频输出，必须最先启动 |
| 2    | Carnac           | 独立工具，无依赖                            |
| 3    | PointerFocus     | 独立工具，无依赖                            |
| 4    | OBS              | 依赖 Broadcast 的音频流，必须最后启动         |

关闭顺序（反向）：

| 顺序 | 程序             | 原因                           |
| ---- | ---------------- | ------------------------------ |
| 1    | OBS              | 先停止录制，不再需要音频输入   |
| 2    | PointerFocus     | 独立工具，无依赖               |
| 3    | Carnac           | 独立工具，无依赖               |
| 4    | NVIDIA Broadcast | OBS 已关闭，音频源可以安全关闭 |

总结：**启动正序（Broadcast 最先，OBS 最后），关闭反序（OBS 最先，Broadcast 最后）。**

---

## 关键机制（实测结论，务必理解）

本环境里，**AI 用 PowerShell 直接 `Start-Process` 拉起的任何程序，都会在当次命令结束时被回收而退出**——即使关闭沙箱也一样。原因：进程是 AI 临时会话的子进程，会话一结束就被连锅端。

唯一能让程序持续常驻的办法：**经 `explorer.exe` 派生启动**，使程序成为常驻的资源管理器（explorer）的子进程，从而脱离 AI 的临时会话、独立存活。

- `Carnac` 是 **ClickOnce 应用**：直接跑 `Carnac.exe` 会立即自退，必须走 `explorer.exe` 派生。
- `PointerFocus`、`OBS` 还需要**正确的工作目录**（否则加载配置/插件失败而崩溃退出）。而 `explorer.exe` 派生不会带应用自身目录为工作目录，因此用一层 `.bat`（`cd /d` 到应用目录后 `start` 该 exe），再经 `explorer.exe` 拉起这个 `.bat`。

### 两个 .bat 启动器（已建好，勿删）

| 程序 | 启动器路径 |
| ---- | ---------- |
| PointerFocus | `D:\software\PointerFocus\pointerfocus2.4\PointerFocus\start_pointerfocus.bat` |
| OBS | `D:\software\obs\obs-studio\bin\64bit\start_obs.bat` |

> 若这两个文件丢失，内容分别如下，重建即可：
> `start_pointerfocus.bat`：`@echo off` / `cd /d "D:\software\PointerFocus\pointerfocus2.4\PointerFocus"` / `start "" "PointerFocus.exe"`
> `start_obs.bat`：`@echo off` / `cd /d "D:\software\obs\obs-studio\bin\64bit"` / `start "" "obs64.exe"`

---

## 启动录课环境

当用户表达"开始录制视频课程"意图时，按以下顺序启动四个程序。全部经 `explorer.exe` 派生，确保脱离 AI 会话独立常驻。每步间隔 1–2 秒。

```powershell
# 1. NVIDIA Broadcast（音频降噪源，须最先启动；经 explorer 派生）
Start-Process -FilePath "C:\Windows\explorer.exe" -ArgumentList "C:\Program Files\NVIDIA Corporation\NVIDIA Broadcast\NVIDIA Broadcast.exe"
Start-Sleep -Seconds 1

# 2. Carnac（ClickOnce 应用，必须 explorer 派生；启动较慢，可能要数秒才出现）
Start-Process -FilePath "C:\Windows\explorer.exe" -ArgumentList "C:\Users\Administrator\AppData\Local\carnac\Carnac.exe"
Start-Sleep -Seconds 1

# 3. PointerFocus（经 explorer 拉起带工作目录的 .bat）
Start-Process -FilePath "C:\Windows\explorer.exe" -ArgumentList "D:\software\PointerFocus\pointerfocus2.4\PointerFocus\start_pointerfocus.bat"
Start-Sleep -Seconds 1

# 4. OBS（依赖 Broadcast 音频流，最后启动；经 explorer 拉起带工作目录的 .bat）
Start-Process -FilePath "C:\Windows\explorer.exe" -ArgumentList "D:\software\obs\obs-studio\bin\64bit\start_obs.bat"
Start-Sleep -Seconds 2
```

### 验证启动结果

另起一条 **Shell（Bash）** 命令，用 `tasklist` 验证四个进程是否都已拉起（**不要**依赖 PowerShell 输出验证，本环境 PowerShell 的 stdout 会被吞掉）：

```bash
tasklist | findstr /i "obs64 PointerFocus Carnac Broadcast"
```

- 应能看到 `obs64`、`Carnac`、`PointerFocus`、`NVIDIA Broadcast` 的记录（Carnac 可能稍慢出现，请耐心等待后再核验）。
- 若某程序未出现：检查对应启动方式是否正确（Carnac 必须 explorer 派生；PointerFocus/OBS 必须走 `.bat` 再 explorer 派生，且 `.bat` 未被删）。

确认四个进程都正常启动后，提示用户：

> 录课环境已就绪。OBS、PointerFocus、Carnac、NVIDIA Broadcast 已启动，祝录制顺利！

---

## 关闭录课环境

当用户表达"视频课程录完了"意图时，按反序关闭四个程序。因全程经 `explorer.exe` 派生、无需任何管家进程，直接 `Stop-Process` 即可，无需额外清理。

```powershell
Stop-Process -Name "obs64" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "PointerFocus" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "Carnac" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "NVIDIA Broadcast" -Force -ErrorAction SilentlyContinue
```

### 验证关闭结果

另起一条 **Shell（Bash）** 命令，用 `tasklist` 核验进程是否残留：

```bash
tasklist | findstr /i "obs64 PointerFocus Carnac Broadcast" || echo "ALL_FOUR_CLOSED"
```

- 输出 `ALL_FOUR_CLOSED` → 四个程序均已退出，验证通过。
- 仍列出某进程 → 未被成功关闭（权限/被锁定），需单独二次 `Stop-Process` 或人工处理。

确认关闭后，提示用户：

> 四个录课程序已全部关闭。

---

## 核心原则

1. **仅 Windows 11** — 此技能硬编码了 Windows 11 的程序路径，不适用于其他系统。
2. **启动与关闭对称** — 关闭顺序与启动顺序相反（先启后关）。OBS 依赖 Broadcast 的音频输入，因此 Broadcast 最先启动、最后关闭。
3. **全部经 `explorer.exe` 派生** — 这是让程序脱离 AI 临时会话、独立常驻的唯一可靠方式。AI 直接 `Start-Process` 拉起的程序会在命令结束时被回收，切不可用。
4. **`.bat` 包装工作目录** — `PointerFocus`、`OBS` 必须经 `.bat`（`cd /d` 到应用目录）再经 `explorer.exe` 拉起，否则因工作目录不对而崩溃退出。
5. **Carnac 必须 explorer 派生** — 它是 ClickOnce 应用，直接跑 exe 会立即自退。
6. **静默错误处理** — 关闭时使用 `-ErrorAction SilentlyContinue`，避免进程已退出时报错。
7. **验证一律用 Shell 的 `tasklist`** — 本环境下 PowerShell 调用的 stdout 返回为空，绝不能依赖 PowerShell 命令的输出去判断进程状态。启动/关闭后都用单独的 Shell 命令跑 `tasklist | findstr` 核验。
