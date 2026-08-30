---
name: swipe
description: "从 (x1,y1) 滑动到 (x2,y2)，用于翻页、滚动列表、拖拽滑块；duration 默认 500ms 可调。"
args: { "x1": "number*", "y1": "number*", "x2": "number*", "y2": "number*", "duration": "number" }
---

# swipe · 滑动屏幕

## 使用场景
- 滚动长列表找目标、翻页、下滑加载更多、拖拽滑块/进度条。

## 什么时候不该用
- 只是想"回到顶部/底部"，优先看 App 是否有锚点按钮。
- 需要精确拖到某个控件，先 `inspect-control-by-coord` 拿坐标再 swipe。

## 参数细节与坑
- x1/y1/x2/y2 必填数字。duration 选填，默认 500ms；太快系统可能不识别，长列表可加到 800~1200。
- 坐标同样随分辨率/导航栏变化，注意稳定性。

## 错误处理与兜底
- 缺任一必填坐标：`{ok:0, err:"缺少参数 x?（必须是数字）"}`。
- swipe 本身很少报错，是否真滚动用后续截图核验。

## 示例调用
```bash
node run-task.js --path tasks/swipe/swipe.js --args '{"x1":500,"y1":1500,"x2":500,"y2":500,"duration":800}'
```
