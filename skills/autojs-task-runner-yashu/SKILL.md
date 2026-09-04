---
name: autojs-task-runner-yashu
description: 通过 AutoJS 在 Android 手机上自动执行任务。用户在 AI 软件里描述任务（如"打开手机上的设置"），AI
  规划步骤、生成/选择 AutoJS
  脚本，下发到手机执行并取回结果。激活条件：用户消息须包含以下关键词之一:`运行手机任务`、`执行手机任务`、`手机执行任务`、`AI控制手机`、`手机自动化`、`用AI操控手机`、`autojs任务`、`下发手机任务`。
disable-model-invocation: false
---

# 手机任务执行器（AI → AutoJS）

## 用途

把 PC 端的 AI 视作"大脑"，手机端的 AutoJS 视作"双手"：用户用一句话描述要在手机上做的事，AI 拆解成步骤链，逐步下发到手机执行，**全部做完或失败才向用户汇报一次**。

> **用户侧使用教程**：`<skill_dir>/使用示例.md`——按场景整理的「用户对 AI 说什么」示例集（操控手机/看屏幕/传文件/长任务/沉淀模板与项目/安全边界）。新用户首次使用、或用户问"能做什么/怎么用"时，主动推荐该文档。

典型使用人群：能说话打字但行动不便的用户——语音转文字 → AI → 手机，间接控制手机。

## 省 token 设计（贯穿本技能，必须遵守）

本技能面向长期高频使用者，AI 算力要花钱，**每一轮交互都要省 token**：

1. **只传路径不传代码**：模板脚本存 PC 一份（`scripts/tasks/`），下发时只传 `path` + `args`（几十字节），手机按名从中继下载执行；
2. **极简回执**：模板默认只回 `{ok:1}` / `{ok:0, err:"原因"}`。AI 不得要求脚本回传整棵 UI 树或大段文本；
3. **全自动连跑**：中间步骤不产生用户对话，逐步静默执行，终态一次性汇报；
4. **截图代替读屏**：需要"看"屏幕时用 `GET /screenshot`（二进制直传 PC 落盘，不经过 AI 上下文），AI 再用 Read 读图。禁止让手机回传**整棵** UI 控件树 JSON（即 dump 整屏控件的原始大 JSON）；但允许用 `inspect_control_*` 等模板**结构化地只取回**需要的 `text`/`id`/`desc`，见「第 3 步」回退链第三级。（注：`Read` 读图依赖调用方模型是否多模态——非多模态模型读图会被过滤，属正常现象，按「第 3 步：看屏幕」里的规则处理：先 `present_files` 把图展示给用户，AI 自己读不到就用 `ocr`/`inspect_control_*`/问用户替代，不要武断判定模型能力。）
5. **模板两级读取**：规划时只跑 `node scripts/scan-tasks.js` 拿全部模板的 name+description（不读脚本、不读正文）；选中模板后才 Read 它的 `tasks/<name>/TASK.md` 全文。description 即选择依据，正文即决策契约。
6. **2K 文本预算**：任务回执进入上下文前由 `run-task.js` 硬性把关——超过 2000 字符自动截为「400 字预览 + 全文落盘路径」（`scripts/task-results/<taskId>.txt`，`resultTruncated:true`）；OCR 大屏文字优先用 `{"query":"关键词"}` 过滤在源头减量（见 ocr 模板）。

## 前置条件（手机端四项权限，缺一不可）

手机上必须安装 AutoJS6 应用。AutoJS6官网：https://docs.autojs6.com/#/

1. **无障碍服务**：设置 → 应用 → AutoJs6 → 无障碍 → 开启；
2. **截图权限**：手机端脚本启动时自动申请，弹窗点"立即开始"；
3. **悬浮窗权限**：设置 → 应用 → AutoJs6 → 权限管理 → 悬浮窗 → 允许；
4. **后台运行**：设置 → 应用 → AutoJs6 → 省电策略设为"无限制"，并在自启动管理中允许自启动（否则锁屏/切后台后常驻客户端被系统杀掉，任务中断）。

## 约定

- `<skill_dir>` = 本技能根目录（SKILL.md 所在目录）。
- AI 现场写的一次性脚本，写到 `<skill_dir>/temp/` 目录下。
- AI 端要写 **AutoJS 多文件工程（要部署到手机的项目）**，统一写到 `<skill_dir>/scripts/autojs-project/<工程名>/` 目录（每个工程一个子目录，内部结构参照同目录的 `autojs-min-project-template` 范本）。该目录已预置 `project1/` 空位可直接使用， `scripts/autojs代码参考例子/autojs-projects/ColorWheel`这个是一个autojs的色轮界面的project可以参考。一次性单文件临时脚本仍放 `temp/`（见「现场脚本规范」）。工程编码硬约束（ES5 / var only 等）见「部署真实工程 → 工程代码编写规范」。
- 默认端口 **9421**。改动须同步三处：① `curl localhost:9421/health`；② `autojs-task-phone-client.js` 的 `SERVER_PORT`；③ `run-task.js` 的 `DEFAULT_URL`。
- **Shell 路径约定（硬规则）**：本机下发命令走 **Git Bash（POSIX shell）**，路径分隔符一律用**正斜杠 `/`**（如 `/c/Users/...`）。**严禁在命令里写 Windows 反斜杠 `\`**——POSIX shell 把 `\` 当转义符，会把它悄悄吞掉，导致 `skills\autojs` 变成 `skillsautojs`、路径拼接错、`cd`/命令找不到文件。**推荐先 `cd` 进技能目录（POSIX 正斜杠形式，本环境已验证可用），再用相对路径 `scripts/run-task.js` 调脚本 + 只写模板名，连 `tasks/...` 长路径都不用拼。**
- **MSYS 参数改写陷阱（本环境实测）**：Git Bash 会把**以 `/` 开头的参数**（如 `--target-dir /sdcard/Download`）自动改写成 Windows 路径（实测 `/sdcard/Download` 被改成 `D:/software/Git/Git/sdcard/Download`，手机端拼出非法路径下发失败）。给 `--target-dir`、`delete-folder --path` 这类**手机路径参数**传 `/sdcard` 形态时，命令前必须加 `MSYS_NO_PATHCONV=1`（如 `MSYS_NO_PATHCONV=1 node scripts/pc-to-phone.js a.txt --target-dir /sdcard/Download`）。
- **node 参数路径陷阱（本环境实测）**：把**脚本绝对路径直接作为 node 参数**时，`/c/Users/...` 这种 POSIX 形式会被 Windows 版 node 当成「当前盘根下的相对路径」（如解析成 `d:\c\Users\...`）而找不到文件。正确做法见上：先 `cd` 进技能目录、再 `node scripts/run-task.js ...`；若一定要给 node 传绝对脚本路径，请用带盘符前缀的 `C:/Users/.../run-task.js`，不要写 `/c/Users/.../run-task.js`。

## 手机端目录架构 v3（scripts-from-computer）

手机端 AutoJS 脚本根目录（`files.getSdcardPath()` + `"脚本"` 动态拼接，**全链路禁止硬编码物理路径**）下：

- **用户自己写的脚本**：永远留在根目录，本技能绝不触碰（技能自身也不在根目录留任何文件）；
- **`scripts-from-computer/`**：本技能从 PC 下发的一切产物的隔离区——
  - `client/` 常驻客户端本体（自更新直接落位、可手动启动；客户端启动时「自归位」到这里）；
  - `single/` 模板单脚本 + 临时探针脚本（run-task 下发落位）；
  - `project/<工程名>/` AI 项目工程（deploy-project 部署、run-project 运行、delete-project 清理）；
  - `data/` 配套数据（`task-args/<taskId>.json` 按单参数、`relay-config.json` 中继地址、`beep.wav` 等资源）；
  - `files/` PC 传给手机的一般文件缺省落点（pc-to-phone / send-file-to-phone 不显式指定 `--target-dir` 时）。
- 命名规范：本技能新建的文件夹/文件一律小写中划线（kebab-case），避免大小写歧义导致的找不到文件。

## 脚本清单

- `scripts/autojs-relay-server.js`：PC 端中继服务（HTTP + WebSocket，Node.js ES6），AI 启动。架构细节见 `scripts/relay/ARCHITECTURE.md`。
- `scripts/autojs-task-phone-client.js`：手机端常驻客户端（**严格 ES5，变量一律 var**），用户复制到手机 AutoJs6 运行。保活、断线重连、按名下载脚本执行、回传结果。
- `scripts/run-task.js`：AI 侧桥接脚本——把模板名/脚本文件 + 参数 POST 到中继 `/run`（异步任务单），默认轮询任务单最多 30 秒等回执并打印（外壳形状与旧版兼容）；长任务加 `--wait 0` 立即返回 taskId。四种调用方式与路径硬规则见「第 2 步」；任务单控制：`--status <taskId>`（查状态/进度/结果，跨会话可查）、`--stop <taskId>`（强杀）、`--list [数量]`（列最近任务单）。不带参数运行打印完整用法。
- `scripts/self-test.js`：**一键回归自测**——健康检查、参数/剪贴板往返、截图压缩、delete-path 护栏、工程全生命周期、任务单列表一次跑完，输出 ✅/❌ 汇总与退出码。改中继/客户端/模板后跑它即可自证未改坏（`node scripts/self-test.js`）。
- `scripts/get-lan-ip.js`：取电脑局域网 IP（`node <skill_dir>/scripts/get-lan-ip.js --first`），手机填 IP 时用。详见 `references/获取电脑局域网IP.md`。
- `scripts/pc-to-phone.js`：**把电脑上的任意文件传到手机**（PC→手机 通道一键入口，高频刚需）。
  `node scripts/pc-to-phone.js <本地文件> [--target-dir <手机目录>] [--target-name <手机文件名>] [--keep]`
  用法要点：路径一律以技能目录为基准写**相对路径**；`<本地文件>` 是**数据参数**（要传输的文件），别和 node 脚本路径搞混；`--target-dir` 缺省经 /health 动态推导为 `scripts-from-computer/files/`（显式指定则指哪打哪），`--keep` 保留电脑中转副本（默认回执后清理）。反方向（手机→电脑）用模板 `download-file`。
- `scripts/deploy-project.js`：**把电脑上的 AutoJS 多文件工程（含图片/音频等资源）部署到手机并运行**——复杂工程（多模块 / 带资源，单文件模板装不下）用它而非单文件模板。用法 `node scripts/deploy-project.js <工程目录> [--name <工程名>] [--main <入口.js>] [--run|--no-run] [--args '<json>'] [--keep]`，参数默认值与机制见「部署真实工程（多文件 + 资源）」一节。
- `scripts/run-project.js`：**运行已部署到手机的工程（不重新下发文件）**。换参数反复跑已部署工程时用。用法 `node scripts/run-project.js <工程名> [--main <入口.js>] [--args '<json>'] [--wait 秒]`（与 run-task.js 同一套任务单模型：默认等 30 秒回执，`--wait 0` 立返 taskId）。
- `scripts/update-phone-client.js`：**PC 一键更新并重启手机端常驻客户端（免手动）**。手机端代码改动后跑它即完成「下发新版直接落到 `scripts-from-computer/client/`（覆盖）+ 触发自重启」。用法 `node scripts/update-phone-client.js`（默认用技能自带客户端），或 `--path <其他位置的客户端.js>`（数据参数，非脚本路径）。机制见「自动更新手机客户端」一节。
- `scripts/delete-project.js`：**删除手机上已部署的工程（清理用）**。`node scripts/delete-project.js demo`（删 `scripts-from-computer/project/demo`）或 `--path <任意 sdcard 存储内路径>`。手机端带安全护栏：传入路径先规范化（解析符号链接与 `..`），只放行 sdcard 存储内路径。
- `scripts/tasks/<name>/`：**任务模板库**，每个任务一个文件夹，内含 `<name>.js`（脚本）与 `TASK.md`（说明书）。AI 规划时先跑 `scripts/scan-tasks.js` 扫描全部模板的 name+description 挑模板（成功任务的历史实测耗时会自动附为描述末尾的 `[平均 X 秒]`——截尾平均：去掉 1/3 最大与 1/3 最小后取均值，剔除冷启动/弹窗干扰离群值；滚动保留最近 10 次），选中后才 Read 对应 `tasks/<name>/TASK.md` 全文。开发者新建/扩展模板见 `references/AI_新建模板手册.md`（AI 建模板总手册：决策流程 + 分类骨架 + 自检清单，照抄即可扩展）。
- `scripts/scan-tasks.js`：扫描任务模板库，只提取每个 `TASK.md` 前言的 name+description。**`node scripts/scan-tasks.js` 输出 JSON**（给 AI 规划用，最省 token）；**`node scripts/scan-tasks.js --human` 输出「共 N 个 + 可读清单」**（给用户朗读用）。中继 `GET /templates` 也复用同一份扫描逻辑。

## 参考文档（references）

`<skill_dir>/references/` 下是手机端 AutoJs6 API 与建模板的权威参考，按需查阅（写/改脚本前翻对应文档，少踩坑）：

- `references/autojs6_device_docs.md` — **设备(Device)模块**：`device.width`/`device.height` 取分辨率、`getBattery()` 电量、`getMusicVolume()` 音量、亮度、`vibrate()` 振动等。要拿屏幕宽高或设备信息就查它。
- `references/AutoJs6_Engines_引擎文档.md` — **UiSelector / 控件定位 API**：`text()`/`id()`/`bounds()`/`desc()` 选择器与 `engines` 引擎管理。写 `inspect_control_*`/`tap-text` 等控件类脚本必查。
- `references/autojs6_images_doc.md` — **images 图片模块**：`captureScreen()` 截图、`images.clip()` 裁剪、`images.toBytes()` 转字节。写 `screenshot`/`crop-screenshot` 必查。
- `references/AutoJS6-OCR文档.md` — **OCR 文字识别**：屏幕文字提取的参数与用法。写 `ocr` 模板必查。
- `references/autojs6_http_doc.md` — **http 网络请求模块**：发 HTTP 请求的用法（手机端回传数据时底层用得到）。
- `references/AutoJS6_Files_Doc.md` — **files 文件读写模块**：`files.read()`/`files.write()` 等，模板读任务单注入的 `__TASK_ARGS_PATH` 参数文件即依赖它。
- `references/现场脚本规范.md` — **现场脚本规范**（原正文三大段之一，按需读）：temp/ 一次性脚本约定、标准回执骨架、建文件 vs 建目录高频坑。
- `references/部署真实工程.md` — **部署真实工程**：多文件工程结构、deploy/run/delete-project 全流程与硬约束。
- `references/自动更新手机客户端.md` — **自动更新手机客户端**：update-phone-client 自举机制与假死排障。
- `references/截图权限与弹框处理.md` — **截图权限与"立即开始"弹框**：凡 `captureScreen()`/`ocr()` 的脚本，必须内置「后台点立即开始 + requestScreenCapture + sleep」前置代码，照此文档加。
- `references/获取电脑局域网IP.md` — **取电脑局域网 IP**：手机连 PC 中继时填的 IP 怎么拿（脚本已自动排除虚拟网卡 / Clash fake-ip）。
- `references/手机端常驻客户端说明.md` — **手机端常驻客户端与连接状态悬浮球**：客户端职责与指令清单、悬浮球三色（红=未连接/绿=已连接/蓝=任务执行中）、呼吸/拖动/吸附行为、可调常量，及「截图中悬浮球恒为蓝色属正常」的排障说明。改客户端代码或调悬浮球时查阅。
- `references/手机连接排障.md` — **手机未连接五步排障**：取 IP、改 SERVER_IP、手机跑客户端、权限/WiFi 检查、连接确认（「手机未连接时的处理」完整版）。
- `references/AI_新建模板手册.md` — **AI 新建/扩展模板总手册**：决策流程 + 分类骨架 + 核心规范 + 自检清单，照抄即可扩展新模板（详见「现场脚本规范」节引用）。
- `references/AI_AutoJS编码强制规范.md` — **写任何手机端 JS 脚本前必读**：严格 ES5(var only)、UI 线程禁止 sleep/耗时、耗时 API 必须 `threads.start` 多线程、颜色字面量 int 溢出等底层硬约束 + 编码前自检清单。本技能最高频的"静默崩溃/卡死/超时"都源于违反它，**写/改 JS 前先读**。
- `references/引擎_self_识别与isSelf判定.md` — **判断"某引擎是不是自己"(isSelf / 自保护)**：为什么不能用 `eng === myEngine`、正确的**单 id 要素**判定法（已废弃旧的 id+文件名双要素）、防御式写法与临时名陷阱，附 `id`/`source`/`cwd` 三字段真机实测取证表。凡写 `list-running-scripts` / `stop-script-by-id` / 任何要标 self 或自保护的模板必查。
- `scripts/autojs代码参考例子/` — **AutoJS JS 代码例子库**：一批可直接参考的 .js 示例。以后写/改手机端 JS 脚本遇到 API 用法或写法问题，去 scripts/autojs代码参考例子/ 下按分类翻

## 执行 SOP（AI 必须按此顺序）

安装依赖是前提

```bash
cd scripts && npm install
```

### 第 0 步：健康检查

```bash
curl -s http://localhost:9421/health 2>/dev/null | grep -q '"status":"ok"'
```

- 命令失败/无响应 → 中继没启动：`node <skill_dir>/scripts/autojs-relay-server.js` 启动，等约 1 秒再跑 health 确认（**已在跑就绝不重启**——重复启动会触发端口清理、踢掉已连手机；脚本自带指纹自保护兜底）。
- `{"phone":"connected"}` → 进入第 1 步。
- `{"phone":"disconnected"}` → 走「手机未连接时的处理」。

### 第 1 步：拆解任务（两级读取，省 token）

把用户的一句话拆成步骤链。**先跑 `node <skill_dir>/scripts/scan-tasks.js`** 拿全部模板的 `name`+`description` 挑模板（两级读取原则见「省 token 设计」#5）；**选中某模板后，才 Read 它的 `tasks/<name>/TASK.md` 全文**，理解场景/坑/兜底，必要时按「临时副本优先」改脚本再下发。模板覆盖不了的步骤才现场写脚本（写入 `<skill_dir>/temp/`，遵守「现场脚本规范」）。

### 第 2 步：逐步下发（模板优先）

`run-task.js` 已 cwd 无关，**推荐用模板名直接调用，无需拼 `tasks/...` 长路径**（模板名自动解析成 `tasks/<name>/<name>.js` 下发手机按名下载）：

```bash
# 推荐：先 cd 到技能目录（<skill_dir> = 本技能根目录，即 autojs-task-runner-yashu/；用相对路径，别写死你电脑的绝对路径），再用相对路径调脚本 + 模板名
cd <skill_dir> && \
  node scripts/run-task.js open-app --args '{"name":"MT管理器"}'
# 等价写法：node scripts/run-task.js --path tasks/open-app/open-app.js --args '{"name":"MT管理器"}'
# 等价写法：node scripts/run-task.js --name open-app --args '{"name":"MT管理器"}'
```

> \*\*路径硬规则（必须记牢，本技能最易踩的坑）\*\*：分隔符一律正斜杠 `/` 禁反斜杠 `\`；node 参数禁用 `/c/...` 形式绝对路径；任务参数只写模板名不手拼 `tasks/...`——三条的唯一权威说明见上方「约定」节。

- 响应 `{"success":true,"taskId":"...","status":"success","result":"{\"ok\":1}"}` → 该步成功，继续下一步（result 是 JSON 字符串，需再解析一次；taskId 是任务单号，报错排障时引用它）。**注意 `status` 字段是任务单生命周期状态**（submitted/running/success/failed/stopped）：`success` 只代表「任务单正常跑完并拿到回执」，**业务成败要看 `result` 里的 `ok`**——如启动期失败（脚本 404）时 `status` 仍为 `success` 而 `result.ok=0`、`result.phase="client"`；中继侧提交超时熔断则 `result.phase="relay"`；
- `{"ok":0,"err":"..."}` → 立即换策略重试一次（如 tap-text 找不到就截图看屏幕），仍失败则终止并向用户汇报卡在哪一步；
- **长/短任务判断（经验法则）**：① 单一原子操作（点击/滑动/按键/截屏/开 App 等，耗时恒定且 <30 秒）→ 短，走默认同步等待；② 耗时随规模变化（批量 N 个文件/App）或不可预估（录课/等界面条件/大文件传输）→ 长；③ 拿不准 → 走默认（超时非失败，taskId 接管）；④ 模板描述末尾的 `[平均 X 秒]` 是历史实测耗时（截尾平均，成功任务自动记录），直接据此判断；
- **长任务提交（判定为长后）**：加 `--wait 0` 立即返回 taskId，不阻塞对话：
  - `node scripts/run-task.js --status <taskId>` 查状态/进度/心跳（模板里用注入的 `__reportProgress("3/10 下载中")` 上报进度，长任务模板骨架见 `tasks/long-task-demo/`）；
  - 卡死可 `node scripts/run-task.js --stop <taskId>` 强杀；`--list` 列最近任务单——结果落盘中继电脑，**会话结束也能事后按单号取回**；
  - 等待期手机可照常并发其他操作（截屏/点按/传文件）。
- 界面跳转类步骤后，插一步 `wait`（500~1500ms）再操作下一步。
- **短任务默认等待 30 秒后输出 `{"success":false,"timeout":true,...}`** → 注意这不是失败：任务仍在手机上运行，可用 `--status` 继续查询（提交后 60 秒仍未被手机接单的，中继会熔断为 failed，`err` 含「提交超时熔断」、`result.phase="relay"`，任务单不会永久悬挂）。若任务落为 failed 且 err 是「引擎已退出但未收到回执」→ 脚本静默崩溃，第一嫌疑是**回执没走 `autojs_result` 广播**（单纯 `console.log` 不会回传）——机制、标准回执骨架与「建好即广播」规则见 `references/现场脚本规范.md`，这是最高频的想当然错误，排障时**优先排除它**。
- **回执超限处置（`resultTruncated:true`）**：此时回执只有 400 字预览 + 全文落盘路径（`resultFile`），**严禁把落盘全文整段读进上下文**——用 grep / 按行 offset 只取所需片段。智能分流：① 意图明确的中间步骤（如"找某按钮坐标"）→ 直接对落盘文件 grep 提取片段继续任务，终态汇报里说明「结果超限已按需提取，全文在 <路径>」；② 意图不明、或全文本身就是交付物 → **反向提问**用户选择：看摘要即可 / 把全文文件交给用户 / 换关键词过滤重取 / 改用局部手段（crop 区域截屏、区域 OCR）重做。

### 第 3 步：看屏幕（需要时）

```bash
curl -s http://localhost:9421/screenshot
```

返回 `{"success":true,"path":"<PC本地路径>"}`，用 Read 读该 PNG 判断界面状态，再决定下一步。截图不经过 AI 上下文，只有读图才消耗 token，按需使用。

- **只看局部区域**：若已知道某控件的包围盒（如经 `inspect_control_by_*` 探测出的 bounds），用 `crop-screenshot` 模板按 `left/top/right/bottom` 四元组裁剪该区域并回传电脑 PNG（看"某个控件长什么样"最省，比整屏再肉眼找块强）。调用见其 `TASK.md`。
- **截图角落的彩色圆点不是故障**：手机屏幕右缘的圆形发光点是「连接状态悬浮球」（红=未连接、绿=已连接、蓝=任务执行中）。截屏本身就是一次任务（客户端先变蓝再抓屏），故**经中继拍的每张截图里它必然是蓝色**，属正常现象，勿据此误判连接或任务状态。细节见 `references/手机端常驻客户端说明.md`。

> **截图结果是否必须展示给用户 —— 分两种情况（关键区分）**：
>
> - **情况 A · 用户明确要求截图 / 截图，或截图本身就是交付物**：`/screenshot` 与 `crop-screenshot` 回传的是 **PC 本地 PNG 的绝对路径**（形如 `{"success":true,"path":"..."}`）。这是**硬规则，不可省略**——AI **不能只把回执丢给用户就结束**，必须：① 用 `present_files` 把 PNG 作为结果文件呈现（生成预览/卡片），让用户直接看到那张图；② 哪怕预览打不开，也必须在回复正文里附上图片的绝对路径，保证用户能自行打开查看。
> - **情况 B · 截图仅用于 AI 内部校验**（例如"打开抖音后截图确认是否真的打开了"）：此时截图**不需要推给用户**。AI 自行 `Read` / `ocr` 判断界面状态后，只在终态汇报里给出**校验结论**（如"已帮您打开抖音" / "没打开，卡在 XX"）即可。这种情况不展示图**不算违反硬规则**——用户要的是结果，不是那张中间截图。
>   判断原则：截图是"给用户看的"还是"给自己校验的"？**前者必须展示，后者只报结论。** 展示与 AI 自行 Read 判断下一步不冲突，两者可同时做。
>
> **关于「AI 能否读图」——按实际情况测试，勿武断判定**：调用方使用的 AI 模型能力参差不齐——有的多模态可直读图片/视频，有的仅支持文字、读图会被过滤（表现为 `Content filtered` 或读不到内容）。据此：
>
> - **情况 A「把图展示给用户」是硬规则，与 AI 能力无关**：用户恒能看图，故无论 AI 自己能否读图，都必须 `present_files` + 附绝对路径；
> - **「AI 读图判断下一步」是尽力而为**（仅影响情况 B 的校验方式）：AI 若不确定自己能否读图，先 `Read` 实测一次——能识别就据此决策，被过滤则改用 `ocr` 取文字 / `inspect_control_*` 取控件 / 或直接问用户，**不要仅凭一次报错或主观假设就断言「模型支持/不支持」**；
> - 以实测为准：本技能不预设 AI 必须能读图，也不假设它不能。

> **落地文件硬规则（文本 / 数据类交付物，与截图同级，不可省略）**：
> 凡是任务执行在 PC 上**生成了文件**（脚本回执里的 `file` 字段、或 AI 自己 Write 的导出文件），AI 在终态汇报里**必须**把该文件的**绝对路径完整写出来**（带盘符，形如 `D:/xxx/yyy.txt`，正斜杠或反斜杠均可，但必须完整、可直接定位），**不得只写文件名（如 `user_apps_xxx.txt`）或只给相对路径**。同时仍用 `present_files` 把文件作为结果呈现（打开预览/卡片）。
> 理由：技能产物常落在 `.workbuddy/` 等隐藏目录，用户只有完整绝对路径才能复制到资源管理器地址栏找到文件；只给文件名他无从定位。
> 适用：所有"把结果写盘"的模板（如 `get-all-apps` 落地用户 App 名单）、截图文件、AI 自行落盘的导出文件等。回执里若带 `file` 字段，直接把该值原样抄给用户即可。

### 识别屏幕内容的三个优先级（回退链）

"看屏幕"的本质是**把屏幕上的文字/状态读出来交给 AI 判断下一步**。优先级按**省 token + 可靠性**排序——**先用最省钱、最稳定的方法，只有在前一层不满足时才回退到更贵的方案**，不要跳级、不要卡死在某一级：

1. **第一级 · 控件树提取文字（最优先）**：用 `inspect_control_by_*` 模板遍历 UI 控件树，取回所有控件的 `text`/`id`/`desc`。
   - 适用：要判断"界面是否真的变化了、变了哪个控件"，或需要结构化控件语义时；
   - 特点：比 OCR 更准（控件自带语义），且不需要大模型读图，**最省 token**；返回数据更大时按需过滤即可；
   - 回退条件：若控件树**不完整 / 取不到目标控件 / 不能满足判断需求**，或者APP屏蔽了无障碍， 无法获取控件信息， 则回退第二级。
2. **第二级 · OCR 取文字**：调用 `ocr` 模板识别屏幕文字（纯文本数组，通常也很省 token）。
   - 适用：模型不必读图、但只需"屏幕有哪些文字"就能判断时；
   - **文字多的屏（设置页/列表页）优先带 `{"query":"关键词"}` 过滤**，只取命中项；`detail:true` 仅在确需逐项坐标/置信度时用——两者都是防大回执撑爆上下文；
   - 回退条件：若 OCR 结果**不足以判断界面是否真的变化了**（如界面是纯图形、无明显文字），或**不足以满足用户需求**（用户要的是结构/控件而非文字），→ 回退第三级。
3. **第三级 · 截屏 + 模型直读（最低优先级）**：用 `GET /screenshot` 或 `crop-screenshot` 截屏回 PC，让模型直接读图识别内容。
   - 适用：前两级都不满足、且调用方模型**支持多模态**（能读图片/视频）时，才用这一层；
   - 特点：信息最全、最省心，但**最贵、最耗 token**，因此放到最后，不做默认方案；
   - 回退条件：若模型**不支持多模态**（读图被过滤 / `Content filtered` / 读不到内容），本级别不可用，且前两级也都失败时，直接问用户，不要硬猜。

**回退操作原则**：

- 从第一级往下逐级实测：**控件树能否满足？OCR 能否满足？** 只有在前两级都不行时，再用截图 + 模型直读；
- 用于**内部校验**的截图 / OCR / 控件结果（情况 B），只需在终态汇报里给出结论（如"已打开抖音"），不强制把图推给用户；**仅当用户明确要求看、或截图即交付物（情况 A）时**，才须遵守「展示给用户」硬规则（`present_files` + 附绝对路径）。OCR 与控件结果同理：内部校验用只汇报结论，用户要看才展示。
- 第三级都拿不到可用信息时，直接问用户，不要硬猜。

### 第 4 步：终态一次性汇报

全部步骤完成 → 一句话汇报结果（如"已帮您打开设置并连上 WiFi"）；失败 → 汇报卡在第几步、原因、建议用户怎么手动补救。**中间过程不打扰用户。**

## 用户问答：查询模板清单（不执行任务）

当用户问"现在有多少个手机任务模板"/"有哪些模板"/"列出所有手机任务"等**纯查询**问题时，**不要走执行 SOP**，直接跑扫描器并朗读结果（无需手机在线、不消耗手机任务 token）：

```bash
node <skill_dir>/scripts/scan-tasks.js --human
```

输出形如：

```
共 8 个手机任务模板：
· tap-point — 按屏幕坐标 (x,y) 点按
· tap-text — 点按含指定文字的控件
...
```

把这段清单直接念给用户即可。若要让外部程序/中继取数，也可 `curl -s http://localhost:9421/templates` 取 JSON `{count, tasks}`，但用户问答场景下优先用 `--human` 命令行，结果更友好。

注意：这是"只读查询"——不要为此启动任务、不要下发任何脚本、不要要求手机在线。

## 现场脚本规范（一次性脚本 · 模板覆盖不了时）

AI 现场写的一次性脚本写到 `<skill_dir>/temp/`（下发时 PC 读取内容「内联直发」，位置无关；落手机后统一进 `scripts-from-computer/single/`），用 `node scripts/run-task.js <文件> --args '{...}'` 下发。**写之前必须先读 `references/现场脚本规范.md`**（严格 ES5/var only、UI 线程禁耗时、耗时 API 进 threads.start、标准回执骨架、建文件 vs 建目录的高频坑——最高频的「静默崩溃/收不到回执」都源于违反它）。新建可复用模板则读 `references/AI_新建模板手册.md`。

## 部署真实工程（多文件 + 资源）

复杂任务（多模块 / 带图片音频资源）用 **deploy-project** 部署整个工程目录到手机 `scripts-from-computer/project/<名>/` 并自动运行入口；PC 工程统一放 `<skill_dir>/scripts/autojs-project/<工程名>/`。硬约束：严格 ES5/var only（require 遇 ES6 整个入口静默崩）、入口必须标准回执收尾、模块相对 require。**完整结构与用法见 `references/部署真实工程.md`**。

## 自动更新手机客户端（PC 一键，免手动）

手机端代码（`autojs-task-phone-client.js`）改动后，PC 跑 `node scripts/update-phone-client.js` 一键完成「新版直接下发到 `scripts-from-computer/client/` + 触发自重启」，无需手动。**机制与假死排障见 `references/自动更新手机客户端.md`**。


## 手机未连接时的处理（AI 必须主动）

触发条件：第 0 步 health 返回 `{"phone":"disconnected"}` 或中继没起。**绝不能只甩一句"请连接手机"**——按 `references/手机连接排障.md` 的五步流程主动带着用户连：① AI 自己跑 `get-lan-ip.js` 取局域网 IP → ② 指导用户改客户端 `var SERVER_IP` → ③ 手机 AutoJs6 运行 `autojs-task-phone-client.js` → ④ 同一 WiFi + 四项权限（无障碍/悬浮窗/后台/截图）→ ⑤ 用户回报"连上了"后 health 复查。完整步骤与给用户的话术见该文档；注：中继重启/网络闪断会自愈重连，只有客户端引擎死亡才需要走此流程。

## 安全边界（红线）

- 支付、转账、删除、授权类不可逆操作：即使是全自动模式，执行该步前也要先向用户确认一次；
- **一次一个 UI 任务**：run 类任务单虽支持并发（回执按 taskId 归位互不串线），但手机屏幕同一时刻只能做一件事，UI 自动化任务仍要逐步串行下发、切勿并发；截屏/更新客户端/删工程等同步短操作在中继侧仍互斥（并发会返回 429）。

## 注意事项

- **熄屏/锁屏症状识别（高频误判点）**：截图回传**全黑帧** + 剪贴板读写**返回空** + OCR 内容异常，而 `open-app` 等"假成功"（`am start` 不需亮屏）——十有八九是手机熄屏/自动锁屏了，请用户点亮解锁后重试，勿往脚本 bug 方向排查。
- **手机端脚本严格 ES5 / var only**：AutoJs6 Rhino 引擎对 ES6 支持不全，这是硬性约束。
- **现场脚本不要 setInterval 保活**：经 /run 下发的脚本由中继托管，正常 exit 即可；只有常驻客户端需要 setInterval 保活。
- **性能**：涉及 UI 树查找的步骤（tap-text 等）在界面层级深时会慢一些，属正常，等回执即可。
- **截图类脚本必须内置权限前置代码**：凡调用 `captureScreen()` / `ocr(...)` 的手机端脚本，最前面必须有「后台线程用 `textMatch` 正则多候选自动点掉授权弹框（按钮文案因 ROM 而异：小米『立即开始』、部分机型『开始截图』等）+ `requestScreenCapture()` + `sleep(500)`」这段代码，否则截图失败或脚本卡死（表现为"回执为空"）。模板 `screenshot` / `crop-screenshot` / `ocr` / `tap-text` / `unfollow-official-accounts` 已内置，新建截图模板照 `references/截图权限与弹框处理.md` 加。
