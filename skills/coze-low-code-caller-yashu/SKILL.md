---
name: coze-low-code-caller-yashu
description: 本技能提供扣子(Coze)低代码平台的智能体与工作流调用能力。激活条件：用户消息须包含以下关键词之一:`调用扣子`、`测试扣子`、`执行扣子工作流`、`调用扣子Bot`、`进行扣子对话`、`执行coze工作流`。
---

# coze-low-code-caller-yashu

扣子(Coze)智能体与工作流调用器

## 功能概述

封装对字节跳动扣子(Coze)平台 API 的调用能力。支持：

- 调用扣子平台上的智能体(Bot)执行特定任务
- 触发扣子平台上的工作流(Workflow)进行自动化处理
- 管理智能体和工作流的执行状态和结果

## 环境说明

- `$SKILL_DIR` = 当前 Skill (`coze-low-code-caller-yashu`) 所在目录，即本文件 `SKILL.md` 所在的文件夹
- > ⚠️ **`$SKILL_DIR` 仅为文档占位符，不是环境变量！** 执行命令时必须替换为当前 Skill 所在目录的绝对路径。在 PowerShell 中直接写 `$SKILL_DIR` 会被当作未定义变量解析为空字符串，导致 `cd $SKILL_DIR/scripts` 变成 `cd /scripts` 而报错"找不到路径"。
- **脚本目录：** `$SKILL_DIR/scripts/`
- **命令分隔符：** 本 Skill 运行命令时采用**条件执行**（前一条成功才执行下一条），跨平台规则如下：
  - **bash/zsh**（Linux/macOS）：`cmd1 && cmd2`
  - **PowerShell 5**（Windows）：`cmd1; if ($?) { cmd2 }`（PowerShell 5 不支持 `&&`）
  - **PowerShell 7+**：`&&` 和 `; if ($?) { cmd2 }` 均可，为最大兼容性推荐 `; if ($?) { cmd2 }`
  - **禁止单 `&`**：在 bash 中 `&` 表示后台执行，语义完全不同
- **模块类型：** `$SKILL_DIR/scripts/package.json` 已设置 `"type": "module"`，因此所有 `.js` 脚本均按 **ES Module** 解析。如需修改或新建脚本文件，必须使用 `import` 语法，不能使用 CommonJS 的 `require`。

### ⚠️ 脚本已混淆，禁止读取源码

`$SKILL_DIR/scripts/` 目录下的所有 JavaScript 文件已进行代码混淆处理，**禁止读取或分析 `.js` 文件内容**。混淆代码可读性极差，读取纯属浪费 token 和时间。

如需了解脚本功能和用法，请查阅「全业务脚本索引清单」和 `$SKILL_DIR/references/` 目录下的接口文档。

### ⚠️ 禁止用 Shell 命令写文件

本 Skill 执行过程中**创建或修改任何文件**（包括 `.env`、`config/*.json`、`temp/` 目录下的参数文件等），**必须使用 Write 工具**，**禁止使用任何 Shell 文件写入命令**（`Set-Content`、`Out-File`、`>` 重定向、`echo >`、`[System.IO.File]::WriteAllText()` 等）。

**原因**：PowerShell 的文件写入命令会添加 UTF-8 BOM（`EF BB BF`），导致 JSON 解析失败（`Unexpected token`）、JS 模块加载报语法错误、Markdown frontmatter 字段读取为 undefined。使用 Write 工具可避免此问题，且在所有平台上安全。

## 全业务脚本索引清单

#### 智能体脚本（Bot）

| 脚本                | 功能     | 用途                                       |
| ------------------- | -------- | ------------------------------------------ |
| `create_session.js` | 创建会话 | 开启与智能体的对话                         |
| `send_message.js`   | 发送消息 | 向智能体发送问题                           |
| `check_status.js`   | 查询状态 | 检查任务执行状态，完成时自动记录端到端耗时 |
| `get_messages.js`   | 获取回复 | 获取智能体的最终回答                       |

#### 工作流脚本（Workflow）

| 脚本                       | 功能               | 用途                                             |
| -------------------------- | ------------------ | ------------------------------------------------ |
| `get_workflow_info.js`     | 查询工作流基本信息 | 获取开始节点输入参数和结束节点输出参数定义       |
| `run_workflow.js`          | 执行工作流（异步） | 触发工作流，返回 execute_id 和 debug_url         |
| `check_workflow_result.js` | 查询异步运行结果   | 获取结束节点的输出数据，成功时自动记录端到端耗时 |

> 工作流统一使用异步执行（`is_async: true`）。执行后需轮询 `check_workflow_result.js` 获取结果。

#### 公共脚本

| 脚本             | 功能         | 用途                            |
| ---------------- | ------------ | ------------------------------- |
| `upload_file.js` | 上传文件     | 上传图片/文档等给智能体或工作流 |
| `clear_temp.js`  | 清理临时文件 | 清理 temp 目录中的临时文件      |

## 前置条件

调用扣子 API 前，执行以下检查和准备：

1. **读取配置：** 运行 `Read` 读取 `$SKILL_DIR/.env`。如 `COZE_API_KEY` 或 `COZE_SPACE_ID` 不存在，向用户索要并运行 `Write` 创建或更新 `$SKILL_DIR/.env`。获取方式参考 [获取扣子 API Key 指南]($SKILL_DIR/references/获取扣子 API Key.md) 和 [获取扣子空间ID指南]($SKILL_DIR/references/获取扣子空间ID.md)。

   ```plaintext
   # 扣子空间 ID
   COZE_SPACE_ID=你的空间ID

   # 扣子 API 密钥
   COZE_API_KEY=你的API密钥

   # 轮询间隔时间（单位：秒），默认5秒
   POLLING_INTERVAL=5
   ```

2. **读取配置列表：** 运行 `Read` 读取 `$SKILL_DIR/config/bots.json` 和 `$SKILL_DIR/config/workflows.json`。如文件不存在或为空，提示用户先配置智能体/工作流。

   ```json
   {
     "bots": [
       {
         "id": "你的BOT_ID / 智能体 ID",
         "name": "智能体名称",
         "description": "可选描述",
         "recent_durations": []
       }
     ]
   }
   ```

   > `recent_durations` 字段由脚本自动维护，记录最近 6 次成功调用的端到端耗时（从创建会话到任务完成，如 `"28秒"`、`"1分15秒"`），供 AI 参考预估等待时间。无需手动填写。

   ```json
   {
     "workflows": [
       {
         "id": "你的WORKFLOW_ID",
         "name": "工作流名称",
         "description": "可选描述",
         "recent_durations": []
       }
     ]
   }
   ```

   > `recent_durations` 字段由脚本自动维护，记录最近 6 次成功调用的端到端耗时（从执行工作流到执行完成，如 `"28秒"`、`"1分15秒"`），供 AI 参考预估等待时间。无需手动填写。

3. **安装依赖（一次性操作）：** 运行 `cd $SKILL_DIR/scripts; if ($?) { npm install }` 确保依赖已安装。依赖安装后无需重复执行，仅首次使用或 `package.json` 更新后需要重新安装。

## 脚本调用方式

所有预置脚本位于 `$SKILL_DIR/scripts/` 目录，调用前确保已安装依赖。

> ⚠️ **【致命重要】执行脚本前必须先 cd 到 scripts 目录**
>
> 每次运行任何脚本之前，先执行 `cd $SKILL_DIR/scripts`，再运行脚本。否则 Node.js 会在当前工作目录找不到脚本文件，报 `Error: Cannot find module '...'`。
>
> AI 执行命令时，每个命令前都要包含 `cd $SKILL_DIR/scripts`，并使用条件执行（前一条成功才执行下一条）。例如：
>
> ```powershell
> cd $SKILL_DIR/scripts; if ($?) { node create_session.js <bot_id> }
> ```

> ⚠️ **命令语法注意**：必须使用条件执行（前一条成功才执行下一条），跨平台规则见【环境说明】。例如：
>
> - ❌ `cd dir; node xxx.js`（`;` 不是条件执行，第一条失败时第二条仍会执行）
> - ✅ PowerShell：`cd dir; if ($?) { node xxx.js }`
> - ✅ bash/zsh：`cd dir && node xxx.js`

## 自然语言调用（推荐）

当用户请求包含`调用扣子`、`测试扣子`、`执行扣子工作流`、`调用扣子Bot`、`进行扣子对话`、`执行coze工作流`等触发词时，执行以下步骤：

1. 确认已在【前置条件】中完成 `.env`、`bots.json` 和 `workflows.json` 的读取
2. 理解用户意图，通过对比 `bots.json` / `workflows.json` 中每个对象的 `name` 和 `description` 与用户任务的匹配度，选择最合适的智能体或工作流，并向用户说明选择理由

> ⚠️ **【强制要求】在执行任何脚本之前，必须先读取对应的参考文档！** 这是避免参数错误的关键步骤。
>
> - 调用 `send_message.js` 前 -> 必须先读取 `$SKILL_DIR/references/bot/sendMessage.md`
> - 调用 `run_workflow.js` 前 -> 必须先读取 `$SKILL_DIR/references/workflow/runWorkflow.md`
> - 其他脚本同理，否则极容易因为参数格式错误导致调用失败

3. 按对应流程依次执行预置脚本：
   - **智能体**：`create_session.js` -> `send_message.js` -> `check_status.js` -> `get_messages.js`
   - **工作流**：`get_workflow_info.js` -> `run_workflow.js` -> `check_workflow_result.js`（需要 **workflow_id** 和 **execute_id** 两个参数）
4. 每次执行脚本前，先 `cd` 到 `$SKILL_DIR/scripts`，再运行命令。示例：
   ```powershell
   cd $SKILL_DIR/scripts; if ($?) { node create_session.js <bot_id> }
   cd $SKILL_DIR/scripts; if ($?) { node send_message.js <conversation_id> <绝对路径> }
   cd $SKILL_DIR/scripts; if ($?) { node check_status.js <conversation_id> <chat_id> }
   cd $SKILL_DIR/scripts; if ($?) { node get_messages.js <conversation_id> <chat_id> }
   ```
5. **临时文件必须放在 `$SKILL_DIR/temp` 目录**，且参数文件路径必须使用**绝对路径**
6. **结果交付后清理临时文件**：将执行结果交付给用户后，执行 `clear_temp.js` 清理 `$SKILL_DIR/temp` 目录（详细说明见 [临时文件清理说明]($SKILL_DIR/references/temp-cleanup.md)）

## 上传文件

当需要发送文件（图片、文档、音频、视频等）给智能体或工作流时，先上传文件：

| 步骤 | 脚本             | 功能     | 命令格式                             | 输出字段                            |
| ---- | ---------------- | -------- | ------------------------------------ | ----------------------------------- |
| 1    | `upload_file.js` | 上传文件 | `node upload_file.js <文件绝对路径>` | `file_id`, `file_name`, `file_size` |

详细说明参考 [上传文件详细说明]($SKILL_DIR/references/upload_file.md)。

## 调用智能体 (Bot)

智能体调用采用四步流程：`create_session.js` → `send_message.js` → `check_status.js` → `get_messages.js`

详细调用流程、参数格式、输入输出示例、常见错误处理，参考：

- **完整流程**：[Bot API 调用索引]($SKILL_DIR/references/bot-api.md)
- **send_message.js 详细参数**：[发送消息]($SKILL_DIR/references/bot/sendMessage.md)
- **create_session.js**：[创建会话]($SKILL_DIR/references/bot/createSession.md)
- **check_status.js**：[查询状态]($SKILL_DIR/references/bot/checkStatus.md)
- **get_messages.js**：[获取回复]($SKILL_DIR/references/bot/getMessages.md)

## 调用工作流 (Workflow)

工作流调用采用三步流程：`get_workflow_info.js` → `run_workflow.js` → `check_workflow_result.js`

详细调用流程、参数格式、输入输出示例、常见错误处理，参考：

- **完整流程**：[Workflow API 调用索引]($SKILL_DIR/references/workflow-api.md)
- **get_workflow_info.js**：[查询工作流信息]($SKILL_DIR/references/workflow/getWorkflowInfo.md)
- **run_workflow.js**：[执行工作流]($SKILL_DIR/references/workflow/runWorkflow.md)
- **check_workflow_result.js**：[查询工作流结果]($SKILL_DIR/references/workflow/checkWorkflowResult.md)

## ⏳ 轮询等待机制

当调用智能体或工作流时，由于它们是异步执行的，可能需要一段时间才能完成。AI 需要通过轮询来检查任务是否完成。

### 为什么需要等待？

- 智能体（Bot）：调用 `send_message.js` 后，智能体正在处理请求，状态可能为 `in_progress`
- 工作流（Workflow）：执行 `run_workflow.js` 后，工作流可能正在运行，状态可能为 `Running`

### AI 需要等待多长时间？

**优先参考 `recent_durations` 历史耗时：** 读取 `$SKILL_DIR/config/bots.json`（智能体）或 `$SKILL_DIR/config/workflows.json`（工作流），找到目标智能体/工作流的 `recent_durations` 数组。该数组记录了最近 6 次成功调用的端到端耗时（如 `"28秒"`、`"1分15秒"`），AI 可据此预估本次需要等待的时间，合理设置轮询间隔和最大轮询次数。

**从 `.env` 文件中读取 `POLLING_INTERVAL` 配置项**（单位：秒）：

```plaintext
# 轮询间隔时间（单位：秒），默认5秒
POLLING_INTERVAL=5
```

- **默认值**：5 秒
- **可自定义**：用户可以修改此值来调整等待时间

### AI 在哪里检查它需要等待多长时间？

**1. 智能体（Bot）：**

调用 `check_status.js` 后，检查返回的 `status` 字段：

| status 值       | 含义   | 后续操作                                                                                                      |
| --------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| `"completed"`   | 已完成 | 停止轮询，调用 `get_messages.js` 获取回复                                                                     |
| `"in_progress"` | 进行中 | 继续轮询：先单独执行 `Start-Sleep -Seconds <POLLING_INTERVAL>` 等待，再发起下一次查询（详见下方「实现方式」） |

**2. 工作流（Workflow）：**

调用 `check_workflow_result.js` 后，检查返回的 `execute_status` 字段：

| execute_status 值 | 含义   | 后续操作                                                                                                                                                                   |
| ----------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"Success"`       | 已完成 | 停止轮询，获取输出结果                                                                                                                                                     |
| `"Fail"`          | 失败   | 停止轮询，返回错误信息                                                                                                                                                     |
| `"Running"`       | 进行中 | 继续轮询：先单独执行 `Start-Sleep -Seconds <POLLING_INTERVAL>` 等待，再发起下一次查询（详见下方「实现方式」）；同时将 `debug_url` 提供给用户，可在浏览器中实时观察执行进度 |

### 实现方式

脚本本身**不包含自动等待逻辑**，需要 AI 自行实现轮询。**两次轮询之间必须等待 `POLLING_INTERVAL` 秒**，等待命令必须作为**独立的一条命令**执行，不能与轮询脚本拼接在同一条命令里。等待命令因平台而异：PowerShell 用 `Start-Sleep -Seconds N`，bash/zsh 用 `sleep N`（跨平台等待命令对照表详见 `skill-laws-yashu` 的【轮询操作的等待规则】章节）。

```powershell
# 示例：智能体轮询（PowerShell，分三条独立命令执行）
cd $SKILL_DIR/scripts; if ($?) { node check_status.js <conversation_id> <chat_id> }
# 检查输出，如果 in_progress，先单独执行等待命令，再发起下一次查询
Start-Sleep -Seconds 5
cd $SKILL_DIR/scripts; if ($?) { node check_status.js <conversation_id> <chat_id> }

# 示例：工作流轮询（PowerShell，分三条独立命令执行）
cd $SKILL_DIR/scripts; if ($?) { node check_workflow_result.js <workflow_id> <execute_id> }
# 检查输出，如果 Running，先单独执行等待命令，再发起下一次查询
Start-Sleep -Seconds 5
cd $SKILL_DIR/scripts; if ($?) { node check_workflow_result.js <workflow_id> <execute_id> }
```

```bash
# 示例：智能体轮询（bash/zsh，分三条独立命令执行）
cd $SKILL_DIR/scripts && node check_status.js <conversation_id> <chat_id>
# 检查输出，如果 in_progress，先单独执行等待命令，再发起下一次查询
sleep 5
cd $SKILL_DIR/scripts && node check_status.js <conversation_id> <chat_id>

# 示例：工作流轮询（bash/zsh，分三条独立命令执行）
cd $SKILL_DIR/scripts && node check_workflow_result.js <workflow_id> <execute_id>
# 检查输出，如果 Running，先单独执行等待命令，再发起下一次查询
sleep 5
cd $SKILL_DIR/scripts && node check_workflow_result.js <workflow_id> <execute_id>
```

> ⚠️ **【致命重要】等待命令必须作为独立命令执行，禁止与轮询脚本拼接在同一条命令里！**
>
> **等待是必须的**：两次轮询之间必须等待 `POLLING_INTERVAL` 秒（从 `.env` 读取，默认 5 秒），避免无意义的密集查询。
>
> **但等待命令必须单独成一条命令**，绝对不能和轮询脚本写在同一条命令里。命令必须一条一条地单独执行，禁止用 `;`、`&&` 或 `if ($?)` 把等待命令与其他命令拼接。
>
> **原因**：AI 客户端的终端输出捕获机制存在一个**时间阈值**。当单条命令总执行时间超过阈值时，阈值之后产生的输出不会被捕获到终端历史缓冲区，导致命令调用工具和状态检查工具都无法读取到这部分输出。**不同 AI 客户端的阈值可能不同**（例如 Trae IDE 约为 5 秒，其他大公司出品的 AI 编程客户端阈值相近），等待时间默认值 5 秒与多数客户端的阈值对齐。
>
> **罪魁祸首是等待命令与脚本拼接**：把等待命令和脚本调用写在一条命令里，会把原本 1-2 秒的脚本调用拉长到 6+ 秒，越过客户端的输出捕获阈值，导致脚本输出（发生在等待之后）落在捕获窗口之外而丢失。表现现象是：命令执行成功（exit code 0），但返回的日志里只有命令行本身，没有任何脚本输出的 JSON 结果。
>
> - ❌ **错误（拼接在一条命令里，PowerShell）**：`Start-Sleep -Seconds 5; cd $SKILL_DIR/scripts; if ($?) { node check_workflow_result.js <wf_id> <exec_id> }`（总时长 6+ 秒，输出丢失）
> - ❌ **错误（拼接在一条命令里，bash）**：`sleep 5 && cd $SKILL_DIR/scripts && node check_workflow_result.js <wf_id> <exec_id>`（总时长 6+ 秒，输出丢失）
> - ✅ **正确（分两条独立命令执行）**：
>   - 第 1 条命令（仅等待）：PowerShell `Start-Sleep -Seconds 5` / bash `sleep 5`
>   - 第 2 条命令（仅执行脚本，1-2 秒，输出正常）：PowerShell `cd $SKILL_DIR/scripts; if ($?) { node check_workflow_result.js <wf_id> <exec_id> }` / bash `cd $SKILL_DIR/scripts && node check_workflow_result.js <wf_id> <exec_id>`
>
> **轮询间隔的实现**：AI 通过多次独立的命令调用实现轮询。每次轮询完成后，若状态仍为进行中，必须**先单独执行一次等待命令**（PowerShell `Start-Sleep -Seconds <POLLING_INTERVAL>` / bash `sleep <POLLING_INTERVAL>`）进行等待，然后再发起下一次轮询调用。`POLLING_INTERVAL` 从 `.env` 读取（默认 5 秒）。**命令必须一条一条地单独执行，禁止拼接。**

## ⚠️ 常见错误

| 错误信息                                                                | 原因                                       | 正确用法                                                                                                                |
| ----------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `Cannot find module '...create_session.js'`                             | 未先 `cd` 到 scripts 目录就运行脚本        | 执行 `cd $SKILL_DIR/scripts; if ($?) { node create_session.js <bot_id> }`                                               |
| `Unexpected token ... is not valid JSON`                                | 错误地将文本文件路径传给 `send_message.js` | 第二个参数必须是 JSON 参数文件，如 `param.json`                                                                         |
| `参数错误：第二个参数必须是 JSON 文件路径`                              | 传递了 `.txt` 或其他非 JSON 文件           | 使用 `cd $SKILL_DIR/scripts; if ($?) { node send_message.js <会话ID> <参数JSON文件绝对路径> }`                          |
| `参数错误：JSON 中缺少或无效的 'path' 字段`                             | JSON 文件中没有 `path` 字段                | 确保 JSON 格式为 `{ "path": "$SKILL_DIR/temp/your_file.txt" }`（**绝对路径**）                                          |
| `用户输入文件不存在`                                                    | `path` 指向的文件不存在                    | 使用**绝对路径**（如 `$SKILL_DIR/temp/your_file.txt`）                                                                  |
| `执行工作流失败`                                                        | `workflow_id` 错误或参数类型不匹配         | 先用 `get_workflow_info.js` 确认参数定义，再检查传入的参数                                                              |
| `查询工作流结果失败`                                                    | `execute_id` 错误或工作流仍在运行中        | 确认 `execute_id` 正确；如状态为 `Running`，等待后重试                                                                  |
| `access token expired`                                                  | 令牌过期                                   | 申请新的令牌，参考 [获取扣子 API Key 指南]($SKILL_DIR/references/获取扣子 API Key.md)                                   |
| `authentication is invalid` 或 `does not have permission to access ...` | 令牌权限不足                               | 前往 [扣子 PAT 管理页面](https://coze.cn/open/oauth/pats) 编辑令牌，勾选所需的权限范围（Bot、Workflow、File upload 等） |

> ⚠️ **重要**：所有参数文件路径和用户输入文件路径都必须使用**绝对路径**，且临时文件必须放在 `$SKILL_DIR/temp` 目录下！

## 清理 temp 文件夹

在完成用户请求并将结果交付给用户后，执行 `clear_temp.js` 清理 `$SKILL_DIR/temp` 目录下的临时文件，防止文件堆积。

- **清理时机**：每次独立请求完成、结果交付给用户之后执行
- **清理规则**：由 `clear_temp.js` 脚本内部逻辑决定，文档不干涉

详细操作说明见 [临时文件清理说明]($SKILL_DIR/references/temp-cleanup.md)。

## 注意事项

1. 当 API 调用失败时，向用户提供清晰的错误信息
2. `scripts` 目录下的脚本在运行时如需创建临时文件，必须存放于 `$SKILL_DIR/temp` 目录中，不得与脚本文件混杂存放
3. **【强制规则】禁止绕过封装脚本直接调用扣子 HTTP API**：凡是本技能已经封装过的 API（如创建会话、发送消息、查询状态、获取回复、上传文件、执行工作流等），AI 必须通过 `$SKILL_DIR/scripts/` 下对应的封装脚本调用，**严禁**使用 `Invoke-RestMethod`、`curl`、`fetch` 等方式自行构造 HTTP 请求直接调用扣子平台 API。即使封装脚本因授权、限流等原因调用失败，也不得绕过脚本直接调用 API，应将错误信息如实反馈给用户。
4. **【发布提醒】如果用户的需求没有按照预期产出（如智能体返回无关内容、工作流结果不符合预期等），必须提醒用户检查扣子智能体或工作流是否已发布。** 当用户修改了扣子智能体或工作流的配置后，**必须重新发布**才能使修改生效。只有已发布的智能体和工作流才会通过 API 生效，未发布的修改不会反映在 API 调用结果中。发布渠道选择`API`
