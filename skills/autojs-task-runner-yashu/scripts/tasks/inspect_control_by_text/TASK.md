---
name: inspect_control_by_text
description: "按文字 text 在 UI 树中匹配控件的 text 或 desc(contentDescription)，返回命中控件信息(className/id/text/desc/clickable/bounds/packageName)与可复用 id/text/desc 选择器；命中多个时按「精确>可见>最深层」挑一个并附 count。是 inspect_control_by_coord 的按文字版本。"
args: { "text": "string*", "exact": "boolean?" }
---

# inspect_control_by_text · 按文字探测控件

## 使用场景
- 已知控件上写的字（或无障碍描述 desc），想拿到它的稳定选择器，供后续 `tap_text` / id 选择器操作。
- 多步任务枢纽：文字 → 拿 id/text/desc 选择器 → 改用更稳的选择器再定位（比坐标稳）。

## 什么时候不该用
- 只知道坐标、想确认那一个点：用 `inspect_control_by_coord`。
- 界面上同名字控件很多且要逐个处理：本模板只回「最佳一个 + count」，批量场景需自行循环或改脚本。

## 参数细节与坑
- `text` 必填非空字符串；同时匹配控件的 `text` 与 `desc`。
- `exact` 可选：默认 false（包含/模糊匹配，英文字母大小写不敏感）；true 则要求精确相等。
- 命中多个时的挑选顺序：精确命中 > 可见 > 包围盒最小（最深层）。结果里的 `count` 提示是否歧义。
- 拉整棵 UI 树在复杂界面可能稍慢（正常）。

## 错误处理与兜底
- 成功回 `{ok:1, count, control:{...}, selectors:{...}}`；无命中回 `control:null, count:0`。
- 失败回 `{ok:0, err:"原因"}`，多为缺参或无障碍未开。

## 示例调用
```bash
node run_task.js --path tasks/inspect_control_by_text/inspect_control_by_text.js --args '{"text":"确定"}'
node run_task.js --path tasks/inspect_control_by_text/inspect_control_by_text.js --args '{"text":"确定","exact":true}'
```

## 红线提醒
- 仅探测，不操作；需要点按再转发给 `tap_text` 等。
