---
name: open_app
description: "按应用名打开 App（如"设置""浏览器"），成功回传包名 pkg；找不到应用明确报错。"
args: { "name": "string*" }
---

# open_app · 按应用名打开 App

## 使用场景
- 任务第一步切换到目标 App；多 App 协作（如从浏览器跳转到别的 App，注意支付红线操作）。

## 什么时候不该用
- 应用名不确定时，先让用户确认或截图看已装应用。

## 参数细节与坑
- `name` 是**显示名称**（如"设置"），不是包名；引擎用 `app.getPackageName(name)` 解析。
- 同名/模糊名称可能解析错，最好用更精确的名称。

## 错误处理与兜底
- 找不到：`{ok:0, err:"未找到应用: xxx"}` → 让用户确认应用名或是否已安装。
- 成功：`{ok:1, pkg:"com.xxx"}`，并 `sleep(1500)` 等启动。

## 示例调用
```bash
node run_task.js --path tasks/open_app/open_app.js --args '{"name":"设置"}'
```
