---
name: inspect_control_by_bounds
description: "按控件包围盒矩形 (left,top,right,bottom) 精确匹配控件，返回命中控件信息(className/id/text/desc/clickable/bounds/packageName)与可复用 id/text/desc 选择器。是 inspect_control 家族的按包围盒版本；矩形须精确相等，通常 0 或 1 个命中。"
args: { "left": "number|string*", "top": "number|string*", "right": "number|string*", "bottom": "number|string*" }
---

# inspect_control_by_bounds · 按包围盒探测控件

## 使用场景
- 已知某控件精确的矩形范围（如来自截图裁剪、图像分析、或上次探测拿到的 bounds），想识别它并拿稳定选择器。
- 多步任务枢纽：矩形 → 拿 id/text/desc 选择器 → 改用更稳的选择器再定位（比坐标稳）。

## 什么时候不该用
- 只知一个坐标点、想找该点最深层控件：用 `inspect_control_by_coord`（点包含，容错更好）。
- 想「控件落在区域内」（找内部子控件）：用 `inspect_control_by_bounds_inside`。
- 想「控件罩住某点/区域」（找祖先容器）：用 `inspect_control_by_bounds_contains`。
- bounds 随界面布局变化不稳定：拿到选择器后尽量改用 id/text/desc，别长期依赖矩形。

## 参数细节与坑
- `left/top/right/bottom` 必填；可为像素数字，也支持 AutoJS 百分比字符串（如 "50%"）透传。
- `bounds()` 为【精确矩形】匹配：仅返回包围盒完全等于给定矩形的控件（通常 0 或 1 个）。坐标差 1 像素即不命中。
- 命中多个（罕见，同矩形重叠）时按 可见 > 包围盒最小(最深层) 挑最佳，并附 count。
- 拉取整棵 UI 树在复杂界面可能稍慢（正常）。

## 错误处理与兜底
- 成功回 `{ok:1, count, control:{...}, selectors:{...}}`；无命中回 `control:null, count:0`。
- 失败回 `{ok:0, err:"原因"}`，多为缺参或无障碍未开。

## 示例调用
```bash
node run_task.js --path tasks/inspect_control_by_bounds/inspect_control_by_bounds.js --args '{"left":100,"top":200,"right":300,"bottom":250}'
```

## 红线提醒
- 仅探测，不操作；需要点按再转发给 `tap_text` 等。
