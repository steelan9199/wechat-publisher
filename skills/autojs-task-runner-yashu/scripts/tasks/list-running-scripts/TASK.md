---
name: list-running-scripts
description: "列出手机端正在运行的 AutoJS 脚本实例，只回原始三件套 id/source/cwd（不回派生名），标注自己；与 stop-script-by-id 配套——先拿 id，再按 id 精确停止。"
args: { "limit": "number" }
---

# list-running-scripts · 查看手机端正在运行的脚本

## 使用场景
- 巡检手机端后台：到底有几个 AutoJS 脚本在跑、分别是什么、跑在哪个目录。
- **给 `stop-script-by-id` 取 id**：先列一遍拿到目标实例的 `id`，再按 id 精确点杀。
- 排查「重复实例」：同一工程被重复启动时，会出现多个 `source`/`cwd` 完全相同的条目，**只有 `id` 能把它们区分开**。
- 确认「当前任务自己」在哪条引擎上（`isSelf:true`），便于理解进程关系。

## 什么时候不该用
- **想停止某个脚本：本模板只读，绝不 forceStop**；停止走 `stop-script-by-id`（按 id 精确停）。
- 想看界面/控件：那是 `inspect_control_*` 的职责，本模板不碰 UI。

## 参数细节与坑
- 无必填参数。可选：
  - `limit` 选填数字，默认 `50`：最多回传几条。仅作异常保护（防极端情况下刷屏），**不会把真实总数藏起来**——`total` 永远报告 `engines.all()` 的真实长度，`count < total` 即表示被截断，调大 `limit` 即可。

## 回执字段（只回原始值，无派生字段）
```json
{"ok":1,"count":N,"total":M,"engines":[{"id":11,"source":"...","cwd":"...","isSelf":false}]}
```
- `count`：本次回传条数；`total`：引擎真实总数。
- 每条引擎固定四个键，**取不到时为 `null`，绝不省略字段**（便于下游稳定解构）：
  - `id` `{number|null}`：引擎编号。全局自增、进程内不复用，是区分重复实例的唯一标识。
    ⚠ **APP 进程重启后会归零重新发号**，只作瞬时标识，**不可跨会话持久化使用**。
  - `source` `{string|null}`：脚本源路径。文件脚本=绝对路径（如 `/storage/emulated/0/脚本/scripts-from-computer/project/xx/main.js`）；字符串脚本=`$engine/名称.js`。
  - `cwd` `{string|null}`：脚本工作目录。**工程脚本=工程目录，客户端下发的单脚本=客户端目录**——可据此判断一个实例属于哪个工程。
  - `isSelf` `{boolean}`：`true` 表示这一条就是「正在执行本任务的引擎」。

> 已移除旧的 `name` 派生字段：它由 `files.getName(source)` 算出，不是原始信息，且语义有歧义
> （`ScriptSource.name` 不带扩展名，与 `files.getName()` 结果不一致）。需要名字时请自行从 `source` 截取。

## 错误处理与兜底
- `engines.all()` 取不到 → 当作空数组，回 `{ok:1, count:0, total:0, engines:[]}`（视为没有运行实例）。
- 单个引擎的某个字段读取异常 → 该字段置 `null`，**其余字段照常返回**，不中断整体，也不丢弃该条。
- `myEngine` 的 id 取不到 → 所有条目 `isSelf:false`（保守，宁可不标也不误标）。
- 整体抛错 → `{ok:0, err:"原因"}`。

## 示例调用
```bash
# 列出全部运行中的脚本
node scripts/run-task.js list-running-scripts --args '{}'

# 只关心前 10 条
node scripts/run-task.js list-running-scripts --args '{"limit":10}'
```

回执示例（含两个 source 完全相同的重复实例，只能靠 id 区分）：
```json
{"ok":1,"count":3,"total":3,"engines":[
  {"id":6,"source":"/storage/emulated/0/脚本/scripts-from-computer/client/autojs-task-phone-client.js","cwd":"/storage/emulated/0/脚本/scripts-from-computer/client","isSelf":false},
  {"id":11,"source":"/storage/emulated/0/脚本/scripts-from-computer/project/probe-proj/main.js","cwd":"/storage/emulated/0/脚本/scripts-from-computer/project/probe-proj","isSelf":false},
  {"id":12,"source":"/storage/emulated/0/脚本/scripts-from-computer/project/probe-proj/main.js","cwd":"/storage/emulated/0/脚本/scripts-from-computer/project/probe-proj","isSelf":true}
]}
```

## 配套用法：先 list 再 stop
```bash
# 1) 列出，挑出要停的那条的 id（如 11）
node scripts/run-task.js list-running-scripts --args '{}'
# 2) 按 id 精确点杀
node scripts/run-task.js stop-script-by-id --args '{"ids":[11]}'
```

## 红线提醒
- 只读模板，不操作界面、不停止任何脚本；与支付操作无关。
- 返回的 `id`/`source` 仅供巡检与定位，不要把本模板当「批量管理」入口去做越权调度。
- `id` 会随 APP 重启归零，不要把它写进任何持久配置或跨会话缓存。
