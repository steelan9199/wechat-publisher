# autojs-task-relay-server 架构说明（面向维护者与 AI 辅助编程）

> 这是一份「地图」，不是源码。改这个服务的某块功能前，先读这里，再只打开对应那个文件，**不用把 11 个文件全翻一遍**。
> 入口：`../autojs-relay-server.js`（只做装配+启动，业务实现全在 `relay/`）。本目录 `relay/` 是全部实现。

## 1. 它是什么

一个跑在电脑本地的 **HTTP + WebSocket 中继服务器**（默认端口 `9421`），充当 **AI 聊天软件** 与 **手机上的 AutoJS** 之间的桥梁：

- AI 发 HTTP 指令（截图 / 跑脚本）→ 服务器经 WebSocket 转发给手机
- 手机把截图/脚本结果经 WebSocket 或 HTTP 回传 → 服务器落盘或回给 AI

拆分的唯一原则：**按「谁在跟我说话」切文件**，而不是按协议或按功能。

## 2. 整体结构

```
autojs-relay-server.js  ← 入口：装配 + 启动编排（别改业务到这里）
   │
   ├─ createRelayServer()        router.js        一个 Hono app 注册两组路由，serve 挂到 http.Server（不自动 listen）
   │     ├─ registerAiRoutes()   ai-api.js        【AI 侧】/health /screenshot /run /version /pid /templates /shutdown
   │     └─ registerPhoneRoutes() phone-http.js   【手机·短连接】/upload /probe/*
   │
   ├─ attachPhoneWS(server)      phone-ws.js      【手机·长连接】截图数据 / run 结果 / 断线
   │
   ├─ probeService()/replaceRunningService()  pc-bootstrap.js  【电脑侧】自保护探测 + 版本对齐(自升级) / 端口释放 / 横幅
   │
   ├─ state.js                   运行时状态单点收口（phoneWS / pendingRequest / server 实例 / 关闭标志）
   ├─ config.js                  端口 / 目录 / 超时 等全部常量
   └─ utils/                     工具函数库（无业务语义）
         ├─ http.js              响应/请求体读写
         ├─ fsx.js               路径穿越防护 / 落盘
         └─ port.js              端口占用查找与强杀（跨平台）
```

**解耦关键点**：`ai-api.js` 完全不碰 WebSocket，所有对手机的动作只走 `state.sendToPhone()`；`phone-ws.js` 不认识 HTTP。两边只通过 `state.js` 通信。

## 3. 文件清单（改东西先定位到这里）

| 文件 | 交互对象 | 职责 | 关键导出 |
|---|---|---|---|
| `router.js` | — | Hono app 注册两组路由（AI 侧 + 手机短连接），`serve({fetch, server})` 挂到自建 `http.Server`（不自动 listen），监听时机由入口统一掌控 | `createRelayServer()` |
| `ai-api.js` | **AI** | `/health` `/screenshot` `/run`；控制类 `/version` `/pid` `/shutdown`；纯本地只读 `/templates`（扫描模板清单，不碰手机），经 `state` 下发指令 | `handleAiRequest(req,res,urlObj)→bool` `handleVersion` `handlePid` `handleTemplates` `handleShutdown` |
| `phone-http.js` | **手机·短连接** | `/upload?name=` 收文件、`/probe/<rel>` 下发探针脚本、`/pcfile/<name>` 下发「电脑→手机」中转文件 | `handlePhoneRequest(req,res,urlObj)→bool` |
| `phone-ws.js` | **手机·长连接** | WS 收侧：二进制=截图、文本=run 结果/错误、断线清理 | `attachPhoneWS(server)→wss` |
| `pc-bootstrap.js` | **电脑** | 启动自保护探测 + 版本对齐(自升级)、端口释放、终端横幅 | `probeService(port)` `replaceRunningService(port,info)` `freePortForStart(port)` `printAlreadyRunningNotice(port)` `printVersionMismatchNotice(...)` `printStartupBanner(port)` |
| `state.js` | — | 手机连接 + 在途请求 + server 实例 + 关闭标志的**唯一**读写入口 | `getPhoneWS/setPhoneWS/isPhoneOnline/sendToPhone` `hasPending/setPending/clearPending/resolvePending/rejectPending` `setServer/getServer` `isShuttingDown/setShuttingDown` |
| `config.js` | — | 全部常量集中处 | `PORT` `APP_NAME` `VERSION` `BUILD_FINGERPRINT` `SCRIPTS_DIR` `SCREENSHOT_DIR` `UPLOAD_DIR` `PC_FILE_DIR` `PROBE_ROOT` `CAPTURE_TIMEOUT` `RUN_TIMEOUT` |
| `utils/http.js` | — | 响应与请求体 | `sendJson` `sendError` `sendText` `sendScript` `readBodyBuffer` `readBodyText` `readBodyJson` |
| `utils/fsx.js` | — | 路径安全 + 落盘 | `isSafeFileName` `isSafeRelPath` `resolveWithin` `ensureDir` `writeFileEnsured` `timestampName` |
| `utils/port.js` | — | 端口占用查杀（跨平台） | `findPidsByPort` `freePort` `sleepSync` |

## 4. 三条交互链路

**① AI 触发截图**：`GET /screenshot` → `ai-api` 查 `isPhoneOnline` → `sendToPhone({action:'capture'})` → 手机经 WS 回传二进制 → `phone-ws.onBinary` → `resolvePending(buf)` → `ai-api` 写 PNG 落盘 → 回 `{success,path,size}`。

**② AI 下发脚本**：`POST /run`（body `{code?/path?, args?}`）→ `sendToPhone({action:'run',...})` → 手机执行 → 文本 JSON `{type:'run_result',payload}` → `phone-ws.onText` → `resolvePending(payload)` → 回 `{success,result}`。

**③ 手机上传/拉脚本**：`POST /upload?name=` 接收手机端原始二进制直传（Hono `c.req.arrayBuffer()` 读原始字节），落盘 `UPLOAD_DIR` 并返回电脑绝对路径；`GET /probe/<rel>` 从 `PROBE_ROOT`（即 `scripts/`）读源码下发，保证手机端始终拿最新探针。手机任务模板 `crop-screenshot`（B 坐标模式区域截图）正是走这条链路把裁剪出的 PNG 回传电脑。

**③-b 电脑→手机 文件下发（PC→Phone）**：PC 侧 `scripts/pc-to-phone.js` 把任意本地文件复制到 `PC_FILE_DIR`（系统临时目录，安全文件名+随机后缀防重名），健康检查通过后 `POST /run` 下发手机端模板 `send-file-to-phone`；该模板从中继 `GET /pcfile/<name>` 拉取原始字节（`http.get` + `body.bytes()`），用 `files.writeBytes` 落盘到手机 `targetDir/targetName`（默认 `/sdcard/Download`），并回读校验字节数。与 ③ 的「手机→电脑」反向互补，专治「把电脑任意文件推到手机」需求。文件取走后的「一次性删除」由 `pc-to-phone.js` 在收到手机 ok 回执后负责（不在服务端删，以便手机失败可重试）。`RELAY_PC_FILE_DIR` 可覆盖中转目录。

**④ 生命周期控制（纯本地，不碰手机）**：`GET /version` 返回 `VERSION` 与源码 `fingerprint`（构建指纹，自升级判据）；`GET /pid` 返回进程 PID 及可直接执行的结束命令（`taskkill /PID <pid> /F` 或 `kill -9 <pid>`）；`POST /shutdown` 优雅退出——先回 `200`，再 `server.close()`（同时 `ws.close()` 关手机连接），并设 5s 兜底强制 `process.exit(0)`。关闭过程中其余请求返回 `503`。

所有「等手机回传」共用 `ai-api.waitForPhone(timeoutMs,msg)`：登记 `setPending` 并挂超时，超时则 `clearPending` 后 reject。

## 5. 必须遵守的不变式（踩过坑，别再破）

1. **在途锁只覆盖同步短操作**：`state.hasPending()` 在 `/screenshot`、`/update-client`、`/delete-project` 入口做 429 拦截（单在途槽位防串包）。`/run`、`/run-project` 已任务单化（第 10 节），**不再占用也不检查在途槽位**；新增「等手机回传」的同步接口必须复用同一把锁，否则会串包——若结果可按 taskId 归位，优先走任务单模型而不是在途锁。
2. **状态只经 `state.js`**：不要在任何模块里再声明一个 `phoneWS` / `pendingRequest` 裸变量。要改连接或在途请求，只调 `state` 的导出函数。
3. **路径永远先过 `fsx` 校验**：`/upload` 用 `isSafeFileName`（禁止任何目录分隔符）；`/probe` 用 `resolveWithin`（允许子目录，但解析后必须仍在 `PROBE_ROOT` 内）。不要手写 `..` 校验。
4. **启动自保护 + 版本对齐（自升级）**：启动用 `probeService(PORT)` 探测端口上是否已有本服务。没在跑 → 正常启动；在跑且 `fingerprint` 一致 → 直接退出（绝不误杀，避免踢掉已连手机）；在跑但 `fingerprint` 不同 → 先 `POST /shutdown` 优雅退出旧程序、等端口释放，再启动新程序（自升级）。`fingerprint` 由 `config.BUILD_FINGERPRINT` 对所有源码 `.js` 算 sha256 得到，AI 改任意源码即变，无需 git。只有在确认没在跑后，`freePortForStart` 才清残留占用。
5. **退出要走优雅路径**：任何「停止本服务」的逻辑都复用 `POST /shutdown` 的模式——先回响应，再 `server.close()`（顺手 `ws.close()` 关手机连接），最后 5s 兜底 `process.exit(0)`。**不要在请求处理中途直接 `process.exit`**，否则可能丢正在进行的手机截图/脚本结果；也不要新增「收到任意请求就自停」的逻辑，否则会误杀正常 AI 请求（如 `/screenshot` `/run`）。

## 6. 已修的 8 个历史坑（别回退）

1. `/run` 里曾用 `let path` 遮蔽 `node:path` → 已改名 `scriptPath`。
2. `/screenshot` 原本没有并发保护 → 已补 429（与 `/run` 对齐）。
3. `/upload` 与 `/probe` 两套不一致的穿越校验 → 已合并进 `fsx.js` 共用 `hasTraversal` 内核。
4. 十几处手写 `writeHead+end(JSON.stringify)` → 已统一 `sendJson`/`sendError`。
5. **心跳只标记离线、不 terminate → 已改为"一个周期未回 pong 即 terminate 强断"**。
   旧策略下一次 pong 丢失（手机息屏 Wi-Fi 省电 / 瞬断就很常见）心跳便永久停发：
   `isAlive` 永远回不到 true，PC 永久判离线；而连接没断，手机端 3 秒自动重连
   永远不触发，卡死在"PC 判离线、手机仍在线"的死局，只能手动重跑手机客户端。
   terminate 后手机端 okhttp 立即感知断线并自动重连，最坏 15~18 秒自愈。
   详见 `phone-ws.js` 心跳注释与 `config.js` HEARTBEAT_INTERVAL 红线。
6. `ws.on("close")` 曾无条件 `rejectPending` → 已加 `getPhoneWS() === ws` 守卫。
   旧僵尸 socket 延迟 close 时会误杀新连接上正在执行的在途请求（报"手机断开连接"）。
7. **引擎假死探测不到 → 已补"应用层心跳判死"（验收用例 6.3 实测踩坑）**。
   协议层 pong 由 okhttp 自动回：手动停掉客户端**脚本引擎**后 pong 照常，
   health 恒报 `connected`、新任务单永久悬挂 `submitted`。手机端脚本引擎每 10s
   发应用层 `{"type":"ping"}`（引擎死即停发），中继据此双重判活：
   `state.isPhoneOnline()` = WS OPEN **且应用层 ping 新鲜**（`APP_PING_STALE_MS`
   35s 未到即判引擎死，phone-ws 心跳周期里 terminate）；连接重建时判死器重置
   （未 armed 不启用，防误杀旧版客户端）。
   **附带修掉**：`isPhoneOnline` 曾把协议层 `isAlive===false` 当离线——那只是
   "已发 ping 等 pong"的毫秒级窗口，会把正常下发秒级误拒（实测并发回归踩过），
   现只按 WS OPEN + 应用层新鲜度判定。
8. **任务单永久悬挂 submitted → 已补"提交超时熔断"（同 6.3 场景）**。
   提交后手机一直没接单（瞬断/引擎假死/中继重启重载的历史单）超过
   `SUBMIT_TIMEOUT_MS`（60s），扫描器（5s 一拍）落 `failed`，
   `result.phase:"relay"` 标记为中继侧熔断——AI 侧 `--status` 拿得到确定终态。

## 7. 怎么扩展

- **新增 AI 接口**：只在 `ai-api.js` 的 `handleAiRequest` 的 `switch` 里加 `case`。同步短操作（等手机一次性回传，如截图）用 `sendToPhone` + `waitForPhone`；任务类（结果经回执异步到达）走 `task-registry` 任务单模型（见第 10 节）；纯本地控制类（如 `/version` `/pid`）直接 `sendJson` 即可，无需走手机。`router.js` 不动。
- **新增手机 HTTP 接口**：只在 `phone-http.js` 的 `handlePhoneRequest` 里加分支。
- **改端口/目录/超时**：只动 `config.js`。
- **新增工具**：放 `utils/`，保持「无业务语义、可被任意模块复用」。

## 8. 运行与配置

```bash
node autojs-relay-server.js          # 默认 9421
RELAY_PORT=19421 node ...            # 临时实例（验证用，不动生产 9421）
RELAY_UPLOAD_DIR=/path node ...      # 覆盖上传落盘目录
```
- 依赖：`hono` + `@hono/node-server`（HTTP 路由层）+ `ws`（WebSocket 长连接，挂在同一端口）。均在 `scripts/node_modules`，`package.json` 含 `"type":"module"`，全量 ESM。
- 路由速查：`GET /health` · `GET /screenshot` · `POST /run`(任务单化,立返taskId) · `POST /run-project`(同) · `GET /task-status/:taskId` · `GET /task-list` · `POST /task-stop` · `GET /version(含fingerprint)` · `GET /pid` · `GET /templates(模板清单,纯本地)` · `POST /shutdown` · `POST /update-client` · `POST /delete-project` · `POST /upload?name=` · `GET /probe/<rel>` · `GET /pcfile/<name>`(电脑→手机中转文件) · `ws://host`。
- **HTTP 层已迁移到 Hono**：`router.js` 用 Hono 承载全部 HTTP 路由；`ai-api.js` / `phone-http.js` 各自导出 `registerXxxRoutes(app)` 把路由挂到 Hono app。WebSocket 仍由 `phone-ws.js` 经 `ws` 库挂在同一 `http.Server`（Hono 只处理普通 HTTP，`upgrade` 事件由 `ws` 拦截，互不冲突）。新增 HTTP 接口：去 `ai-api.js` / `phone-http.js` 加 `app.get/post(...)` 即可，`router.js` 不用动。

## 9. 模板下发约定

AI 侧 `POST /run` 传 `path`（如 `tasks/tap-point/tap-point.js`）时，手机端从 `GET /probe/tasks/tap-point/tap-point.js` 实时下载执行——脚本只存 PC 一份、改了立刻生效、无需重启服务。新增模板 = 在 `scripts/tasks/<name>/` 放 `<name>.js` + `TASK.md`，`scan-tasks.js` 自动发现，无需登记。

## 10. 任务单模型（长短任务混合架构）

`/run`、`/run-project` 已从「同步等回执、30 秒超时」改为**异步任务单**：立即返回
`{success:true, taskId, status:"submitted"}`，结果写入任务登记表（`task-registry.js`，
落盘 `scripts/task_records.jsonl`，重启重载最近 200 条）。等待回执的职责移到 PC 工具
（`run-task.js` / `run-project.js` / `pc-to-phone.js` 默认轮询 `GET /task-status/:taskId`
最多 30 秒，输出外壳形状与旧版兼容；长任务 `--wait 0` 立返单号，事后 `--status /
--stop / --list` 查询、终止、认领——跨会话可取）。

- **taskId 链路**：中继生成（`t<月日_时分秒>_<4位随机>`）→ 随 run 指令下发 → 手机端
  客户端在脚本头部**注入引导代码**（定义 `__TASK_ID`、`__reportProgress` 进度函数、
  自动把回执补写 `__taskId`）→ 回执经 ws 以 `task_result`（另有 `task_started` /
  `task_progress` / `task_alive` / `task_stopped`）按号归位。
- **参数文件**：按 taskId 独立写 `scripts-from-computer/data/task-args/<taskId>.json`
  （并发权威源），并在脚本头部注入其路径为 `__TASK_ARGS_PATH`——模板读参唯一权威源，
  无兜底副本。
- **心跳与死亡检测**：手机客户端每 10s 对运行中任务报 `task_alive`；引擎连续 2 个
  周期不在 `engines.all()` 且无回执 → 客户端直接落 `task_result` 失败（捕捉静默崩溃）。
  连接级引擎假死由中继应用层心跳判死兜底（第 6 节第 7 条）；提交后未被接单的任务单
  由提交超时熔断兜底（第 6 节第 8 条）。
- **无主回执兜底**：旧格式 `run_result` 在无在途请求时，归因给最近 60 秒内未终态的
  任务单（覆盖中继重启/客户端热更新交替窗口，结果不丢）。
- **并发**：`/run` 不再占用在途槽位，长任务期间截图/点按/传文件照常；在途槽位
  （`state.pendingRequest`）只剩截图/更新客户端/删工程等同步短操作在用。
