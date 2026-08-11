---
name: inspect_control_by_id
description: "按控件 id(resource-id) 在 UI 树中匹配控件，返回命中控件信息(className/id/text/desc/clickable/bounds/packageName)与可复用 id/text/desc 选择器；命中多个时按「精确>可见>最深层」挑一个并附 count。是 inspect_control_by_coord / by_text 的按 id 版本。"
args: { "id": "string*", "exact": "boolean?" }
---

# inspect_control_by_id · 按 id 探测控件

## 使用场景
- 已知控件 id（如 "com.xxx:id/title"），想拿到它的完整信息与稳定选择器，供后续 id 选择器操作。
- 多步任务枢纽：id → 拿 text/id/desc 选择器 → 改用更稳的选择器再定位（比坐标稳）。

## 什么时候不该用
- 只知道坐标：用 `inspect_control_by_coord`。
- 已知文字/描述：用 `inspect_control_by_text`。
- 列表项常出现重复 id：本模板只回「最佳一个 + count」，批量场景需自行循环或改脚本。

## 参数细节与坑
- `id` 必填非空字符串，指控件的 resource-id。
- `exact` 可选：默认 false（包含/模糊匹配，英文字母大小写不敏感）；true 则要求精确相等。
- 命中多个时的挑选顺序：精确命中 > 可见 > 包围盒最小（最深层）。结果里的 `count` 提示是否歧义。
- 拉整棵 UI 树在复杂界面可能稍慢（正常）。

## 错误处理与兜底
- 成功回 `{ok:1, count, control:{...}, selectors:{...}}`；无命中回 `control:null, count:0`。
- 失败回 `{ok:0, err:"原因"}`，多为缺参或无障碍未开。

## 示例调用
```bash
node run_task.js --path tasks/inspect_control_by_id/inspect_control_by_id.js --args '{"id":"com.xxx:id/title"}'
node run_task.js --path tasks/inspect_control_by_id/inspect_control_by_id.js --args '{"id":":id/title","exact":false}'
```

## 红线提醒
- 仅探测，不操作；需要点按再转发给 `tap_text` 等。
