---
name: inspect_control_by_coord
description: "按坐标 (x,y) 探测：返回该坐标压着的最深层控件的 className/id/text/desc/clickable/bounds/packageName，并生成可复用的 id/text/desc 定位选择器。用途：看到某位置→知道是什么控件→之后用稳定选择器再定位。"
args: { "x": "number*", "y": "number*" }
---

# inspect_control_by_coord · 按坐标探测控件

## 使用场景
- "看"屏幕的替代：想知道某个位置是什么控件、有什么文字/ID，便于后续用稳定选择器操作。
- 多步任务枢纽：坐标 → 拿 text/id → 改用 `tap_text` 或 id 选择器（比坐标稳）。

## 什么时候不该用
- 已知文字/ID 直接点，不必先探测。
- 已知文字/描述、想反向探测控件信息：用姐妹模板 `inspect_control_by_text`。
- 已知精确矩形范围想探测控件：用姐妹模板 `inspect_control_by_bounds`（精确矩形匹配，容错比坐标点低）。
- 纯背景/越界坐标：返回 `{ok:1, control:null, selectors:{}}`，无信息。

## 参数细节与坑
- `x`、`y` 必填数字。拉整棵 UI 树在复杂界面可能稍慢（正常）。
- 取包围盒面积最小者 = 最深层控件。
- 选择器优先级 id > text > desc，均带 `.visibleToUser(true)`；**不回传 bounds 选择器**（与坐标等价、不稳定，省 token 也防误导）。

## 错误处理与兜底
- 成功回 `{ok:1, control:{...}, selectors:{...}}`；无控件回 `control:null`。
- 失败回 `{ok:0, err:"原因"}`，多为缺参或无障碍未开。

## 示例调用
```bash
node run_task.js --path tasks/inspect_control_by_coord/inspect_control_by_coord.js --args '{"x":767,"y":1517}'
```

## 红线提醒
- 仅探测，不操作；需要点按再转发给 `tap_text` 等。
