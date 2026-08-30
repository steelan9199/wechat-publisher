---
name: get-clipboard
description: "读手机剪贴板文本：≤100字直接回传；长文本自动落盘电脑只回路径+预览。与 set-clipboard 互补。"
args: {}
---

# get-clipboard · 获取手机剪贴板内容

## 使用场景
- 用户在手机上复制了内容（验证码、短信链接、一段文字、订单号、收货地址等），想在电脑上拿到。
- 想确认手机剪贴板当前内容是什么。
- 自媒体场景常用：手机随手复制的金句、标题、链接，回 PC 直接粘进脚本/发文草稿。

## 什么时候不该用
- 想"把文字写到手机剪贴板" → 那是 `setClip(text)`（AutoJS 写入剪贴板），本模板只读取、不写入。
- 想拉的是文件（图片/文档/脚本） → 用 `download-file`，本模板只回传纯文本。
- 想要的是"看屏幕" → 用 `screenshot` / `crop-screenshot`。

## 参数细节与坑
- 本模板无必填参数，直接调用即可：`node run-task.js get-clipboard`。
- 返回字段：
  - `content`: 剪贴板文本字符串；**仅当长度 ≤100 字**时返回，聊天里直接查看；长文本时为 `null`（改用 `file` 路径）。
  - `length`: 文本长度（`null` 时记为 0）。
  - `empty`: 是否为空（`null` 或长度为 0 都记为 `true`）。
  - `file`: **长文本(>100字)专属**，剪贴板内容落地到电脑的**绝对路径**（形如 `…/scripts/uploads/clipboard_<时间戳>.txt`）。手机临时文件上传后即删除。
  - `preview`: 长文本的前 80 字预览（超长补 `…`），方便一眼知道内容大致是什么。
- 超长落盘通道：复用中继 `/upload`，文件落在 `scripts/uploads/`（`UPLOAD_DIR`），命名 `clipboard_<毫秒时间戳>.txt`。上传成功手机端即删除临时文件；上传失败残留的 `.txt` 由手机端 `enforceClipboardCap()` 限制为最多 30 个文件（不限扩展名、按修改时间保留最新），不会无限堆积。电脑端 `uploads/` 整体也按修改时间保留最新 30 个文件（不限扩展名），旧文件会被自动回收。
- Android 10+ 限制：后台应用读取剪贴板可能被系统拦截，返回 `empty:true`。这是系统行为，不是脚本错误。若确信剪贴板有内容却返回空，请确认 AutoJS6 在前台运行、已授予无障碍/相关权限，或重新复制一次再试。

## 错误处理与兜底
- 调用失败：`{ok:0, err:"getClip() 调用失败：..."}`。
- 短文本成功回执：`{ok:1, content:"...", length:N, empty:false}`。AI 把 `content` 明文展示给用户即可。
- 长文本成功回执：`{ok:1, length:N, empty:false, file:"<电脑绝对路径>", preview:"前80字…"}`。AI **用 `present_files` 把该文件作为结果呈现**（让用户直接打开看全文），并在回复里附上绝对路径；聊天里只放路径+预览，不Dump整段长文。
- 长文本上传兜底：若 `/upload` 失败或服务器回包异常，回执降级为 `{ok:1, length:N, preview:"前200字…", note:"…"}`，至少把前 200 字预览带回，内容不丢、不刷屏。
- 手机端未运行常驻客户端（手机离线）：`run-task.js` 会返回 `503 / 手机未连接`，不是本模板的问题，先确认手机在线。

## 示例调用
```bash
# 获取当前剪贴板内容（最常见用法）
node run-task.js get-clipboard
# 短文本返回 {"success":true,"result":"{\"ok\":1,\"content\":\"验证码 123456\",\"length\":11,\"empty\":false}"}
# 长文本(>100字)返回 {"success":true,"result":"{\"ok\":1,\"length\":3634,\"empty\":false,\"file\":\"…/scripts/uploads/clipboard_1691567890123.txt\",\"preview\":\"'ui';\r\n\r\nui.layout(\r\n    <frame>…\"}"}

# 剪贴板为空时
# 返回 {"success":true,"result":"{\"ok\":1,\"content\":null,\"length\":0,\"empty\":true}"}
```

## 红线提醒
- 剪贴板可能含密码、验证码、Token、隐私文字等敏感信息 —— 仅在本地会话中展示，绝不外发任何第三方服务/接口。
- 本模板只读不写，不会修改手机剪贴板内容；不改变系统状态，安全。
