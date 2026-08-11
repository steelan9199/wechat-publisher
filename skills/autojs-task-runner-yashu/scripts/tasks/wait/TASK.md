---
name: wait
description: "等待指定毫秒数，用于等界面加载、动画结束、弹窗出现后再走下一步；通常插在界面跳转步骤之后。"
args: { "ms": "number*" }
---

# wait · 等待

## 使用场景
- `open_app` / `tap_text` / `swipe` 等导致界面变化的步骤之后，给界面 500~1500ms 稳定时间。
- 固定轮询间隙（不推荐长等待，会拖慢任务）。

## 什么时候不该用
- 等某个特定控件出现：用 `inspect_control_by_coord` 轮询比盲等更准。
- 大段等待（>3s）说明步骤设计可优化，考虑截图核验代替死等。

## 参数细节与坑
- `ms` 必填非负数字；负数会被拒 `{ok:0, err:"缺少参数 ms（必须是非负数字）"}`。

## 错误处理与兜底
- 几乎不失败，纯 sleep。

## 示例调用
```bash
node run_task.js --path tasks/wait/wait.js --args '{"ms":1000}'
```
