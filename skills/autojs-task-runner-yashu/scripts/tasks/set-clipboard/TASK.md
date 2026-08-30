---
name: set-clipboard
description: "写手机剪贴板并回读校验；与 get-clipboard 互补，配 input-text 长按粘贴可绕过逐字键入。"
args: { "text": "string*" }
---

# set-clipboard · 写剪贴板

## 使用场景
- 把验证码/链接/长文本放进手机剪贴板，用户手动粘贴，或配合 `input-text` 的粘贴路径；
- 剪贴板链路自检（写→读→比对，self-test 也在用）。

## 什么时候不该用
- 目标输入框已聚焦且内容短 → 直接 `input-text` 逐字键入更直接；
- 想读当前剪贴板 → 用 `get-clipboard`。

## 参数细节与坑
- `text` 必填字符串；写空字符串合法（清空剪贴板）；
- 部分 ROM 对后台写剪贴板有限制：模板已内置回读比对，不一致时明确报 `{ok:0, err:"写入后回读不一致..."}`，不会静默假成功。

## 示例调用
```bash
node run-task.js set-clipboard --args '{"text":"https://example.com"}'
# → {"ok":1,"length":19}
```

## 红线提醒
- 剪贴板属用户敏感数据通道：不要把用户的隐私内容在任务中无故中转/落盘。
