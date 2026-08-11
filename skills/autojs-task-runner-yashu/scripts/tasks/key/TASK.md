---
name: key
description: "系统按键：back 返回上一级 / home 回桌面 / recent 打开最近任务。"
args: { "name": "string*" }
---

# key · 系统按键

## 使用场景
- 误入某页用 `back` 返回；任务收尾用 `home` 回桌面；切换 App 用 `recent`。

## 什么时候不该用
- 想关掉弹窗：优先找"关闭/X"文字用 `tap_text`，key 的 back 不一定关弹窗。
- 应用内"返回"按钮可能和系统的 back 行为不同，必要时用坐标点应用内按钮。

## 参数细节与坑
- `name` 只接受 `back` / `home` / `recent`，其余值返回 `{ok:0, err:"...只支持 back/home/recent"}`。
- 非法值不会执行任何动作，安全。

## 错误处理与兜底
- 直接映射系统按键，几乎不报错；是否生效靠后续界面核验。

## 示例调用
```bash
node run_task.js --path tasks/key/key.js --args '{"name":"back"}'
```
