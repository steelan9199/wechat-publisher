---
name: list-running-scripts
description: "列出手机端正在运行的 AutoJS 脚本实例（名/路径/目录，标注自己），巡检重复或卡死实例，配 stop-script-by-name 清理。"
args: { "limit": "number" }
---

# list-running-scripts · 查看手机端正在运行的脚本

## 使用场景
- 巡检手机端后台：到底有几个 AutoJS 脚本在跑、分别是什么。
- 排查「重复实例」：先用本模板看一眼，发现同名脚本多个，再调 `stop-script-by-name` 清理。
- 确认「当前任务自己」在哪条引擎上（`isSelf:true`），便于理解进程关系。

## 什么时候不该用
- 想停止某个脚本：本模板只读、绝不 forceStop，停止请走 `stop-script-by-name`。
- 想看界面/控件：那是 `inspect_control_*` 的职责，本模板不碰 UI。

## 参数细节与坑
- 无必填参数。可选：
  - `limit` 选填数字，默认 `50`：最多回传几条。仅作异常保护（防极端情况下刷屏），**不会把真实总数藏起来**——若 `count` 远低于你预期，说明被 `limit` 截了，调大即可。
- 每个引擎回传字段：
  - `name`：脚本基名（如 `autojs-task-phone-client.js`）。
  - `source`：完整源路径（如 `$remote/autojs-task-phone-client.js` 或 `/storage/emulated/0/脚本/xxx.js`）。
  - `cwd`：脚本工作目录；字符串脚本/无法确定时为空串。
  - `id`：尽力读取的引擎 id，读不到则该字段省略。
  - `isSelf`：`true` 表示这一条就是「正在执行本任务的引擎」。

## 错误处理与兜底
- `engines.all()` 取不到 → 当作空数组，回 `{ok:1, count:0, engines:[]}`（视为没有运行实例）。
- 单条引擎读源失败（异常）→ 该条 `name` 记 `(未知)`、`source` 置空，不影响其余条目。
- 整体抛错 → `{ok:0, err:"原因"}`。

## 示例调用
```bash
# 列出全部运行中的脚本
node run-task.js --path tasks/list-running-scripts/list-running-scripts.js --args '{}'

# 只关心前 10 条
node run-task.js --path tasks/list-running-scripts/list-running-scripts.js --args '{"limit":10}'
```

回执示例：
```json
{"ok":1,"count":2,"engines":[
  {"name":"autojs-task-phone-client.js","source":"$remote/autojs-task-phone-client.js","cwd":"/storage/emulated/0/脚本","isSelf":false},
  {"name":"list-running-scripts.js","source":"$remote/list-running-scripts.js","cwd":"","isSelf":true}
]}
```

## 红线提醒
- 只读模板，不操作界面、不停止任何脚本；与支付操作无关。
- 返回的 `source`/`name` 仅供巡检与定位，不要把本模板当「批量管理」入口去做越权调度。
