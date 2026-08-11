---
name: crop_screenshot
description: "按左上/右下四元组坐标裁剪屏幕区域并回传到电脑：截全屏→images.clip出该区域→原始PNG字节POST到电脑/uploads。用于精确"看"某个控件/区块长什么样，拿回的是电脑本地PNG路径，AI再用Read读图。"
args: { "left": "number*", "top": "number*", "right": "number*", "bottom": "number*", "name": "string" }
---

# crop_screenshot · 按坐标区域截图（B 坐标模式）

## 使用场景
- 你已经拿到某个控件的包围盒（如经 `inspect_control_by_*` 探测出的 bounds，或 `tap_point` 用的坐标），想"看"这个控件区域长什么样。
- 想截取屏幕上一块固定区域（弹窗、按钮、列表项、二维码等），而不是整屏。
- 与 `GET /screenshot`（整屏）互补：整屏看全局、本模板看局部。

## 什么时候不该用
- 只想要整屏：直接 `GET /screenshot`，更简单。
- 还不知道区域在哪：先用 `inspect_control_by_coord` / `by_bounds` 等探测类模板拿 bounds，再喂给本模板。
- A 控件模式（"找到控件自动取它的 bounds 再裁剪"）当前未实现，本模板只接受你给的坐标四元组。

## 参数细节与坑
- `left/top/right/bottom` 必填数字，单位为像素，坐标系与 `captureScreen()` 输出一致（图片左上角为原点）。
- 必须满足 `right > left` 且 `bottom > top`，否则返回 `{ok:0, err:"区域非法"}`。
- 越界会自动夹到全屏尺寸内（不会因坐标超界而崩），但夹完若区域为空会报错。
- `name` 选填：仅允许字母数字 `_ - .`，强制 `.png` 结尾；留空则默认 `crop_<时间戳>.png`，避免重名覆盖。
- 高分屏上 `captureScreen` 像素尺寸与控件 `bounds()` 坐标系偶尔不一致，真机若裁偏，核对一下截图实际分辨率即可。
- 截图权限已内置处理：脚本最前面自动 `requestScreenCapture()` 并后台点掉「立即开始」弹框（详见 `references/截图权限与弹框处理.md`），无需手动授权。

## 错误处理与兜底
- 缺任一必填：`{ok:0, err:"缺少参数 left/top/right/bottom（必须是数字）"}`。
- 截图权限未授予：`captureScreen` 返回空 → `{ok:0, err:"captureScreen 返回空"}`。
- 上传目标未知（手机端未运行常驻客户端）：`{ok:0, err:"未找到中继配置 ..."}`。
- 成功回执带回电脑本地绝对路径：`{ok:1, path:"<PC路径>", size:N, name:"xxx.png"}`，AI 用 Read 读该 PNG 即可；**此外必须把该 PNG 通过 `present_files` 展示给用户（至少把绝对路径写进回复），不能只回执就结束**（见 SKILL.md 第 3 步「截图结果必须展示给用户」硬规则）。

## 示例调用
```bash
node run_task.js --path tasks/crop_screenshot/crop_screenshot.js --args '{"left":100,"top":200,"right":500,"bottom":600}'
# 返回 {"success":true,"result":"{\"ok\":1,\"path\":\"...\\\\uploads\\\\crop_xxx.png\",\"size\":12345,\"name\":\"crop_xxx.png\"}"}
```

## 红线提醒
- 同其它模板：不做微信自动化、不执行支付/删除等不可逆操作。
