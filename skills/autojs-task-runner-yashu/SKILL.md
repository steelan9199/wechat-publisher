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

典型使用人群：能说话打字但行动不便的用户——语音转文字 → AI → 手机，间接控制手机。

## 省 token 设计（贯穿本技能，必须遵守）

本技能面向长期高频使用者，AI 算力要花钱，**每一轮交互都要省 token**：

1. **只传路径不传代码**：模板脚本存 PC 一份（`scripts/tasks/`），下发时只传 `path` + `args`（几十字节），手机按名从中继下载执行；
2. **极简回执**：模板默认只回 `{ok:1}` / `{ok:0, err:"原因"}`。AI 不得要求脚本回传整棵 UI 树或大段文本；
3. **全自动连跑**：中间步骤不产生用户对话，逐步静默执行，终态一次性汇报；
4. **截图代替读屏**：需要"看"屏幕时用 `GET /screenshot`（二进制直传 PC 落盘，不经过 AI 上下文），AI 再用 Read 读图。禁止让手机回传**整棵** UI 控件树 JSON（即 dump 整屏控件的原始大 JSON）；但允许用 `inspect_control_*` 等模板**结构化地只取回**需要的 `text`/`id`/`desc`，见「第 3 步」回退链第三级。（注：`Read` 读图依赖调用方模型是否多模态——非多模态模型读图会被过滤，属正常现象，按「第 3 步：看屏幕」里的规则处理：先 `present_files` 把图展示给用户，AI 自己读不到就用 `ocr`/`inspect_control_*`/问用户替代，不要武断判定模型能力。）
5. **模板两级读取**：规划时只跑 `node scripts/scan_tasks.js` 拿全部模板的 name+description（不读脚本、不读正文）；选中模板后才 Read 它的 `tasks/<name>/TASK.md` 全文。description 即选择依据，正文即决策契约。

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
- 默认端口 **9421**。改动须同步三处：① `curl localhost:9421/health`；② `autojs-task-phone-client.js` 的 `SERVER_PORT`；③ `run_task.js` 的 `DEFAULT_URL`。
- **Shell 路径约定（硬规则）**：本机下发命令走 **Git Bash（POSIX shell）**，路径分隔符一律用**正斜杠 `/`**（如 `/c/Users/...`）。**严禁在命令里写 Windows 反斜杠 `\`**——POSIX shell 把 `\` 当转义符，会把它悄悄吞掉，导致 `skills\autojs` 变成 `skillsautojs`、路径拼接错、`cd`/命令找不到文件。**推荐先 `cd` 进技能目录（POSIX 正斜杠形式，本环境已验证可用），再用相对路径 `scripts/run_task.js` 调脚本 + 只写模板名，连 `tasks/...` 长路径都不用拼。**
- **node 参数路径陷阱（本环境实测）**：把**脚本绝对路径直接作为 node 参数**时，`/c/Users/...` 这种 POSIX 形式会被 Windows 版 node 当成「当前盘根下的相对路径」（如解析成 `d:\c\Users\...`）而找不到文件。正确做法见上：先 `cd` 进技能目录、再 `node scripts/run_task.js ...`；若一定要给 node 传绝对脚本路径，请用带盘符前缀的 `C:/Users/.../run_task.js`，不要写 `/c/Users/.../run_task.js`。

## 脚本清单

- `scripts/autojs-relay-server.js`：PC 端中继服务（HTTP + WebSocket，Node.js ES6），AI 启动。架构细节见 `scripts/relay/ARCHITECTURE.md`。
- `scripts/autojs-task-phone-client.js`：手机端常驻客户端（**严格 ES5，变量一律 var**），用户复制到手机 AutoJs6 运行。保活、断线重连、按名下载脚本执行、回传结果。
- `scripts/run_task.js`：AI 侧桥接脚本——把模板名/脚本文件 + 参数 POST 到中继 `/run`，打印回执 JSON。不做任务逻辑、不与用户交互。支持 `node run_task.js <模板名> --args '{...}'` 直接用模板名调用（脚本通过自身位置自动解析为 `tasks/<name>/<name>.js` 下发给手机按名下载，**无需手写 `tasks/...` 路径**）；也兼容 `--path <相对路径>`、`--name <模板名>` 与直接传本地脚本文件（本地文件读取会依次尝试 cwd / 技能根 / scripts/ 兜底）。调用约定见「第 2 步」路径硬规则。
  **参数说明（JSDoc 式）**：`<模板名>` = 任务模板目录名（对应 `scripts/tasks/<name>/`，脚本自动解析为 `tasks/<name>/<name>.js` 下发，无需手拼路径）；`--args` = 传给手机端脚本的 JSON 参数字符串（如 `'{"name":"MT管理器"}'`）；`--path` = 本地脚本文件相对路径（不用模板名、直接指定脚本文件时用）；`--name` = 同第一个位置参数的模板名。
- `scripts/get-lan-ip.js`：取电脑局域网 IP（`node <skill_dir>/scripts/get-lan-ip.js --first`），手机填 IP 时用。详见 `references/获取电脑局域网IP.md`。
- `scripts/pc_to_phone.js`：**把电脑上的任意文件传到手机**（PC→手机 通道一键入口，高频刚需）。
  用法（路径一律以本技能目录 `autojs-task-runner-yashu/` 为基准写**相对路径**，不要写死你电脑的绝对路径，否则换台机器 / 换安装位置就跑不通）：
  `node scripts/pc_to_phone.js <本地文件> [--target-dir <手机目录>] [--target-name <手机文件名>] [--keep]`
  - `<本地文件>`（**必填，数据参数**）：要传到手机的本地文件路径。注意这是**传给脚本的数据参数（要传输的那个文件）**，与"node 运行的脚本路径"是两回事——node 脚本本身请用 `scripts/pc_to_phone.js` 这种相对写法（见「约定」路径硬规则），不要把它和 node 脚本路径搞混。
  - `--target-dir`（选填）：手机落盘目录，默认 `/sdcard/Download`。
  - `--target-name`（选填）：手机端保存的文件名，默认沿用本地文件名。
  - `--keep`（选填）：保留电脑中转目录里的副本，默认回执后自动清理。
    内部流程：复制进电脑中转目录 → 健康检查 → 下发模板 `send_file_to_phone` → 手机经中继 `GET /pcfile/<name>` 拉字节落盘 → 回执 `{ok:1, phonePath, size}`。已实测 3.3MB 二进制 MD5 逐字节一致、支持中文文件名。**反方向**（手机→电脑）用模板 `download_file`。
- `scripts/deploy_project.js`：**把电脑上的 AutoJS 多文件工程（含图片/音频等资源）部署到手机并运行**——复杂工程（多模块 / 带资源，单文件模板装不下）用它而非单文件模板。PC 开发态统一为 `main.js + modules/ + assets/...`（可带官方 `project.json` 的 `main`/`ignore`），本脚本递归遍历、逐文件经 PC→手机 通道**按相对结构**落盘到手机 `/sdcard/脚本/<name>/`（二进制资源原样下发、按相对路径直接读取），部署后默认触发 `/run-project` 运行入口。用法 `node scripts/deploy_project.js <工程目录> [--name <工程名>] [--main <入口.js>] [--run|--no-run] [--args '<json>'] [--keep]`。
  **参数说明**：`<工程目录>` = PC 工程目录（相对技能根，如 `scripts/autojs-project/<工程名>`）；`--name` = 部署到手机后的工程名（默认取目录名）；`--main` = 入口 js（默认 `main.js`）；`--run`/`--no-run` = 部署后是否立即运行（默认运行）；`--args` = 传给工程的 JSON 参数；`--keep` = 保留中转文件。详见「部署真实工程（多文件 + 资源）」。
- `scripts/run_project.js`：**运行已部署到手机的工程（不重新下发文件）**。换参数反复跑已部署工程时用。用法 `node scripts/run_project.js <工程名> [--main <入口.js>] [--args '<json>']`。
  **参数说明**：`<工程名>` = 已部署到手机的工程名（对应手机 `/sdcard/脚本/<工程名>`）；`--main` = 入口 js（默认 `main.js`）；`--args` = JSON 参数。
- `scripts/update_phone_client.js`：**PC 一键更新并重启手机端常驻客户端（免手动）**。手机端代码改动后，跑它即可把新版 `autojs-task-phone-client.js` 下发到手机 `/sdcard/脚本/`（覆盖）并触发手机端自重启，无需到手机上手点运行。用法 `node scripts/update_phone_client.js`（默认用同目录自带客户端），或 `node scripts/update_phone_client.js --path <其他位置的客户端文件>`。
  **参数说明**：`<其他位置的客户端文件>`（即 `--path` 的值）是**数据参数**（要下发的客户端 js 文件路径，相对或技能根相对均可），不是 node 运行的脚本路径；不传则默认用技能自带 `scripts/autojs-task-phone-client.js`。机制见「自动更新手机客户端（PC 一键，免手动）」。
- `scripts/delete_project.js`：**删除手机上已部署的工程（清理用）**。默认删 `/sdcard/脚本/<工程名>`；用 `--path <任意 /sdcard/ 下路径>` 可删旧路径部署（如早期落在 `/sdcard/autojs/projects/<name>` 的那份）。手机端带 `/sdcard/` 安全护栏，不会误删系统目录。用法 `node scripts/delete_project.js demo` 或 `node scripts/delete_project.js --path /sdcard/autojs/projects/demo`。
  **参数说明**：`<工程名>` = 手机 `/sdcard/脚本/<工程名>` 工程名（默认删这个路径）；`--path` = 任意 `/sdcard/` 下绝对路径（用于清理旧路径部署，如早期落在 `/sdcard/autojs/projects/<name>` 的那份）。
- `scripts/tasks/<name>/`：**任务模板库**，每个任务一个文件夹，内含 `<name>.js`（脚本）与 `TASK.md`（说明书）。AI 规划时先跑 `scripts/scan_tasks.js` 扫描全部模板的 name+description 挑模板，选中后才 Read 对应 `tasks/<name>/TASK.md` 全文。开发者新建/扩展模板见 `references/AI_新建模板手册.md`（AI 建模板总手册：决策流程 + 分类骨架 + 自检清单，照抄即可扩展）。
- `scripts/scan_tasks.js`：扫描任务模板库，只提取每个 `TASK.md` 前言的 name+description。**`node scripts/scan_tasks.js` 输出 JSON**（给 AI 规划用，最省 token）；**`node scripts/scan_tasks.js --human` 输出「共 N 个 + 可读清单」**（给用户朗读用）。中继 `GET /templates` 也复用同一份扫描逻辑。

## 参考文档（references）

`<skill_dir>/references/` 下是手机端 AutoJs6 API 与建模板的权威参考，按需查阅（写/改脚本前翻对应文档，少踩坑）：

- `references/autojs6_device_docs.md` — **设备(Device)模块**：`device.width`/`device.height` 取分辨率、`getBattery()` 电量、`getMusicVolume()` 音量、亮度、`vibrate()` 振动等。要拿屏幕宽高或设备信息就查它。
- `references/AutoJs6_Engines_引擎文档.md` — **UiSelector / 控件定位 API**：`text()`/`id()`/`bounds()`/`desc()` 选择器与 `engines` 引擎管理。写 `inspect_control_*`/`tap_text` 等控件类脚本必查。
- `references/autojs6_images_doc.md` — **images 图片模块**：`captureScreen()` 截图、`images.clip()` 裁剪、`images.toBytes()` 转字节。写 `screenshot`/`crop_screenshot` 必查。
- `references/AutoJS6-OCR文档.md` — **OCR 文字识别**：屏幕文字提取的参数与用法。写 `ocr` 模板必查。
- `references/autojs6_http_doc.md` — **http 网络请求模块**：发 HTTP 请求的用法（手机端回传数据时底层用得到）。
- `references/AutoJS6_Files_Doc.md` — **files 文件读写模块**：`files.read()`/`files.write()` 等，模板读 `/sdcard/脚本/task_args.json` 即依赖它。
- `references/截图权限与弹框处理.md` — **截图权限与"立即开始"弹框**：凡 `captureScreen()`/`ocr()` 的脚本，必须内置「后台点立即开始 + requestScreenCapture + sleep」前置代码，照此文档加。
- `references/获取电脑局域网IP.md` — **取电脑局域网 IP**：手机连 PC 中继时填的 IP 怎么拿（脚本已自动排除虚拟网卡 / Clash fake-ip）。
- `references/AI_新建模板手册.md` — **AI 新建/扩展模板总手册**：决策流程 + 分类骨架 + 核心规范 + 自检清单，照抄即可扩展新模板（详见「现场脚本规范」节引用）。
- `references/AI_AutoJS编码强制规范.md` — **写任何手机端 JS 脚本前必读**：严格 ES5(var only)、UI 线程禁止 sleep/耗时、耗时 API 必须 `threads.start` 多线程、颜色字面量 int 溢出等底层硬约束 + 编码前自检清单。本技能最高频的"静默崩溃/卡死/超时"都源于违反它，**写/改 JS 前先读**。
- `references/引擎_self_识别与isSelf判定.md` — **判断"某引擎是不是自己"(isSelf / 自保护)**：为什么不能用 `eng === myEngine`、正确双要素(id+文件名)判定法、防御式写法与临时名陷阱。凡写 `list_running_scripts` / `stop_script_by_name` / 任何要标 self 或自保护的模板必查。
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

- 命令失败/无响应 → 中继没启动：`node <skill_dir>/scripts/autojs-relay-server.js` 启动，等约 1 秒再跑 health 确认（**已在跑就绝不重启**，脚本自带端口自保护与指纹自升级）。
- `{"phone":"connected"}` → 进入第 1 步。
- `{"phone":"disconnected"}` → 走「手机未连接时的处理」。

### 第 1 步：拆解任务（两级读取，省 token）

把用户的一句话拆成步骤链。**先跑 `node <skill_dir>/scripts/scan_tasks.js`**，拿到全部模板的 `name`+`description`（精简 JSON，不读脚本、不读正文），据此挑模板；**选中某模板后，才 Read 它的 `tasks/<name>/TASK.md` 全文**，理解场景/坑/兜底，必要时按「临时副本优先」改脚本再下发。模板覆盖不了的步骤才现场写脚本（写入 `<skill_dir>/temp/`，遵守「现场脚本规范」）。

### 第 2 步：逐步下发（模板优先）

`run_task.js` 已 cwd 无关，**推荐用模板名直接调用，无需拼 `tasks/...` 长路径**（模板名自动解析成 `tasks/<name>/<name>.js` 下发手机按名下载）：

```bash
# 推荐：先 cd 到技能目录（<skill_dir> = 本技能根目录，即 autojs-task-runner-yashu/；用相对路径，别写死你电脑的绝对路径），再用相对路径调脚本 + 模板名
cd <skill_dir> && \
  node scripts/run_task.js open_app --args '{"name":"MT管理器"}'
# 等价写法：node scripts/run_task.js --path tasks/open_app/open_app.js --args '{"name":"MT管理器"}'
# 等价写法：node scripts/run_task.js --name open_app --args '{"name":"MT管理器"}'
```

> \*\*路径硬规则（必须记牢，本技能最易踩的坑）：
>
> 1. 分隔符用正斜杠 `/`，禁止反斜杠 `\`（POSIX shell 把 `\` 当转义符吞掉，导致 `skills\autojs`→`skillsautojs`）。
> 2. 本环境 node 是 Windows 程序：把**脚本绝对路径**直接作为 node 参数时，`/c/...` 这种 POSIX 形式会被 node 当成「当前盘根下的相对路径」（如 `d:\c\...`）而找不到文件。**正确做法是先 `cd` 进技能目录、再用相对路径 `scripts/run_task.js` 调**；不要用 `node /c/Users/.../run_task.js` 这种绝对参数形式（除非写成 `C:/Users/.../run_task.js` 带盘符前缀）。
> 3. 任务参数里只写**模板名**（如 `open_app`），不要手拼 `tasks/...` 路径——既省 token，又彻底避开分隔符陷阱。

- 响应 `{"success":true,"result":"{\"ok\":1}"}` → 该步成功，继续下一步（result 是 JSON 字符串，需再解析一次）；
- `{"ok":0,"err":"..."}` → 立即换策略重试一次（如 tap_text 找不到就截图看屏幕），仍失败则终止并向用户汇报卡在哪一步；
- 界面跳转类步骤后，插一步 `wait`（500~1500ms）再操作下一步。
- **下发后 PC 端 30 秒超时、但手机端日志显示脚本明明执行完了** → 第一嫌疑：**脚本没把结果广播出去**。中继只监听手机端 `events.broadcast.emit("autojs_result", <JSON字符串>)` 事件，单纯 `console.log(...)` **不会**回传，PC 永远收不到 → 表现即「手机跑完了、PC 却超时」。确认脚本（含现场一次性脚本）末尾有 `events.on("exit", ...)` 广播、或显式 `events.broadcast.emit("autojs_result", ...)`；UI/常驻脚本更要「建好即广播」（见「现场脚本规范 · 回执」）。这是最高频的想当然错误，排障时**优先排除它**。

### 第 3 步：看屏幕（需要时）

```bash
curl -s http://localhost:9421/screenshot
```

返回 `{"success":true,"path":"<PC本地路径>"}`，用 Read 读该 PNG 判断界面状态，再决定下一步。截图不经过 AI 上下文，只有读图才消耗 token，按需使用。

- **只看局部区域**：若已知道某控件的包围盒（如经 `inspect_control_by_*` 探测出的 bounds），用 `crop_screenshot` 模板按 `left/top/right/bottom` 四元组裁剪该区域并回传电脑 PNG（看"某个控件长什么样"最省，比整屏再肉眼找块强）。调用见其 `TASK.md`。

> **截图结果是否必须展示给用户 —— 分两种情况（关键区分）**：
>
> - **情况 A · 用户明确要求截图 / 截图，或截图本身就是交付物**：`/screenshot` 与 `crop_screenshot` 回传的是 **PC 本地 PNG 的绝对路径**（形如 `{"success":true,"path":"..."}`）。这是**硬规则，不可省略**——AI **不能只把回执丢给用户就结束**，必须：① 用 `present_files` 把 PNG 作为结果文件呈现（生成预览/卡片），让用户直接看到那张图；② 哪怕预览打不开，也必须在回复正文里附上图片的绝对路径，保证用户能自行打开查看。
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
> 适用：所有"把结果写盘"的模板（如 `get_all_apps` 落地用户 App 名单）、截图文件、AI 自行落盘的导出文件等。回执里若带 `file` 字段，直接把该值原样抄给用户即可。

### 识别屏幕内容的三个优先级（回退链）

"看屏幕"的本质是**把屏幕上的文字/状态读出来交给 AI 判断下一步**。按"信息完整度 + 可靠性"从优到劣分三级——**上一级不满足就回退下一级，不要跳级、不要卡死在某一级**：

1. **第一级 · 截屏 + 模型直读（最优先）**：用 `GET /screenshot` 或 `crop_screenshot` 截屏回 PC，让模型直接读图识别内容。
   - 适用：调用方模型**支持多模态**（能读图片/视频）时，信息最全、最省心；
   - 回退条件：若模型**不支持多模态**（读图被过滤 / `Content filtered` / 读不到内容），本级别不可用 → 回退第二级。
2. **第二级 · OCR 取文字**：调用 `ocr` 模板识别屏幕文字（纯文本数组，最省 token）。
   - 适用：模型读不了图、但只需"屏幕有哪些文字"就能判断时；
   - 回退条件：若 OCR 结果**不足以判断界面是否真的变化了**（如界面是纯图形、无明显文字），或**不足以满足用户需求**（用户要的是结构/控件而非文字），→ 回退第三级。
3. **第三级 · 控件树提取文字**：用 `inspect_control_by_*` 模板遍历 UI 控件树，取回所有控件的 `text`/`id`/`desc`。
   - 适用：OCR 不够、需要结构化控件信息，或要判断"界面是否真变了、变了哪个控件"时；
   - 特点：比 OCR 更准（控件自带语义），但返回数据更大，按需用、必要时再过滤。

**回退操作原则**：

- 从第一级往下逐级实测：**模型能否读图？OCR 能否满足？** 哪一级能用就停在哪一级；
- 用于**内部校验**的截图 / OCR / 控件结果（情况 B），只需在终态汇报里给出结论（如"已打开抖音"），不强制把图推给用户；**仅当用户明确要求看、或截图即交付物（情况 A）时**，才须遵守「展示给用户」硬规则（`present_files` + 附绝对路径）。OCR 与控件结果同理：内部校验用只汇报结论，用户要看才展示。
- 三级都拿不到可用信息时，直接问用户，不要硬猜。

### 第 4 步：终态一次性汇报

全部步骤完成 → 一句话汇报结果（如"已帮您打开设置并连上 WiFi"）；失败 → 汇报卡在第几步、原因、建议用户怎么手动补救。**中间过程不打扰用户。**

## 用户问答：查询模板清单（不执行任务）

当用户问"现在有多少个手机任务模板"/"有哪些模板"/"列出所有手机任务"等**纯查询**问题时，**不要走执行 SOP**，直接跑扫描器并朗读结果（无需手机在线、不消耗手机任务 token）：

```bash
node <skill_dir>/scripts/scan_tasks.js --human
```

输出形如：

```
共 8 个手机任务模板：
· tap_point — 按屏幕坐标 (x,y) 点按
· tap_text — 点按含指定文字的控件
...
```

把这段清单直接念给用户即可。若要让外部程序/中继取数，也可 `curl -s http://localhost:9421/templates` 取 JSON `{count, tasks}`，但用户问答场景下优先用 `--human` 命令行，结果更友好。

注意：这是"只读查询"——不要为此启动任务、不要下发任何脚本、不要要求手机在线。

## 现场脚本规范（模板覆盖不了时）

- **新建可复用模板**：当用户要"加个手机任务模板 / 做个 XX 模板"时，先读 `references/AI_新建模板手册.md`，严格走 §1 决策流程（该不该建）+ §6 自检清单，避免污染模板库或建出红线操作。

写在 `<skill_dir>/temp/` 下，用 `node run_task.js <文件> --args '{...}'` 下发。规范与模板一致（详见 `references/AI_新建模板手册.md`）：

- **写/改任何手机端 JS 脚本前，先读 `references/AI_AutoJS编码强制规范.md`**：严格 ES5(var only)、UI 主线程禁止 sleep/网络/大 I/O/密集循环、耗时 API 必须 `threads.start` 多线程（改 UI 用 `ui.run`/`ui.post`）、颜色字面量 `0xRRGGBB` 超 Java int 上限会炸、编码前自检清单。违反这些硬约束会导致脚本静默崩溃、UI 卡死（点不动也关不掉）、PC 端 30 秒中继超时——且往往不报明显错误，极难排查。**每次写手机端 JS 都先过一遍这篇。**

- **写/改 JS 卡住时先翻例子库**：`scripts/autojs代码参考例子/` 下有一批 AutoJS JS 示例（UI/canvas/悬浮窗、功能、数据库等分类），遇到 API 用法或写法问题优先去那里找相似例子照抄。

- **严格 ES5：变量一律 `var`**，禁 let/const/箭头函数；
- 参数从 `/sdcard/脚本/task_args.json` 读，禁止写死；
- 以标准回执收尾：**⚠️ 高频坑——回执必须靠 `events.broadcast.emit("autojs_result", ...)` 广播，不是 `console.log`**。中继只监听 `autojs_result` 事件；脚本里只写 `console.log(...)`，结果 PC 端永远收不到、表现为 30 秒超时（但手机端其实跑完了）。所以回执代码块里的广播不能省、也绝不能被你改成 `console.log`：

```js
var result = { ok: 0, err: "脚本未产出结果" };
try {
  // ... 逻辑 ...
  result = { ok: 1 };
} catch (e) {
  result = { ok: 0, err: e.toString() };
}
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
```

- **UI / 常驻类脚本用「建好即回执」，不要只靠 exit**：凡是 `ui.layout()` 弹窗、脚本自身不退出（窗口常驻）的脚本（如色轮、取色器、悬浮面板、图表页），**绝不能**把回执只放在 `events.on("exit", ...)` 里——窗口不关就永远不触发 exit，PC 端 `run_task.js` 会卡满 30 秒中继超时、任务误判失败。正确写法（回执与 UI 生命周期**解耦**，建好即同步发）：

```js
function sendResult(o) {
  try {
    events.broadcast.emit("autojs_result", JSON.stringify(o));
  } catch (e) {}
}
var result = { ok: 0, err: "脚本未执行" };
events.on("exit", function () {
  sendResult(result);
}); // ① 兜底：注册在最前
try {
  ui.layout(<vertical>...</vertical>);
  // ... 建 UI、绑事件、关闭按钮里调用 exit() ...
  result = { ok: 1, msg: "UI已显示" };
  sendResult(result); // ② 建好即回执：不等 exit，立即广播
} catch (e) {
  result = { ok: 0, err: e.toString() };
  sendResult(result);
}
```

要点：① `events.on("exit", ...)` 提到脚本最前，哪怕后面崩溃未注册也能回 `err`；② `ui.layout()` 成功后**立即同步** `sendResult`，UI 窗口随后自己常驻，PC 早已拿到回执返回；③ 关闭按钮 `exit()` 时 exit 监听会再补一条相同的 `ok:1` 回执，被中继忽略，无害。

- 回执保持极简：成功 `{ok:1}`，最多加一两个短键数据字段；
- 现场验证好用的通用脚本，建议沉淀成 `scripts/tasks/<name>/`（`<name>.js` + `TASK.md`），`scan_tasks.js` 会自动发现，越用越省 token。

## 部署真实工程（多文件 + 资源）

当任务复杂到单文件模板装不下——拆成多个模块、或工程里还带图片/音频等二进制资源时——用**部署真实工程**模式，而不是把代码塞进一个文件。

**核心设计（two 句话）**：AI 永远在 PC 上把工程组织成多文件（`main.js` + `modules/` + `assets/` + 可选官方 `project.json`），下发时把**整个目录按相对结构部署到手机** `/sdcard/脚本/<name>/`，再触发入口 `main.js` 运行。AutoJS6 的原生 `require()` 与相对路径资源读取按手机文件系统解析，模块/图片/音频直接可用，**二进制资源无需 base64 内联**——这正是"部署真实工程"优于"打包成单文件"的关键（单文件打包无法干净承载图片/音频）。

**工程放哪（约定）**：AI 在 PC 上写的工程统一放在 `<skill_dir>/scripts/autojs-project/<工程名>/`（详见上方「约定」节）——这是 AI 写 AutoJS 工程的默认目录；`deploy_project.js` 直接拿这个目录部署即可。工程内部结构如下：

**PC 工程推荐结构**：

```
<工程目录>/
  project.json        # 可选。name=工程名、main="main.js"、ignore=["node_modules",...]
  main.js             # 入口（被 require / 运行）
  modules/            # 业务模块，内部互相 require('./x')
    autojs-utils.js
  assets/             # 图片/音频等资源，原样下发
    logo.png
    beep.mp3
```

- `main.js` 读参数：`var args = JSON.parse(files.read("/sdcard/脚本/task_args.json"));`
- `main.js` 读资源（用注入的 `__projectDir` 兜底，最稳）：`var logo = files.join(args.__projectDir, "assets/logo.png"); images.read(logo);`
- 模块互相引用：`require('./modules/autojs-utils')`（**相对写法即可**，运行侧会向 `execScriptFile` 注入工程目录作为 require 搜索路径，详见下方「规范 3」）。

**部署 + 运行（一步到位）**：

```bash
cd <skill_dir> && \
  node scripts/deploy_project.js ./my-project --name demo --args '{"count":3}'
```

脚本会：① 读 `project.json` 取 name/main/ignore；② 递归收集文件（跳过 ignore 与隐藏文件）；③ 逐文件经 `send_file_to_phone` 按相对结构落盘到手机 `/sdcard/脚本/<name>/`；④ 部署完默认触发 `/run-project` 跑入口。只部署不运行加 `--no-run`。

**仅重跑（已部署过）**：

```bash
node scripts/run_project.js demo --args '{"count":5}'
```

**清理已部署工程**：

```bash
node scripts/delete_project.js demo                              # 删 /sdcard/脚本/demo
node scripts/delete_project.js --path /sdcard/autojs/projects/demo   # 删旧路径那份
```

- `delete_project.js` 触发手机端 `delete_project` 指令，用 `files.removeDir` 整目录删除；目标不存在时幂等返回「无需删除」。
- 手机端带安全护栏：只允许删除 `/sdcard/` 下路径，拒绝系统目录，避免误删。
- 早期版本把工程部署在 `/sdcard/autojs/projects/<name>/`，自改为 `/sdcard/脚本/<name>/` 后，**旧路径那份不会自动消失**，容易造成「两份同名工程并存、改了新的旧的还在」的混淆。换路径后用上面第二条命令清掉旧部署即可。

**两个必做注意点（改动后）**：

- 中继加了 `POST /run-project`、`POST /delete-project` 端点：这些端点定义在子模块 `scripts/relay/ai-api.js`（`autojs-relay-server.js` 中继主程序的子模块，主程序第 6 行注释已说明它负责 `/health` `/screenshot` `/run` 等端点）里。改完 `ai-api.js` 后**必须重启中继**（`curl -X POST localhost:9421/shutdown` 后重跑 `node scripts/autojs-relay-server.js`），否则新端点不生效。
- 手机端客户端加了 `run_project`、`delete_project` 处理：改完 `autojs-task-phone-client.js` 后，**用 `update_phone_client.js` 一键热更新手机端**（无需手动），否则手机不认这两个指令。

**工程代码编写规范（三个硬约束，范本 `autojs-min-project-template` 已内置，写自己的工程照做）**：

1. **严格 ES5 / var only**：`modules/*.js` 和 `main.js` 一律 `var`、函数声明、`module.exports = { fn: function () {} }` 完整写法；禁用 `const`/`let`/箭头函数/方法简写 `{ test() {} }`。原因：AutoJS6 工程内 `require` 解析模块时若遇 ES6 语法会直接抛错，导致整个 `main.js` 加载即崩，且**不会触发 `events.on('exit')` 回传**，表现为中继 30 秒静默超时（排查极难）。
2. **入口必须回传结果**：`main.js` 末尾务必加
   ```js
   events.on("exit", function () {
     events.broadcast.emit("autojs_result", JSON.stringify(result));
   });
   ```
   否则中继收不到 `run_result` 同样 30 秒超时。把业务结果装进 `result` 对象（**默认失败态**，任何异常路径都回传有意义的信息，不要留"未执行"的真空）。
3. **相对 require 靠运行侧注入的 `config.path` 生效**：工程内模块互相 `require('./modules/autojs-utils')` 能解析，是因为 PC 侧 `run_project` 调用 `engines.execScriptFile(mainPath, { path: projectDir })`，把工程目录注入为 require 搜索路径——`execScriptFile` 本身**不提供模块上下文**，相对 require 默认会失败。所以**工程代码保持相对写法即可，不要手写绝对路径 require**，由运行侧保证解析。

## 自动更新手机客户端（PC 一键，免手动）

手机端代码（`autojs-task-phone-client.js`）一旦改动，无需再到手机上手动点运行——PC 侧跑一条命令即可把新版下发并让手机端自重启：

```bash
node scripts/update_phone_client.js            # 更新为 skill 自带的最新客户端
node scripts/update_phone_client.js --path <其他位置的客户端.js>   # 指定其他位置的客户端（相对或技能根相对路径均可，勿写死绝对路径）
```

**机制（自举）**：

1. `update_phone_client.js` 先调 `pc_to_phone.js`，把新版 `autojs-task-phone-client.js` 下发到手机 `/sdcard/脚本/autojs-task-phone-client.js`（已有则覆盖）。
2. 再 `POST /update-client` 触发手机端 `update_client` 指令：旧实例用 `engines.execScriptFile(新版路径)` 启动新实例。
3. 新实例顶部的 `preventDuplicate`（单实例保护）会自动 `forceStop` 掉旧实例——实现零手动自重启。手机端始终保持唯一一份客户端、唯一 WebSocket 连接。

**关键约束**：首次仍需在手机上手动运行一次 `autojs-task-phone-client.js` 以建立 WebSocket 连接（这是 AutoJS6 的运行入口，PC 无法凭空启动 App 内脚本）。建立连接之后，任何手机端代码改动都可用 `update_phone_client.js` 一键热更新，不再需要手动。

> 注意：若手机端客户端已假死（在线但不响应指令，常见于媒体 / 图像操作后引擎残留），`update_client` 指令也发不过去。此时仍需先在手机上手动重跑一次客户端清状态；重跑后恢复一键更新能力。

## 手机未连接时的处理（AI 必须主动）

触发条件：第 0 步 health 返回 `{"phone":"disconnected"}`，或中继根本没起。此时**绝不能只甩一句"请连接手机"**——用户往往不懂技术，AI 必须主动把"怎么连"讲清楚。

按顺序执行（缺一不可）：

1. **AI 自己跑取局域网 IP**（不要叫用户自己去查）：
   ```bash
   node <skill_dir>/scripts/get-lan-ip.js --first
   ```
   拿到形如 `192.168.x.x` 的地址（脚本已自动排除虚拟网卡 / Clash fake-ip / 链路本地地址）。
2. **把 IP 直接发给用户**，并明确告诉他改哪里：
   - 文件：`scripts/autojs-task-phone-client.js`（手机端常驻客户端，需复制到手机 AutoJs6 运行）；
   - 位置：搜索 `var SERVER_IP =`，第 89 行附近，形如 `var SERVER_IP = "192.168.0.41";`；
   - 操作：把引号里的 IP 改成第 1 步刚取到的值；端口 `SERVER_PORT` 保持 `9421` 不动（除非你改过约定端口）。
3. **告诉他去启动哪个脚本**：在手机 AutoJs6 里运行改好 IP 的 `autojs-task-phone-client.js`（整份粘贴 → 点「运行」，或用 `AutoJs6 VSCode Extension` 一键下发运行）。这就是"手机端客户端"。
4. **给最简操作步骤**（不懂技术也能照做）：
   - 电脑和手机连**同一个 WiFi**；
   - 确认手机端四项权限已开（无障碍 / 悬浮窗 / 后台运行 / 截图）；
   - 粘贴并运行 `autojs-task-phone-client.js` 后，脚本常驻保活、断线自动重连；
5. 提示用户连上后回一句"连上了"，AI 再跑一次 health 确认 `phone: connected` 后继续任务。

**一句话总结 AI 该输出的内容**：「你的电脑局域网 IP 是 `xxx.xxx.x.xx`，请把手机脚本 `autojs-task-phone-client.js` 里的 `var SERVER_IP` 改成这个地址，然后到 AutoJs6 里运行这份脚本，连上后告诉我一声『连上了』即可。」

## 安全边界（红线）

- 支付、转账、删除、授权类不可逆操作：即使是全自动模式，执行该步前也要先向用户确认一次；
- 一次一个请求：中继同一时刻只处理一个在途请求，逐步顺序下发，切勿并发。

## 注意事项

- **启动前先检测、勿重复启动**：每次准备启动中继前跑 health 检查，已在运行就跳过。重复执行启动命令会触发端口清理、踢掉已连手机（脚本有指纹自保护兜底，但主流程是"先检测、按需启动"）。
- **手机端脚本严格 ES5 / var only**：AutoJs6 Rhino 引擎对 ES6 支持不全，这是硬性约束。
- **现场脚本不要 setInterval 保活**：经 /run 下发的脚本由中继托管，正常 exit 即可；只有常驻客户端需要 setInterval 保活。
- **性能**：涉及 UI 树查找的步骤（tap_text 等）在界面层级深时会慢一些，属正常，等回执即可。
- **截图类脚本必须内置权限前置代码**：凡调用 `captureScreen()` / `ocr(...)` 的手机端脚本，最前面必须有「后台线程自动点『立即开始』+ `requestScreenCapture()` + `sleep(500)`」这段代码，否则截图失败或脚本卡死（表现为"回执为空"）。模板 `screenshot` / `crop_screenshot` / `ocr` 已内置，新建截图模板照 `references/截图权限与弹框处理.md` 加。
