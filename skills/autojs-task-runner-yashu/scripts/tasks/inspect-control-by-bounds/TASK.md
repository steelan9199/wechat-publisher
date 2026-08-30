---
name: inspect-control-by-bounds
description: "按包围盒矩形精确相等匹配控件（通常0~1个命中），返回控件信息与可复用选择器；inspect 几何家族的精确版。"
args: { "left": "number|string*", "top": "number|string*", "right": "number|string*", "bottom": "number|string*" }
---

# inspect-control-by-bounds · 按包围盒探测控件

## 使用场景
- 已知某控件精确的矩形范围（如来自截图裁剪、图像分析、或上次探测拿到的 bounds），想识别它并拿稳定选择器。
- 多步任务枢纽：矩形 → 拿 id/text/desc 选择器 → 改用更稳的选择器再定位（比坐标稳）。

## 什么时候不该用
- 只知一个坐标点、想找该点最深层控件：用 `inspect-control-by-coord`（点包含，容错更好）。
- 想「控件落在区域内」（找内部子控件）：用 `inspect-control-by-bounds-inside`。
- 想「控件罩住某点/区域」（找祖先容器）：用 `inspect-control-by-bounds-contains`。
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
node run-task.js --path tasks/inspect-control-by-bounds/inspect-control-by-bounds.js --args '{"left":100,"top":200,"right":300,"bottom":250}'
```

## 红线提醒
- 仅探测，不操作；需要点按再转发给 `tap-text` 等。
