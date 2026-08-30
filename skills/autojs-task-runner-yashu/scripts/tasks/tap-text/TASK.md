---
name: tap-text
description: "点按含指定文字的控件，四级降级闭环：无障碍text→desc→OCR定位→截图回传改坐标；不可点沿父链找可点祖先，via 标定位级别。"
args: { "text": "string*" }
---

# tap-text · 按文字点按（四级降级）

## 使用场景
- 有明确可见文字的按钮/列表项/标签（"确定""设置""WLAN"等）——**手机自动化的默认点击方式**；
- 图标按钮（无 text 只有 desc，如计算器的「乘」「清除」）→ 第 2 级自动命中；
- WebView / 图片里的文字（无障碍树拿不到）→ 第 3 级 OCR 自动定位。

## 什么时候不该用
- 已知精确坐标（从 inspect-control-by-coord / crop 得来）→ `tap-point` 更直接；
- 要点滑块/拖拽 → `swipe`；
- 文字会变（动态内容）或含特殊符号易错配时，优先用 `inspect-control-by-coord` 拿 id 再定位。

## 参数细节与坑
- `text` 必填。匹配顺序：text 精确(3s) → textContains(1.5s) → desc 精确(1.5s) → descContains(1s) → OCR 包含匹配；
- 回执 `via` 字段告知命中来源（text/desc/ocr），排查界面适配问题时看它；
- OCR 降级需要截图权限：首次触发会自动点掉授权弹框（正则多候选），属正常（text/desc 命中不申请权限）；
- 沿父链最多上溯 5 层找 `clickable()` 祖先；整条链都不可点才 `click(中心坐标)`；
- 找多个同名文本时取第一个，可能点错项——列表场景最好先滚动/缩小范围。

## 错误处理与兜底
- 四级都失败：`{ok:0, err:"无障碍与 OCR 均未定位到: xxx", screenshot:"<电脑路径>"}`——**AI 必须 Read 该截图**，确认目标真实样式后改用 `tap-point` 按坐标点击，或换更准的文字（部分文字、去 emoji/空格）重试。

## 示例调用
```bash
node run-task.js tap-text --args '{"text":"WLAN"}'
# → {"ok":1,"via":"text"}
node run-task.js tap-text --args '{"text":"乘"}'
# → {"ok":1,"via":"desc"}   ← 计算器图标键，desc 命中
```

## 红线提醒
- 不做支付操作；不可逆操作的点击前必须先向用户确认。
