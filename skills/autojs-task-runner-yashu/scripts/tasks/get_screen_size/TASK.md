---
name: get_screen_size
description: "获取手机屏幕分辨率宽高：直接用 device.width/device.height 读取，无需截图或裁图。当要用到屏幕坐标（tap_point/swipe 等）却不知道分辨率时使用，比截屏取尺寸更直接、零截图、最省 token。"
args: {}
---

# get_screen_size · 获取手机屏幕分辨率

## 使用场景
- 要用 `tap_point` / `swipe` 等坐标类操作，但不知道当前分辨率宽高时，先调本模板拿到 `device.width` / `device.height`，再按百分比换算坐标（如中下部 = `height*0.75`）。
- 比「截图 → 读 PNG 尺寸」更直接、零截图、零额外落盘，最省 token。

## 什么时候不该用
- 想知道某个控件的位置：用 `inspect_control_by_*` 系列，它们直接回传控件 `bounds`，不用先拿分辨率再换算。
- 已经知道分辨率且要立刻点按：直接用 `tap_point`，不必多此一举。

## 参数细节与坑
- 无参数。返回纯数据 `{ok:1, width, height}`。
- `device.width/height` 是设备物理像素分辨率（如 `1080×2400`），与 AutoJs6 当前截图分辨率一致。
- `width` 对应横轴、`height` 对应纵轴；坐标换算公式：`x = width * 比例`，`y = height * 比例`。

## 错误处理与兜底
- 成功回 `{ok:1, width, height}`。
- 极少数情况读不到（如 device 模块异常）回 `{ok:0, err:"原因"}`。

## 示例调用
```bash
node run_task.js --path tasks/get_screen_size/get_screen_size.js
# 返回 {"ok":1,"width":1440,"height":3200}
```

## 红线提醒
- 仅查询，不操作界面；属只读获取。
