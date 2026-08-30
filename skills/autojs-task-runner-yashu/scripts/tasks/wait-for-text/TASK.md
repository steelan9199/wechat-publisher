---
name: wait-for-text
description: "等屏幕出现指定文字即回（耗时+位置），轮询探测 text 与 desc；用于跳转后确认页面就绪、等弹窗/加载，替代盲等多轮确认。"
args: { "text": "string*", "timeoutMs": "number", "intervalMs": "number", "exact": "boolean" }
---

# wait-for-text · 条件等待（等文字出现）

## 使用场景
- 界面跳转后确认目标页就绪再走下一步（比固定 wait 500~1500ms 更稳更省）；
- 等弹窗 / 加载提示 / 关键按钮出现，超时明确报 `{ok:0, timeout:true}`。

## 什么时候不该用
- 等的是"界面消失"而非出现 → 用轮询+反向判断的现场脚本；
- 只想知道当前屏幕有什么 → 用 `ocr`（一次出全屏文字）。

## 参数细节与坑
- `text` 必填；默认**包含匹配**且同时探测 `text` 与 `desc`；`exact:true` 改精确匹配。
- `timeoutMs` 默认 10000；长加载页可给 20000~30000；`intervalMs` 默认 500。
- 命中即回，不等到 deadline——通常几百毫秒就返回，比固定 sleep 更快。

## 错误处理与兜底
- 超时：`{ok:0, err:"等待超时(Nms): xxx", timeout:true, waitMs}`——AI 应截图看现场换策略，不要原样重试。

## 示例调用
```bash
node run-task.js open-app --args '{"name":"设置"}'
node run-task.js wait-for-text --args '{"text":"WLAN","timeoutMs":8000}'
# → {"ok":1,"waitMs":612,"bounds":"Rect(271, 1735 - 459, 1825)"}
```

## 红线提醒
- 本模板只读屏等待，不做任何点击/修改操作。
