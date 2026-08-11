---
name: inspect_control_by_bounds_inside
description: "按矩形 (left,top,right,bottom) 用 UiSelector.boundsInside() 匹配「控件包围盒完全位于该矩形内」的控件，返回最佳命中控件信息(className/id/text/desc/clickable/bounds/packageName)与可复用 id/text/desc 选择器。区域语义通常命中很多(几十~几百)，count 为区域真实总数；默认只回最对口 1 个，returnAll:true 时额外回最对口 ≤10 个(按选择器可用性 id>text>desc>clickable 排序)。是 inspect_control 几何家族的区域内含版本。"
args: { "left": "number|string*", "top": "number|string*", "right": "number|string*", "bottom": "number|string*", "returnAll": "boolean?" }
---

# inspect_control_by_bounds_inside · 按区域(内含)探测控件

## 使用场景
- 给定一个矩形区域，想知道里面有哪些控件、拿最具体那个的稳定选择器（如某卡片区域里最内层的标题/按钮）。
- 多步任务枢纽：区域 → 拿 id/text/desc 选择器 → 改用更稳的选择器再定位。

## 什么时候不该用
- 想「精确矩形」匹配：用 `inspect_control_by_bounds`（bounds() 完全相等）。
- 想「控件罩住某点/区域」（找祖先容器）：用 `inspect_control_by_bounds_contains`。
- 只知一个点：用 `inspect_control_by_coord`。

## 参数细节与坑
- `left/top/right/bottom` 必填；可为像素数字，也支持 AutoJS 百分比字符串（如 "50%"）透传。
- `boundsInside()` 为「区域内含」：控件矩形须完全落在给定矩形内，通常命中很多（count 是区域真实总数，可能几十上百）。
- `returnAll`（选填，默认 false）：
  - `false`（默认）：只回最对口 1 个（`control`），省 token。
  - `true`：在保留 `control` 基础上，额外回 `controls` 数组——区域中最对口的 ≤10 个控件（**封顶 10，绝不 dump 全量**），每个元素同 `{control, selectors}` 结构。
- 排序规则（挑最对口）：**选择器可用性优先 有 id > 有 text > 有 desc > clickable**；同层内 可见优先 > 包围盒最小(最深层) 破平。`count` 永远报告区域真实总数，被截断时 AI 一眼可见。
- 拉取整棵 UI 树在复杂界面可能稍慢（正常）。

## 错误处理与兜底
- 成功回 `{ok:1, count, control:{...}, selectors:{...}}`；`returnAll:true` 再加 `controls:[{control,selectors},...]`（≤10）。
- 无命中回 `control:null, count:0`；失败回 `{ok:0, err:"原因"}`，多为缺参或无障碍未开。

## 示例调用
```bash
# 默认：只回最对口 1 个
node run_task.js --path tasks/inspect_control_by_bounds_inside/inspect_control_by_bounds_inside.js --args '{"left":0,"top":192,"right":972,"bottom":1728}'
# returnAll:true：回区域最对口 ≤10 个（count 仍为区域真实总数）
node run_task.js --path tasks/inspect_control_by_bounds_inside/inspect_control_by_bounds_inside.js --args '{"left":0,"top":192,"right":972,"bottom":1728,"returnAll":true}'
```

## 红线提醒
- 仅探测，不操作；需要点按再转发给 `tap_text` 等。
