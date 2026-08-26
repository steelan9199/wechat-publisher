---
name: "video-course-recorder-yashu"
description: "自动启停视频课程录制所需的辅助程序。激活条件：用户消息须包含以下关键词之一:`我要录制视频课程`、`开始录制视频课程`、`准备录课`、`视频课程录完了`、`录课结束`、`停止录制`。"
---

# 视频课程录制助手 (Win11)

此技能专为 **Windows 11** 用户设计，一键启停录制视频课程所需的四个辅助程序：

- **PointerFocus** — 鼠标高亮/聚焦效果
- **Carnac** — 实时按键显示
- **Recordly** — 录屏
- **NVIDIA Broadcast** — AI降噪/虚拟背景

---

## 启动与关闭顺序说明

四个程序之间存在依赖关系，启动和关闭顺序必须严格遵守，不可随意调整：

```
音频链路：麦克风 → NVIDIA Broadcast（降噪） → Recordly（录制）
```

- **NVIDIA Broadcast** 是 Recordly 的音频输入源。Recordly 不直接采集麦克风，而是采集 Broadcast 降噪后的音频流。
- 因此：**Broadcast 必须在 Recordly 之前启动**，确保 Recordly 启动时音频源已就绪。
- 关闭时则相反：**Recordly 必须在 Broadcast 之前关闭**，避免 Recordly 还在录制时音频源被切断。

启动顺序（正向，先启依赖，后启消费者）：

| 顺序 | 程序             | 原因                                         |
| ---- | ---------------- | -------------------------------------------- |
| 1    | NVIDIA Broadcast | 音频降噪源，Recordly 依赖其音频输出，必须最先启动 |
| 2    | PointerFocus     | 独立工具，无依赖，中间位置任意               |
| 3    | Carnac           | 独立工具，无依赖，中间位置任意               |
| 4    | Recordly         | 依赖 Broadcast 的音频流，必须最后启动        |

关闭顺序（反向，先关消费者，后关依赖）：

| 顺序 | 程序             | 原因                           |
| ---- | ---------------- | ------------------------------ |
| 1    | Recordly         | 先停止录制，不再需要音频输入   |
| 2    | Carnac           | 独立工具，无依赖               |
| 3    | PointerFocus     | 独立工具，无依赖               |
| 4    | NVIDIA Broadcast | OBS 已关闭，音频源可以安全关闭 |

总结：**启动正序（Broadcast 最先，Recordly 最后），关闭反序（Recordly 最先，Broadcast 最后）。**

---

## 启动录课环境

当用户表达"开始录制视频课程"意图时，按顺序启动四个程序。**每启动一个程序后等待 3 秒再启动下一个**，确保前一个进程完全初始化、GPU/显示上下文就绪后再拉起下一个，避免资源争抢导致进程一闪即退。四个程序共 3 个间隔，总计等待 9 秒。

```powershell
# ── 1. NVIDIA Broadcast ──
# 必须用 explorer.exe 拉起，不能用 Start-Process 直接拉。
# 原因：Start-Process 会把进程创建在自动化所在会话上下文，拿不到 GPU/显示上下文，
# 导致 Broadcast（Electron + NVIDIA 驱动/DXGI 加速）进程一闪即退。
# 经 explorer.exe 派生则落在交互桌面会话，GPU 上下文正常，可稳定常驻。
Start-Process -FilePath "C:\Windows\explorer.exe" -ArgumentList "C:\Program Files\NVIDIA Corporation\NVIDIA Broadcast\NVIDIA Broadcast.exe"
Start-Sleep -Seconds 3

# ── 2. PointerFocus ──
# 注意：PointerFocus 是四个程序中唯一的例外，不能用 explorer.exe 派生启动
# （实测 explorer.exe 派生拉不起来），其余三个程序仍用 explorer.exe 派生。
# 也不能用 Start-Process 直接拉：默认工作目录是当前终端目录，PointerFocus 找不到
# 自己文件夹下的配置/资源，托盘图标闪现 2~3 秒后崩溃退出。
# 正确做法：用 Start-Process 显式指定 -WorkingDirectory 为 exe 所在文件夹，
# 模拟在资源管理器中双击 exe 的行为（双击时工作目录会被设为 exe 所在文件夹）。
Start-Process -FilePath "D:\software\PointerFocus\pointerfocus2.4\PointerFocus\PointerFocus.exe" -WorkingDirectory "D:\software\PointerFocus\pointerfocus2.4\PointerFocus\"
Start-Sleep -Seconds 3

# ── 3. Carnac ──
# 统一使用 explorer.exe 派生启动，保持与其他三个程序一致。
Start-Process -FilePath "C:\Windows\explorer.exe" -ArgumentList "C:\Users\Administrator\AppData\Local\carnac\Carnac.exe"
Start-Sleep -Seconds 3

# ── 4. Recordly（最后启动，依赖 Broadcast 音频流）──
Start-Process -FilePath "C:\Windows\explorer.exe" -ArgumentList "C:\Users\Administrator\AppData\Local\Programs\recordly\Recordly.exe"
```

### 验证启动结果

启动命令执行后，**另起一条 Shell 命令**，用 `tasklist` 验证四个进程是否都已拉起（不要用 PowerShell 输出验证，原因同关闭部分）。当前环境下 `grep` 不可用，改用 Windows 原生 `findstr`：

```bash
tasklist | findstr /i "Recordly Carnac PointerFocus Broadcast"
```

- 应能看到 Recordly、Carnac、PointerFocus、NVIDIA Broadcast 四条记录。
- 若某程序未出现，排查思路：
  - PointerFocus 未出现 → 检查启动命令是否带 `-WorkingDirectory`（PointerFocus 找不到自身资源会闪退），见启动命令注释。
  - 其余程序未出现 → 多半是用 `Start-Process` 直接拉导致一闪即退，需改用 `explorer.exe` 派生（见启动命令注释）。

确认四个进程都正常启动后，提示用户：

> 录课环境已就绪。PointerFocus、Carnac、Recordly、NVIDIA Broadcast 已启动，祝录制顺利！

---

## 关闭录课环境

当用户表达"视频课程录完了"意图时，按顺序强制关闭四个程序：

```powershell
Stop-Process -Name "Recordly" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "Carnac" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "PointerFocus" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "NVIDIA Broadcast" -Force -ErrorAction SilentlyContinue
```

### 验证关闭结果（关键）

⚠️ **不要用 PowerShell 命令的输出验证关闭结果。** 本环境下 PowerShell 调用的 stdout 会被吞掉（返回空）。如果依赖 `Write-Output` / `Get-Process | Format-Table` / `foreach` 拼接等方式确认，会因为拿不到任何输出而反复重试，白白浪费数十秒。

正确做法：关闭命令执行后，**另起一条 Shell 命令**，用 `tasklist` 核验进程是否残留。当前环境下 `grep` 不可用，改用 Windows 原生 `findstr`：

```bash
# 等待 1~2 秒让进程真正退出（无需更长），再核验
# 注意：本环境 PowerShell 不支持 && 连接，需用 "; if ($?) { ... }" 实现"前一条成功才执行下一条"的语义
powershell -Command "Start-Sleep -Seconds 2"; if ($?) { tasklist | findstr /i "Recordly Carnac PointerFocus Broadcast" }
```

- `findstr` 无匹配输出（exit code 1）→ 四个程序均已退出，验证通过。
- 仍列出某进程 → 未被成功关闭（权限/被锁定），需单独二次 `Stop-Process` 或人工处理。

确认关闭后，提示用户：

> 四个录课程序已全部关闭。

---

## 核心原则

1. **仅 Windows 11** — 此技能硬编码了 Windows 11 的程序路径，不适用于其他系统
2. **启动与关闭对称** — 关闭顺序与启动顺序相反（先启后关），确保依赖关系不被破坏。Recordly 依赖 Broadcast 的音频输入，因此 Broadcast 最先启动、最后关闭。
3. **每启动一个程序后等待 3 秒** — 四个程序按顺序启动，每启动一个后 `Start-Sleep -Seconds 3` 再启动下一个，总计等待 9 秒。确保前一个进程完全初始化后再拉起下一个，避免资源争抢导致进程一闪即退。
4. **静默错误处理** — 关闭时使用 `-ErrorAction SilentlyContinue`，避免进程已退出时报错
5. **三个程序用 `explorer.exe` 派生启动，PointerFocus 是例外** — `Start-Process` 直接拉会把进程创建在自动化会话上下文，拿不到 GPU/显示上下文，导致进程一闪即退。经 `explorer.exe` 派生则落在交互桌面会话，GPU 上下文正常，可稳定常驻。NVIDIA Broadcast、Carnac、Recordly 三个程序用 explorer.exe 派生启动。**PointerFocus 例外**：explorer.exe 派生实测拉不起来，改用 `Start-Process` 并显式指定 `-WorkingDirectory` 为 exe 所在文件夹启动（PointerFocus 依赖自身文件夹下的相对路径资源，工作目录不对会闪退）。
6. **验证一律用 Shell 的 `tasklist`** — 本环境下 PowerShell 调用的 stdout 返回为空，绝不能依赖 PowerShell 命令（`Write-Output` / `Get-Process` 等）的输出去判断进程状态，否则会反复重试、浪费大量时间。启动/关闭后都用单独的 Shell 命令跑 `tasklist | findstr` 核验（当前环境 `grep` 不可用，用 Windows 原生 `findstr`），简洁可靠。
