---
name: screenshot
description: "整屏截图回传电脑 PNG 路径供 Read 读图；与 crop-screenshot（局部裁剪）互补。"
args: { "name": "string" }
---

# screenshot · 整屏截图（手机 → 电脑）

## 使用场景
- 想整体看一眼手机当前界面（首页、弹窗、整页内容），而不是某个局部控件。
- 作为 AI「看屏幕」的脚本化入口：截全屏 → 原图上传电脑 → 回传 PC 本地路径，AI 用 Read 读该 PNG 判断界面状态。
- 与 `crop-screenshot`（按坐标局部裁剪）互补：整屏看全局、局部看细节。

## 什么时候不该用
- 只想要局部区域：用 `crop-screenshot` 更省带宽、更聚焦。
- 已经在用 `GET /screenshot`（中继整屏二进制直传）：那是另一条更轻的通道，无需经任务模板下发。

## 参数细节与坑
- `name` 选填：仅允许字母数字 `_ - .`，强制 `.png` 结尾；留空则默认 `screenshot_<时间戳>.png`，避免重名覆盖。
- 截图走 `captureScreen()`；脚本最前面已内置「后台线程 `textMatch` 正则多候选自动点授权按钮（文案因 ROM 而异）+ `requestScreenCapture()` + `sleep(500)`」的前置代码（详见 `references/截图权限与弹框处理.md`），首次弹框无需手动点。
- 真机截全屏像素尺寸较大，但走局域网 postMultipart，体积不是问题，保持 PNG 原图最清晰。

## 错误处理与兜底
- 缺中继配置（手机端未运行常驻客户端）：`{ok:0, err:"未找到中继配置 ..."}`。
- 截图权限未授予：`captureScreen` 返回空 → `{ok:0, err:"captureScreen 返回空（截图权限可能未授予）"}`。
- 保存失败（0 字节）：`{ok:0, err:"images.save 保存截图失败（可能为 0 字节）"}`。
- 上传 HTTP 失败：`{ok:0, err:"上传失败 HTTP ..."}`。
- 成功回执带回电脑本地绝对路径：`{ok:1, path:"<PC路径>", size:N, name:"xxx.png"}`，AI 用 Read 读该 PNG 即可；**此外必须把该 PNG 通过 `present_files` 展示给用户（至少把绝对路径写进回复），不能只回执就结束**（见 SKILL.md 第 3 步「截图结果必须展示给用户」硬规则）。

## 示例调用
```bash
node run-task.js --path tasks/screenshot/screenshot.js --args '{}'
# 返回 {"success":true,"result":"{\"ok\":1,\"path\":\"...\\\\uploads\\\\screenshot_xxx.png\",\"size\":123456,\"name\":\"screenshot_xxx.png\"}"}

# 指定文件名
node run-task.js --path tasks/screenshot/screenshot.js --args '{"name":"home_current"}'
```

## 红线提醒
- 同其它模板：不做支付/删除等不可逆操作。
