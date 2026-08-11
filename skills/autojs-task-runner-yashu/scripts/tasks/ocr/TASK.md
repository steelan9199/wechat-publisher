---
name: ocr
description: "识别手机屏幕上的文字并回传文本：默认整屏 OCR，可选 left/top/right/bottom 限定区域、detail:true 附带每个文本的位置与置信度。用于从界面/图片中提取文字交给 AI 处理（如读通知、摘文案、取验证码），返回文本数组而非 UI 树，省 token。"
args: { "left": "number", "top": "number", "right": "number", "bottom": "number", "detail": "boolean", "minConfidence": "number", "mode": "string" }
---

# ocr · 屏幕文字识别（手机 → AI）

## 使用场景
- 想把手机屏幕上看到的文字「读」出来交给 AI：读通知、摘文案、取验证码/订单号、识别弹窗内容。
- 与 `inspect_control_by_text`（读 UI 控件树里的 text）不同：OCR 能识别**图片里、控件外的任何文字**（截图、照片、视频帧上的字）。
- `detail:true` 时还能拿到每个文本的位置与置信度，便于后续「识别→点按该文字」（配合 `tap_text` / `tap_point`）。

## 什么时候不该用
- 文字在一个标准 UI 控件里（按钮/输入框）：用 `inspect_control_by_text` 更快更准，不依赖 OCR 引擎。
- 只想「看」界面长什么样：用 `screenshot` / `crop_screenshot` 传图回来 Read，比 OCR 更适合纯视觉判断。

## 参数细节与坑
- `left/top/right/bottom` 选填：不传=整屏；传了则只识别该区域（像素坐标，与 `captureScreen` 同系，遵循「左上/右下」约定，内部转成 `[x, y, w, h]`）。须 `right > left` 且 `bottom > top`。
- `detail` 选填：默认 `false`，只回 `texts` 文本数组（最省 token）；`true` 改用 `ocr.detect`，额外回 `results:[{text, confidence, bounds}]`。
- `minConfidence` 选填：仅 `detail:true` 时生效，过滤置信度 < 该值的结果（0~1）。
- `mode` 选填：`mlkit`（默认，快、稳）或 `paddle`（对小字/手写可能更准，但需手机端忽略电池优化，否则易崩）。
- 首次运行会弹**截图权限**请求；脚本已内置后台线程自动点「立即开始」（详见 `references/截图权限与弹框处理.md`），无需手动操作。

## 错误处理与兜底
- 截图权限失败：`{ok:0, err:"请求截图权限失败"}` / `"captureScreen 返回空（截图权限可能未授予）"`。
- 区域非法：`{ok:0, err:"区域非法：right 须 > left 且 bottom 须 > top"}`。
- 成功回执：`{ok:1, count:N, texts:["...","..."]}`（detail 时附 `results`）。

## 示例调用
```bash
# 整屏 OCR，只要文本数组
node run_task.js --path tasks/ocr/ocr.js --args '{}'

# 只识别顶部状态栏区域（坐标示例）
node run_task.js --path tasks/ocr/ocr.js --args '{"left":0,"top":0,"right":1080,"bottom":120}'

# 带位置与置信度，且只保留置信度≥0.8
node run_task.js --path tasks/ocr/ocr.js --args '{"detail":true,"minConfidence":0.8}'
```

## 红线提醒
- 同其它模板：不做微信自动化、不执行支付/删除等不可逆操作。
