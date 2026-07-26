---
name: phone-screenshot-yashu
description: 远程获取安卓手机截图。通过 WebSocket 连接电脑和手机（AutoJS），用户说"手机截图"即可触发截屏并自动打开。激活条件：用户消息包含"手机截图"、"截取手机屏幕"、"截屏手机"、"phone screenshot"等关键词。
metadata:
  author: 牙叔教程
  version: 1.0.0
---

# 手机截图

## 功能概述

在 AI 聊天软件中说"手机截图"，自动通过 WebSocket 通知手机（AutoJS）截屏，手机将图片二进制数据直接传回电脑，保存为 PNG 文件后打开查看。图片传输为二进制直传，不转 base64。

## 环境说明

- **技能目录**：`$SKILL_DIR` 指代本技能所在目录（包含 SKILL.md 的文件夹）。⚠️ `$SKILL_DIR` 仅为文档占位符，不是环境变量，执行命令时必须替换为实际绝对路径。
- **端口**：固定使用 9421（HTTP + WebSocket 共用）
- **脚本目录**：`$SKILL_DIR/scripts/`
- **截图保存目录**：`$SKILL_DIR/screenshots/`
- **Node.js**：需要已安装 Node.js（>= 18），若未安装则提示用户安装后结束任务
- 本技能运行命令时采用**条件执行**（前一条成功才执行下一条）：
  - **bash/zsh**（Linux/macOS）：`cmd1 && cmd2`
  - **PowerShell 5**（Windows）：`cmd1; if ($?) { cmd2 }`
  - **PowerShell 7+**：`&&` 和 `; if ($?) { cmd2 }` 均可
  - **禁止单 `&`**

## 前置条件

| 条件 | 说明 |
|---|---|
| 电脑已安装 Node.js >= 18 | 运行 `node -v` 检查，未安装则提示用户安装 |
| 手机已安装 AutoJS | 需开启截图权限和无障碍服务 |
| 电脑与手机在同一局域网 | 手机通过 WiFi 连接到电脑同网段 |
| 手机 AutoJS 脚本已运行 | 手机端运行 `autojs-client.js`，需配置电脑 IP |
| 中继服务器已启动 | 电脑端运行 `node server.js` |

## 执行步骤

### 意图判定

| 用户消息特征 | 执行动作 |
|---|---|
| 包含"手机截图"/"截屏手机"/"截取手机屏幕"/"phone screenshot" | 进入【获取手机截图】流程 |
| 包含"关闭手机截图"/"停止手机截图" | 进入【关闭服务器】流程 |

### 获取手机截图

| 步骤 | 执行动作 | 具体命令/操作 |
|---|---|---|
| 1 | 环境检查：Node.js | 运行 `node -v`。若命令不存在，提示用户安装 Node.js 18+，任务结束。 |
| 2 | 环境检查：依赖 | 检查 `$SKILL_DIR/scripts/node_modules/ws` 目录是否存在。若不存在，运行 `cd "$SKILL_DIR/scripts" && npm install`。 |
| 3 | 检测服务器状态 | 运行健康检查命令（见下方【服务器检测命令】）。返回 `{"status":"ok"}` 说明已运行；连接失败说明未启动。 |
| 4 | 判断是否需要启动 | 若步骤 3 返回 `{"status":"ok"}`，跳到步骤 6。若连接失败，继续步骤 5。 |
| 5 | 启动服务器 | 将 `$SKILL_DIR` 替换为实际绝对路径，运行 `cd "$SKILL_DIR/scripts"; if ($?) { node server.js }`。**必须使用非阻塞方式执行**，因为服务器是长驻进程。 |
| 6 | 等待服务器就绪 | 运行 `Start-Sleep -Seconds 2`（Windows）或 `sleep 2`（Linux/macOS），等待服务器完成启动。然后再次运行步骤 3 的健康检查确认就绪。 |
| 7 | 检查手机连接 | 从步骤 3/6 的健康检查返回中读取 `phone` 字段。若为 `disconnected`，提示用户在手机上运行 AutoJS 脚本，任务结束。 |
| 8 | 触发截图 | 运行 `node "$SKILL_DIR/scripts/trigger.js"`。脚本输出图片的绝对路径。 |
| 9 | 打开图片 | 拿到图片路径后，调用 `image-pixel-viewer-yashu` 技能打开该图片（若有该技能）。若无 image-pixel-viewer-yashu，则用系统默认方式打开图片。 |

#### 服务器检测命令

| 平台 | 命令 |
|---|---|
| Windows (PowerShell) | `try { (Invoke-WebRequest -Uri "http://localhost:9421/health" -UseBasicParsing -TimeoutSec 2).Content } catch { "连接失败" }` |
| Linux/macOS (bash) | `curl -s --max-time 2 http://localhost:9421/health \|\| echo "连接失败"` |

### 关闭服务器

| 步骤 | 执行动作 | 具体命令 |
|---|---|---|
| 1 | 终止占用 9421 端口的进程 | Windows: `Get-NetTCPConnection -LocalPort 9421 -ErrorAction SilentlyContinue \| Select-Object -ExpandProperty OwningProcess \| ForEach-Object { Stop-Process -Id $_ -Force }`；Linux/macOS: `lsof -ti:9421 \| xargs kill` |
| 2 | 确认已关闭 | 再次运行【服务器检测命令】，确认返回"连接失败" |

## 输出格式

- **获取成功**：告知用户截图已完成，并告知图片路径及已打开查看
- **手机未连接**：提示用户在手机上运行 AutoJS 脚本
- **服务器未启动**：提示正在启动服务器
- **Node.js 未安装**：提示用户安装 Node.js 18+

## 错误处理

| 错误场景 | 错误表现 | 处理方式 |
|---|---|---|
| Node.js 未安装 | `node` 命令不存在 | 提示用户安装 Node.js 18+ |
| ws 依赖未安装 | `Cannot find module 'ws'` | 运行 `cd scripts && npm install` |
| 手机未连接 | 健康检查返回 `phone: "disconnected"` | 提示用户在手机上运行 AutoJS 脚本 |
| 截图超时 | trigger.js 返回超时错误 | 检查手机 AutoJS 是否在前台运行、截图权限是否已授权 |
| 端口被占用 | 服务器启动报 `EADDRINUSE` | 提示用户端口 9421 被占用，可先关闭旧服务器再重启 |

## 全业务脚本索引清单

| 脚本 | 功能 |
|---|---|
| `$SKILL_DIR/scripts/server.js` | PC 端 WebSocket + HTTP 中继服务器（端口 9421），接收手机连接，提供截图触发接口 |
| `$SKILL_DIR/scripts/trigger.js` | AI 触发脚本，调用服务器 HTTP 接口获取截图，输出图片路径 |
| `$SKILL_DIR/scripts/autojs-client.js` | 手机端 AutoJS 脚本，连接服务器，收到指令后截屏并发送二进制图片 |
| `$SKILL_DIR/scripts/package.json` | npm 依赖配置（ws 库） |
