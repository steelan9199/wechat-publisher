# 手机截图系统 SOP（标准操作流程）

> **版本**：1.0.0
> **适用场景**：在电脑 AI 聊天软件中说"手机截图"，自动获取安卓手机截屏并打开查看
> **测试设备**：小米 11 PRO + AutoJS
> **技术栈**：Node.js（电脑端）+ AutoJS ES5（手机端）+ WebSocket 二进制传输

---

## 一、系统概述

### 1.1 效果

```
用户在 AI 聊天框说 "手机截图"
    → AI 运行触发脚本 (trigger.js)
    → 中继服务器 (server.js) 通过 WebSocket 通知手机截屏
    → 手机 AutoJS 截屏，将 PNG 二进制数据直传回电脑
    → 电脑保存图片，调用 image-pixel-viewer-yashu 打开
```

### 1.2 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        电脑 (PC)                              │
│                                                              │
│  ┌──────────┐      ┌─────────────────────────┐              │
│  │ AI 聊天   │      │  中继服务器 server.js    │              │
│  │ 软件      │─────→│  (Node.js, 端口 9421)   │              │
│  │ (任意)    │ HTTP │                         │              │
│  └──────────┘      │  ┌───────────────────┐  │              │
│       ↑            │  │ HTTP /screenshot   │  │              │
│       │            │  │ HTTP /health       │  │              │
│       │            │  └───────────────────┘  │              │
│       │            │  ┌───────────────────┐  │              │
│       │            │  │ WebSocket 服务端   │←──────┐        │
│       │            │  └───────────────────┘  │      │        │
│       │            └───────────┬─────────────┘      │        │
│       │                        │ WebSocket          │        │
│       │                        │ (局域网 WiFi)       │        │
│  ┌────┴───────┐               │                    │        │
│  │image-pixel │          ┌─────┴──────────┐        │        │
│  │-viewer     │          │  手机 (Android) │        │        │
│  │打开截图     │          │                 │        │        │
│  └────────────┘          │  AutoJS 脚本    │────────┘        │
│                          │  autojs-client  │  二进制 PNG     │
│                          │  .js (ES5)      │  直传（非base64）│
│                          └─────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 数据流详解

| 步骤 | 方向 | 协议 | 数据 |
|------|------|------|------|
| 1 | AI → 服务器 | HTTP GET | `/screenshot` 请求 |
| 2 | 服务器 → 手机 | WebSocket Text | `{"action":"capture"}` |
| 3 | 手机截屏 | 本地 API | `captureScreen()` → 保存 PNG → 读取 byte[] |
| 4 | 手机 → 服务器 | WebSocket Binary | PNG 二进制数据（okio.ByteString） |
| 5 | 服务器 → AI | HTTP Response | `{"success":true,"path":"...png"}` |
| 6 | AI → image-pixel-viewer-yashu | 技能调用 | 打开图片路径 |

### 1.4 关键设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 图片传输方式 | **二进制直传** | 用户明确要求不转 base64，减少开销 |
| 通信协议 | **WebSocket** | AutoJS 原生支持，长连接适合多次截图 |
| 服务器语言 | **Node.js** | 用户指定，ES6 语法 |
| 手机脚本语言 | **ES5** | AutoJS 基于 Rhino 引擎，ES5 兼容性最好 |
| 端口 | **9421** | HTTP + WebSocket 共用，不冲突常见端口 |
| 技能通用性 | **不绑定特定 AI** | 任何能执行命令的 AI 聊天软件均可使用 |

---

## 二、环境要求

### 2.1 电脑端

| 项目 | 要求 | 检查命令 |
|------|------|----------|
| Node.js | >= 18 | `node -v` |
| npm | 随 Node.js 安装 | `npm -v` |
| 操作系统 | Windows / macOS / Linux | - |

### 2.2 手机端

| 项目 | 要求 |
|------|------|
| AutoJS | 已安装（Pro 版或免费版均可） |
| 截图权限 | 已授权（首次运行脚本时弹窗授权） |
| 无障碍服务 | 已开启（AutoJS 设置中） |
| 网络 | 与电脑在同一 WiFi 局域网 |

#### 小米手机额外设置（MIUI）

MIUI 系统需要额外授予以下权限，否则 AutoJS 后台运行时会被杀：

1. **自启动**：设置 → 应用管理 → AutoJS → 自启动 → 允许
2. **省电策略**：设置 → 应用管理 → AutoJS → 省电策略 → 无限制
3. **后台弹出界面**：设置 → 应用管理 → AutoJS → 后台弹出界面 → 允许
4. **锁屏后清理**：确保 AutoJS 在最近任务列表中被锁定（下拉锁住）

### 2.3 网络

- 电脑和手机连接**同一个 WiFi 路由器**
- 电脑防火墙需放行 **9421** 端口（Windows 首次运行会弹窗）
- 查看电脑局域网 IP：`ipconfig`（Windows）或 `ifconfig`（macOS/Linux）

---

## 三、安装部署

### 3.1 文件清单

```
phone-screenshot/
├── SKILL.md                      # 技能定义文件
├── SOP.md                        # 本文档
├── scripts/
│   ├── package.json              # npm 依赖配置
│   ├── server.js                 # PC 端中继服务器（ES6）
│   ├── trigger.js                # AI 触发脚本（ES6）
│   └── autojs-client.js          # 手机端 AutoJS 脚本（ES5）
└── screenshots/                  # 截图自动保存目录（自动创建）
```

### 3.2 电脑端部署

#### 步骤 1：安装依赖

```bash
cd phone-screenshot/scripts
npm install
```

这会安装 `ws` 库（WebSocket 服务端实现）。

#### 步骤 2：启动中继服务器

```bash
cd phone-screenshot/scripts
node server.js
```

看到以下输出说明启动成功：

```
========================================
  手机截图中继服务器已启动
========================================
  HTTP 触发:  http://localhost:9421/screenshot
  健康检查:  http://localhost:9421/health
  WebSocket: ws://localhost:9421
  截图目录:  ...\phone-screenshot\screenshots
========================================

等待手机连接...
```

> ⚠️ 服务器是**长驻进程**，启动后保持运行，不要关闭终端窗口。

#### 步骤 3：查看电脑局域网 IP

```bash
# Windows
ipconfig

# macOS / Linux
ifconfig
```

找到 "IPv4 地址"，形如 `192.168.1.100`，记下来。

### 3.3 手机端部署

#### 步骤 1：配置脚本

将 `autojs-client.js` 传到手机（微信/QQ/数据线均可），用 AutoJS 打开。

修改文件顶部的服务器 IP：

```javascript
// ★★★ 改成你电脑的局域网 IP ★★★
var SERVER_IP = "192.168.1.100";  // ← 改成你电脑的 IP
```

#### 步骤 2：授权

首次运行脚本时：
1. AutoJS 会请求**截图权限**，点击"允许"
2. 确保**无障碍服务**已开启（AutoJS → 设置 → 无障碍服务）

#### 步骤 3：运行脚本

在 AutoJS 中点击运行。看到以下输出说明连接成功：

```
=== 手机截图客户端 ===
正在请求截图权限...
（首次运行会弹窗，请点击「允许」）

截图权限已获取

服务器地址: ws://192.168.1.100:9421

正在连接服务器: ws://192.168.1.100:9421
✓ 已连接到电脑服务器
等待截图指令...
```

> 保持 AutoJS 在后台运行，不要被系统杀掉。

### 3.4 验证连接

在电脑上打开浏览器访问：

```
http://localhost:9421/health
```

返回 `{"status":"ok","phone":"connected","port":9421}` 说明手机已连接。

---

## 四、使用流程

### 4.1 日常使用

**前提**：服务器已启动 + 手机 AutoJS 脚本已运行

1. 在 AI 聊天软件中输入"手机截图"
2. AI 自动执行触发脚本，获取截图
3. 截图自动用 image-pixel-viewer-yashu 打开（或系统默认图片查看器）

### 4.2 手动测试

不通过 AI，直接在电脑终端测试：

```bash
# 方式 1：运行触发脚本
node phone-screenshot/scripts/trigger.js

# 方式 2：直接 HTTP 请求
curl http://localhost:9421/screenshot
```

返回类似：`D:\software\workBuddyWorkspace\phone-screenshot\screenshots\screenshot_2026-07-27T01-23-45.png`

### 4.3 截图保存位置

所有截图自动保存在：

```
phone-screenshot/screenshots/screenshot_YYYY-MM-DDTHH-MM-SS.png
```

文件名用时间戳命名，不会覆盖。

---

## 五、AI 软件集成

### 5.1 通用集成方式

本技能不绑定特定 AI 软件。任何能**执行命令**的 AI 聊天软件均可集成。

AI 软件需要做的：

1. **识别用户意图**：当用户说"手机截图"等关键词时触发
2. **执行触发脚本**：运行 `node trigger.js`
3. **读取输出**：脚本输出图片的绝对路径
4. **打开图片**：调用 image-pixel-viewer-yashu 技能，或用系统默认方式打开

### 5.2 WorkBuddy 集成

将 `phone-screenshot` 文件夹复制到技能目录：

```
~/.workbuddy/skills/phone-screenshot/
```

重启 WorkBuddy 后，说"手机截图"即可触发。

### 5.3 Trae CN 集成

在 Trae CN 的项目规则或系统提示中添加：

```
当用户说"手机截图"时：
1. 检查 http://localhost:9421/health 是否在线
2. 如果服务器未启动，运行: node "技能路径/scripts/server.js"（后台运行）
3. 如果手机未连接，提醒用户运行 AutoJS 脚本
4. 运行: node "技能路径/scripts/trigger.js"
5. 拿到输出的图片路径后，用 image-pixel-viewer-yashu 打开
```

### 5.4 其他 AI 软件集成

核心就是让 AI 知道：
- **触发词**：手机截图 / 截屏手机 / 截取手机屏幕
- **执行命令**：`node <路径>/scripts/trigger.js`
- **输出**：图片绝对路径
- **后续**：打开图片

---

## 六、故障排查

### 6.1 常见问题

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 服务器启动报 `EADDRINUSE` | 端口 9421 被占用 | 先关闭旧服务器：`Get-NetTCPConnection -LocalPort 9421 \| Select -Expand OwningProcess \| ForEach { Stop-Process -Id $_ -Force }` |
| `Cannot find module 'ws'` | 依赖未安装 | `cd scripts && npm install` |
| 健康检查返回 `phone: "disconnected"` | 手机未连接 | 检查手机 AutoJS 脚本是否运行、IP 是否正确 |
| 手机连接失败 | IP 错误 / 防火墙 | 1. 确认电脑 IP 与脚本中一致 2. Windows 防火墙放行 9421 端口 |
| 截图超时 | 手机端截图失败 | 检查 AutoJS 截图权限、无障碍服务是否开启 |
| 手机频繁掉线 | MIUI 后台清理 | 参照 [2.2 小米手机额外设置](#22-手机端) |
| 截图黑屏 | MediaProjection 权限问题 | 重新授权：关闭 AutoJS → 重新打开 → 重新运行脚本 |
| 图片文件为 0 字节 | 二进制传输异常 | 检查 AutoJS 版本是否支持 okio.ByteString |

### 6.2 调试技巧

1. **查看服务器日志**：服务器终端会实时输出连接状态、消息收发情况
2. **查看手机日志**：AutoJS 控制台显示连接状态、截图过程
3. **手动测试 WebSocket**：浏览器控制台 `new WebSocket('ws://电脑IP:9421')` 测试连通性
4. **检查端口占用**：`netstat -ano \| findstr 9421`

### 6.3 日志说明

**服务器端日志**：

```
[WS] 手机已连接              ← 手机连接成功
[HTTP] 已发送截图指令给手机   ← AI 触发了截图
[WS] 收到图片数据: 1234567 bytes  ← 手机回传了图片
[HTTP] 截图完成: /path/to/screenshot.png  ← 图片已保存
```

**手机端日志**：

```
✓ 已连接到电脑服务器          ← 连接成功
收到指令: {"action":"capture"} ← 收到截图指令
正在截屏...                   ← 开始截图
截屏完成，已保存到临时文件     ← 截图成功
图片大小: 1234567 bytes       ← 文件大小
✓ 图片已发送                  ← 已发送给电脑
```

---

## 七、技术细节

### 7.1 二进制传输原理

```
手机端 (AutoJS):
  captureScreen() → Image 对象
  → images.save(img, path, "png") → PNG 文件
  → java.io.FileInputStream 读取 → Java byte[]
  → new okio.ByteString(bytes) → WebSocket 二进制帧
  → ws.send(byteString)

电脑端 (Node.js):
  ws.on('message', (data, isBinary) => {
    // data 是 Buffer，直接写入文件
    fs.writeFileSync(filepath, data);
  })
```

全程**无 base64 编解码**，二进制数据直接传输。

### 7.2 自动重连机制

手机端脚本内置断线重连：

- 连接断开时 3 秒后自动重连
- 重连期间持续尝试，直到连接成功
- 服务器端检测到断开后，待机中的截图请求会收到错误通知

### 7.3 服务器复用策略

- 服务器是**长驻进程**，启动后持续运行
- 多次截图请求复用同一服务器实例
- AI 触发前先检测服务器是否已启动，避免端口冲突
- 手机 WebSocket 连接也是长连接，一次连接可多次截图

---

## 八、附录

### A. 端口说明

| 端口 | 用途 | 协议 |
|------|------|------|
| 9421 | 中继服务器（HTTP + WebSocket 共用） | HTTP + WS |
| 18098 | image-pixel-viewer-yashu 图片查看器 | HTTP |

### B. 快速启动清单

- [ ] 电脑已安装 Node.js 18+
- [ ] `cd scripts && npm install` 已执行
- [ ] 电脑 `node server.js` 已启动
- [ ] 手机 AutoJS 已开启截图权限
- [ ] 手机 `autojs-client.js` 中 SERVER_IP 已修改
- [ ] 手机 AutoJS 脚本已运行，显示"已连接"
- [ ] 电脑浏览器访问 `http://localhost:9421/health` 返回 `phone: "connected"`
- [ ] AI 聊天软件已配置触发规则

### C. AutoJS 截图权限设置

1. 打开 AutoJS → 设置 → 无障碍服务 → 开启
2. 首次运行含 `requestScreenCapture()` 的脚本时，系统会弹出 MediaProjection 授权对话框
3. 点击"允许"或"开始"
4. 授权后后续运行无需再次授权（除非重启手机或撤销授权）

### D. 文件修改指南

| 需求 | 修改文件 | 修改位置 |
|------|----------|----------|
| 更改服务器端口 | `scripts/server.js` | `const PORT = 9421;` |
| 更改服务器端口 | `scripts/trigger.js` | `const PORT = 9421;` |
| 更改服务器端口 | `scripts/autojs-client.js` | `var SERVER_PORT = 9421;` |
| 更改截图保存目录 | `scripts/server.js` | `const SCREENSHOT_DIR = ...` |
| 更改截图超时时间 | `scripts/server.js` | `const CAPTURE_TIMEOUT = 15000;` |
| 更改重连间隔 | `scripts/autojs-client.js` | `var RECONNECT_INTERVAL = 3000;` |
| 更改截图格式 | `scripts/autojs-client.js` | `images.save(img, path, "png")` 改为 `"jpeg"` |
