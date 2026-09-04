---
name: stop-script-by-id
description: "按引擎 id 精确停止手机端正在运行的 AutoJS 实例（可只停重名实例中的一个），默认保护自身；id 由 list-running-scripts 提供。未匹配到任何 id 时返回失败。"
args: { "ids": "array", "includeSelf": "boolean", "waitMs": "number" }
---

# stop-script-by-id · 按 id 停止运行中的脚本

> 本模板由 `stop-script-by-name` 重命名而来。**名字不是唯一标识**——实测同一工程重复启动会产生多个
> `source`、`cwd` 完全相同的实例，按名字只能「全停或全留」。改为按 id 操作后，可精确点杀其中一个。

## 使用场景
- 停止指定实例：先跑 `list-running-scripts` 拿到 `id`，再按 id 精确停掉那一条。
- **清理重复实例**：多个 `source` 相同的实例里，只停掉多余的那个，保留正在用的。
- 卡死实例回收：某条引擎不响应时，按 id 强停它而不波及其它实例。

## 什么时候不该用
- **还不知道 id**：先用 `list-running-scripts` 列出取 id，不要凭猜测填。
- 想停掉全部脚本：那不是本模板职责（本模板只停显式指定的 id）。
- 只想巡检、不想停：`list-running-scripts` 是只读的，用它。

## 参数
- `ids` **必填**：要停止的引擎 id。传数组 `[11,12]` 或单个数字 `11` 均可（单个会自动包成数组）。
  id 从 `list-running-scripts` 回执的 `id` 字段取得。
- `includeSelf` 选填，默认 `false`：**永远保护正在执行本任务的自身引擎**。
  置 `true` 才允许连自己一起停（自杀式，一般不用）。
- `waitMs` 选填，默认 `800`：停止后、回执前等待的毫秒数，给旧实例释放截图权限 / WebSocket 等资源留时间。

## 回执
成功：
```json
{"ok":1,"found":2,"stopped":1,
 "missedIds":[99],
 "detail":{"stopped":[{"id":11,"source":"/storage/emulated/0/脚本/scripts-from-computer/project/xx/main.js"}],
           "skipped":[{"id":12,"source":"...","reason":"self"}]}}
```
- `found`：匹配到的实例数（含被自保护跳过的）；`stopped`：实际强停成功的数量。
- `missedIds`：传入但**没匹配到任何运行中引擎**的 id（仅在有遗漏时出现）。
- `detail.stopped` / `detail.skipped`：逐条明细，带 `id` 与 `source` 便于追溯核对。
- `detailSkipped.reason`：`"self"`（被自保护跳过）/ `"forceStop_error"`（强停报错）。
- 部分未能停止时额外给 `warn` 与 `detailErrors`。

失败（都是人话，可直接转述给用户）：
- 缺 `ids` / `ids` 无有效值 → `{ok:0, err:"缺少参数 ids..."}`
- **一个 id 都没匹配上 → `{ok:0, err:"未匹配到任何运行中的引擎 id=[...]"}`**（不静默当成功，避免误以为已停）
- 认不出自身引擎 id → `{ok:0, err:"无法识别自身引擎 id..."}`（见下方安全护栏）
- 当前没有任何运行中的引擎 → `{ok:0, err:"当前没有任何运行中的引擎..."}`

## 安全护栏（改动本模板时勿破坏）
1. **自保护优先**：`includeSelf` 为 `false` 时跳过自身引擎，即使 `ids` 里明确包含了自己的 id。
2. **认不出自己就绝不动手**：`engines.myEngine().id` 取不到时自保护会失效，此时**整体放弃停止**并报错，
   绝不冒险遍历强停——宁可不停，绝不自杀。确需继续请显式传 `includeSelf:true`。
3. **未命中即失败**：`found === 0` 时回 `ok:0`，不静默成功。
4. **自保护判定只用 id 单要素**，不掺文件名：实测存在 `source`/`cwd` 完全相同的多个实例，
   文件名无法区分；且一旦 source 读取异常，AND 逻辑会把「自己」判成非自己，反而造成自杀。

## 错误处理与兜底
- 单条引擎 `forceStop()` 抛错 → 记入 `detailSkipped`（`reason:"forceStop_error"`）+ `detailErrors`，
  **不影响其余实例继续停止**，整体仍 `ok:1` 但带 `warn`。
- 某条引擎 id 读不到 → 无法安全判定，直接跳过（不停止、不计入 found）。
- 整体抛错 → `{ok:0, err:"原因"}`。

## 示例调用
```bash
# 1) 先列，拿到目标 id
node scripts/run-task.js list-running-scripts --args '{}'
# 2) 停掉其中一个（可只停重名实例里的一个）
node scripts/run-task.js stop-script-by-id --args '{"ids":[11]}'
# 批量停多个
node scripts/run-task.js stop-script-by-id --args '{"ids":[11,12]}'
# 单个数字写法（等价）
node scripts/run-task.js stop-script-by-id --args '{"ids":11}'
# 停完后不等资源释放（回执更快）
node scripts/run-task.js stop-script-by-id --args '{"ids":[11],"waitMs":0}'
```

## 红线提醒
- **破坏性模板**：会真实强停脚本。id 必须来自当次 `list-running-scripts` 的实时回执，不要用记忆里的旧 id。
- `id` 在 APP 进程重启后会归零重新发号——**跨会话复用旧 id 存在误停风险**，务必先 list 再 stop。
- 与支付/下单等敏感操作无关，但强停正在跑业务的脚本可能造成数据中断，执行前确认目标身份。
