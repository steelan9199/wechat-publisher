---
name: stop-script-by-name
description: "按脚本名强停手机端 AutoJS 实例，清理重复/卡死脚本；默认保护当前运行引擎，不误停自己。"
args: { "name": "string*", "waitMs": "number", "includeSelf": "boolean", "caseSensitive": "boolean" }
---

# stop-script-by-name · 按文件名停止手机端脚本实例

## 使用场景
- 手机端某个常驻脚本（如 `autojs-task-phone-client.js`）被重复拉起、多个实例互相抢截图权限 / WebSocket 连接时，用它一把清掉多余实例。
- 某脚本卡死、不退出、占用资源，需要远程强停，而不想手动去 AutoJs6 里一个个关。
- 作为「单实例保护」流程的收尾：先停止旧实例，再初始化新逻辑（参考 AutoJs6 引擎文档 `engines.all()`/`myEngine()`/`getSource()`/`forceStop()`）。

## 什么时候不该用
- 想停止「当前正在跑的这份模板自己」：默认 `includeSelf=false` 会跳过自身。除非你确实要自杀式停掉自己，否则不要传 `includeSelf:true`。
- 想对界面做点击/滑动/读控件：那是 `tap-text`/`swipe`/`inspect_control_*` 的职责，本模板不碰 UI，只管引擎进程。

## 参数细节与坑
- `name` 必填非空字符串，建议带扩展名（如 `"autojs-task-phone-client.js"`）。
  - 匹配规则（**默认大小写不敏感**）：引擎源 `basename` 等于 `name`（忽略大小写），**或** 源路径字符串中包含 `name`（忽略大小写）→ 视为命中（兼容传入带目录路径的写法）。
  - 需要严格区分大小写时，传 `caseSensitive:true` 恢复大小写敏感匹配。
  - 只传基名更易误伤（例如 `"main.js"` 可能命中多个不同目录的 main.js），尽量传完整文件名。
- `waitMs` 选填，默认 `800`：停止全部命中实例后、回执前 sleep 的毫秒数，给旧实例释放截图权限 / 网络资源留时间。无需等待可传 `0`。
- `includeSelf` 选填，默认 `false`：是否允许把「当前正在执行的引擎」也一起停。`false` 时永远跳过自身（双要素:id 相等且文件名一致，绝不误杀正在干活的任务自己）。
- `caseSensitive` 选填，默认 `false`：匹配是否区分大小写。`false`（默认）时忽略大小写（如大写 `"UI"` 也能命中名字含小写 `ui` 的脚本）；`true` 时恢复大小写敏感。

## 错误处理与兜底
- `name` 缺失或非字符串 → `{ok:0, err:"缺少参数 name（必须是字符串，如 \"autojs-task-phone-client.js\"）"}`。
- 没有任何运行引擎（`engines.all()` 为空）→ `{ok:1, found:0, stopped:0}`，视为成功（没东西可停）。
- 匹配到但 `forceStop()` 抛错 → 仍回 `{ok:1}`，并带 `found`/`stopped` 与 `warn`/`detail` 让人看清停了几个、哪几个失败。
- 读不到某引擎源信息（`getSource()` 异常）→ 该引擎跳过，不影响其余。

## 示例调用
```bash
# 停止所有名为 autojs-task-phone-client.js 的实例，停后等 800ms 再回执
node run-task.js --path tasks/stop-script-by-name/stop-script-by-name.js --args '{"name":"autojs-task-phone-client.js"}'

# 只按名停止、不等资源释放
node run-task.js --path tasks/stop-script-by-name/stop-script-by-name.js --args '{"name":"autojs-task-phone-client.js","waitMs":0}'
```

回执示例：
```json
{"ok":1,"found":2,"stopped":2}
{"ok":1,"found":0,"stopped":0}
{"ok":1,"found":1,"stopped":0,"warn":"部分实例停止失败","detail":"..."}
```

## 红线提醒
- 不做支付操作，本模板与支付无关，但调用方不得借它去折腾支付相关脚本的调度链路。
- 不可逆：forceStop 直接结束进程，被停脚本不会走收尾逻辑。确认该脚本可强杀再下发。
