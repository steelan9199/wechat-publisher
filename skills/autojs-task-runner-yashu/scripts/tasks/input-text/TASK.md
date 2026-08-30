---
name: input-text
description: "向输入框写入文字：优先已聚焦的 EditText，否则第一个可见 EditText，都没有才退化为逐字键入。"
args: { "text": "string*" }
---

# input-text · 向输入框输入文字

## 使用场景
- 搜索框、登录/注册、表单填写等有 EditText 的界面。

## 什么时候不该用
- 要清空再输入：本模板 `setText` 会覆盖，无需先清。
- 富文本/自定义输入法场景，`setText` 可能无效，需退化键入或换策略。

## 参数细节与坑
- `text` 必填非空字符串。策略：① 找 focused EditText → setText；② 否则第一个可见 EditText → setText；③ 都没有 → `input(t)` 逐字键入（依赖当前焦点，不稳）。
- 多个输入框时只填第一个，多字段需分步或先 tap 定位焦点。

## 错误处理与兜底
- 成功 `{ok:1}`；即使没找到输入框，`input(t)` 也会回 `{ok:1}`（可能其实没输进去）→ 后续步骤校验。
- 中文/特殊符号用 `input()` 退路时可能漏字，尽量保证有 EditText 接收。

## 示例调用
```bash
node run-task.js --path tasks/input-text/input-text.js --args '{"text":"霍州天气"}'
```
