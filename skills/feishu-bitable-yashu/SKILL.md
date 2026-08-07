---
name: feishu-bitable-yashu
description: 操作飞书多维表格(Bitable)。激活条件：用户消息须包含以下关键词之一:`操作飞书多维表格`、`管理多维表格`、`操作飞书bitable`、`多维表格操作`、`bitable管理`。
metadata:
  author: "AI Assistant"
  updated: "2026-08-07 00:00:00"
  version: "1.1.0"
---

# 飞书多维表格 API 操作

为 AI 大模型提供处理飞书多维表格的完整能力，支持操作数据表、记录、字段和素材。

---

## 🚨🚨🚨 AI 调用任何脚本前必读 🚨🚨🚨

> **硬性规则**：本文档中每一个 `*.js` 脚本的调用，**必须**先 Read 对应的 `$SKILL_DIR/references/<功能>/<操作>.md` 文档，再构造参数文件，**最后**才执行脚本。
>
> **此规则适用于本 skill 的所有 23 个脚本**——包括"基础能力"的 `get-tenant-access-token.js` 和 `parse-bitable-url.js`，**没有任何脚本是例外**。本规则在「决策流程」「触发词总表」「跨功能公共规则」中均不再重复阐述，统一以此处为准。

### ❌ 反面案例（真实发生，请勿重演）

2026-07-08 skill 真实测试阶段0 预检时，AI 看到 `parse-bitable-url.js` 是个"基础操作"，**未先 Read `$SKILL_DIR/references/parse_bitable_url.md` 就凭类比其他脚本的经验**写了参数文件：

```json
// ❌ 错误：仅传 url，缺少 tenant_access_token
{ "url": "https://kr0lqjlbmo.feishu.cn/wiki/..." }
```

脚本直接返回错误：

```
错误: 参数文件中必须包含 tenant_access_token 和 url 字段
```

正确做法是 **先 Read** [parse_bitable_url.md]($SKILL_DIR/references/parse_bitable_url.md) 第 24-26 行的参数表，明确知道两个字段都是必填。

**核心教训**：**"基础操作"不代表"可以凭直觉"**。每个脚本的 schema 都是独立的、不可类推的，唯一可靠的来源是当下 Read 的文档。

### ✅ 调用脚本的强制三步走（每一步都不可跳过）

| 步骤 | 动作                                                                     | 是否可跳过  | 失败后果                            |
| ---- | ------------------------------------------------------------------------ | ----------- | ----------------------------------- |
| 1️⃣   | **Read** `references/<类别>/<操作>.md` 完整文档                          | ❌ 不可跳过 | 参数缺失/类型错误，浪费时间与 token |
| 2️⃣   | 在内心或输出中**声明"已读证明"**：cite 出文档路径                        | ❌ 不可跳过 | 无可审计性，跳过风险增大            |
| 3️⃣   | 严格按文档 JSON Schema 示例构造参数文件，再 `cd $SKILL_DIR/scripts` 执行 | —           | —                                   |

**已读证明示例**（在执行脚本前的输出中显式出现）：

```
> 已 Read references/record/create.md（行 22-156，JSON Schema）
> 已 Read references/record/create.md（行 162-193，文本字段格式警告）
> 准备构造参数文件并执行 record/create.js
```

### ⚠️ 触发"读文档"提示的强信号

只要你的内部推理出现以下任一信号，**立即停止并去 Read 文档**：

- 💭 "这个脚本我之前用过，应该用 `xxx` 字段" → **必须 Read**
- 💭 "这是基础操作，凭经验写就行" → **必须 Read**
- 💭 "和 `xxx.js` 应该差不多" → **必须 Read**
- 💭 "参数我已经记得了" → **必须 Read**

> **唯一可信赖的来源是当下 Read 的文档**，不是过去的经验，不是其他脚本的类比。

---

## 功能概述

本 Skill 提供完整的飞书多维表格 API 操作能力：

| 功能模块       | 支持的操作                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| **数据表管理** | 创建、更新、删除数据表（支持批量操作）                                                                             |
| **记录操作**   | 增删改查记录，支持批量操作（创建/更新最多 1000 条，批量获取最多 100 条，单次查询最多 500 行，批量删除最多 500 条） |
| **字段管理**   | 创建、更新、删除字段，列出所有字段                                                                                 |
| **素材上传**   | 上传文件、图片等素材，获取临时下载链接                                                                             |

## 环境说明

- **`$SKILL_DIR`**：本 Skill 所在的绝对目录，即 `SKILL.md` 文件所在文件夹。**⚠️ `$SKILL_DIR` 仅为文档占位符，不是环境变量**：执行命令时必须替换为实际绝对路径，否则 bash 会将其解析为空字符串，导致 `cd $SKILL_DIR/scripts` 变成 `cd /scripts` 而报错"找不到路径"
- **Shell 类型**：bash。本 Skill 运行命令时采用 **bash 条件执行**（前一条成功才执行下一条），规则如下：
  - **条件执行**：`cmd1 && cmd2`（如 `cd $SKILL_DIR/scripts && node script.js`）
  - **禁止单 `&`**：在 bash 中 `&` 表示后台执行，语义完全不同
- **脚本目录**：`$SKILL_DIR/scripts`
- **Node 版本**：>=18.20.8
- **依赖安装**：`cd $SKILL_DIR/scripts && npm install`
- **配置文件 `config.default.json`**（集中说明，全文不再重复）：
  - 路径：`$SKILL_DIR/config.default.json`
  - 默认存储字段：`appId`、`appSecret`、`tenant_access_token`
  - AI 可自动读写；脚本会自动将新令牌回写到该文件
  - 可手动修改 `tenant_access_token` 字段的**值**（键名保持不变）以切换为 `user_access_token` 身份，详见「如何切换身份」

### ⚠️ 脚本已混淆，禁止读取源码

`$SKILL_DIR/scripts/` 目录下的所有 JavaScript 文件已进行代码混淆处理，**禁止读取或分析 `.js` 文件内容**。混淆代码可读性极差，读取纯属浪费 token 和时间。

如需了解脚本功能和用法，请查阅下方「脚本与触发词总表」和 `$SKILL_DIR/references/` 目录下的接口文档。

## 全局前置条件

所有 API 操作都需要以下前提：

| 前置条件              | 说明                               | 获取方式                                       |
| --------------------- | ---------------------------------- | ---------------------------------------------- |
| `tenant_access_token` | API 访问凭证，有效期 2 小时        | 按下方「令牌使用策略」执行                     |
| `app_token`           | 标识要操作的多维表格               | 运行 `parse-bitable-url.js` 从 URL 解析        |
| `table_id`            | 标识要操作的数据表（部分操作需要） | 运行 `parse-bitable-url.js` 或 `table/list.js` |

凭证管理详细规则参见 [认证与凭证管理指南]($SKILL_DIR/references/authentication.md)。

## 身份与访问令牌

> 💡 **飞书多维表格也是一种文档**：在飞书产品的概念中，飞书多维表格（Bitable）本质上是飞书云文档的一种，存放于用户的云空间中。因此下文关于"两个独立身份/两个独立空间/access_token 鉴权/身份切换"的说明，同样完全适用于多维表格的操作。

### 两个独立身份与两个独立空间（核心定义）

在使用飞书云文档 API 时，需要先理解一个关键概念：**飞书企业自建应用**和**飞书用户（使用飞书产品的真人）**在飞书中被视为两个完全独立的"用户"，各自拥有独立的云空间。

- **飞书企业自建应用**：本身在飞书中就是一个独立的"用户"，拥有自己的云空间（应用自身空间）
- **飞书用户（个人）**：是另一个独立的"用户"，拥有自己的云空间（用户个人空间）
- **两个空间相互独立**：各自存放各自的文档（包括多维表格），谁也看不到谁、谁也影响不了谁
- **可见性隔离**：用户在飞书客户端中打开自己的「云文档」时，看到的是**用户个人空间**的文档（含多维表格），**看不到**飞书企业自建应用空间中的文档；反之，应用也看不到用户个人空间中的文档

本 Skill 默认使用飞书企业自建应用身份操作，因此默认操作的是**应用自身空间**中的多维表格，而非用户个人空间中的多维表格。

### 凭证对比总表

下表汇总两种访问凭证的全部差异（合并身份、作用、有效期、获取方式、是否自动、默认身份）：

| 凭证类型              | 归属身份         | 作用                                                                                     | 有效期    | 获取依据                           | 获取方式                                                                               | 是否可自动获取    | 默认 |
| --------------------- | ---------------- | ---------------------------------------------------------------------------------------- | --------- | ---------------------------------- | -------------------------------------------------------------------------------------- | ----------------- | ---- |
| `tenant_access_token` | 飞书企业自建应用 | 飞书企业自建应用的临时令牌，以**应用身份**调用 OpenAPI，操作应用自身云空间的多维表格     | 约 2 小时 | `appId` + `appSecret`（应用凭证）  | 本 Skill 调用 `get-tenant-access-token.js` 脚本，凭 `appId`+`appSecret` 自动向飞书换取 | ✅ 可自动获取     | ✅   |
| `user_access_token`   | 飞书用户（个人） | 飞书用户的令牌，以**用户身份**调用 OpenAPI，可直接操作用户个人云空间中的所有可见多维表格 | 约 2 小时 | 飞书用户账号（需用户本人登录授权） | 用户自行打开飞书开放平台 API 调试台网页，登录授权后复制 token 值（步骤见下文）         | ❌ 需用户手动获取 | -    |

> 💡 **关键区别**：`appId` + `appSecret` 是飞书企业自建应用的凭证，本 Skill 可以凭它**自动换取** `tenant_access_token`（应用身份）；但 `user_access_token` 必须由**飞书用户本人**登录网页授权才能获取，本 Skill 无法代为自动获取。两种 token 均约 2 小时过期。

### 协作者机制：让应用访问用户文档的另一种路径

由于两个空间相互隔离，如果飞书企业自建应用希望直接操作**飞书用户个人空间**里的某个多维表格，需要先将该应用**添加为该多维表格文档的"协作者"**，授予相应权限（查看/编辑/管理）。配置入口：在飞书客户端打开目标多维表格 → 右上角「分享」→ 添加协作者 → 搜索应用名并授予权限。

> 协作者方式适合"只操作个别多维表格"的场景；若需批量操作用户空间中的多个多维表格，推荐改用 `user_access_token` 方式直接以用户身份操作。

### 如何切换身份：以飞书用户身份操作用户空间文档

如果用户希望本 Skill 操作**用户个人空间**里的多维表格（而非应用自身空间的多维表格），操作非常简单 —— **所有脚本无需任何修改**，只需修改凭证文件 `$SKILL_DIR/config.default.json`：

1. 打开 `$SKILL_DIR/config.default.json`
2. 找到 `"tenant_access_token"` 字段（注意：**键名 `tenant_access_token` 保持不变，不要修改键名**）
3. 将该字段的**值**替换为用户提供的 `user_access_token` 的值
4. 保存文件，后续所有脚本调用将自动以**飞书用户身份**操作用户个人空间的多维表格

修改示例（只改值，不改键名）：

```json
{
  "appId": "cli_xxx",
  "appSecret": "xxx",
  "tenant_access_token": "u-xxxxxxxxxxxxxxxxxxxx",
  ...
}
```

> 💡 脚本内部统一通过该字段读取 token，并不关心其实际是 tenant 还是 user 类型 —— 飞书 API 服务端会根据 token 本身识别身份。因此只需替换值即可完成身份切换。

### user_access_token 的获取方式

`user_access_token` 权限较高，且自动化获取流程复杂（需 OAuth 授权），因此本 Skill **不存储、不自动获取** `user_access_token`。若用户需以用户身份操作自己的多维表格，请按以下步骤获取：

1. 打开飞书开放平台 API 调试台：[获取文件元数据](https://open.feishu.cn/document/server-docs/docs/drive-v1/file/batch_query)
2. 页面右侧为 API 调试台，在请求头区域可切换 Token 类型（`user_access_token` / `tenant_access_token`）
3. 选择 `user_access_token` 并登录授权后，即可复制获取到的 `user_access_token` 值
4. 将该值提供给 AI，AI 会按上文「如何切换身份」中的方式写入 `config.default.json` 后执行脚本

> ⚠️ **安全提示**：`user_access_token` 具有用户级别的完整权限，请妥善保管。本 Skill 仅临时使用，不做任何持久化存储，执行完毕后临时文件会自动清理。

### tenant_access_token 的获取与刷新（令牌使用策略，全文唯一权威定义）

> ⚠️ **令牌使用策略（重要）**：本 Skill **优先复用** `config.default.json` 中的 `tenant_access_token`，**默认不主动刷新**，以避免不必要的换取请求。仅当**其他业务脚本**返回信息中出现"token 不合法"、"token 已过期"、"token 失效"等类似描述时，才运行 `cd $SKILL_DIR/scripts && node get-tenant-access-token.js --parameter-file-path <参数文件绝对路径>` 刷新令牌（脚本会自动将新令牌回写到配置文件，无需手动处理）。

获取方式参考 [认证与凭证管理指南]($SKILL_DIR/references/authentication.md) 或 [获取访问凭证 API]($SKILL_DIR/references/get_tenant_access_token.md)。

## 跨功能公共规则

> 以下规则适用于本 Skill 所有脚本调用，必须严格遵守。「先 Read 文档」规则已在顶部「AI 调用任何脚本前必读」集中定义，此处不重复。

### 1. 执行前必须进入 scripts 目录（命令模板，全文唯一权威定义）

执行任何脚本前，**必须先 `cd` 到 `$SKILL_DIR/scripts` 目录**，再运行命令：

```bash
cd $SKILL_DIR/scripts && node record/get.js --parameter-file-path "参数文件绝对路径"
```

| 写法                                              | 是否允许 |
| ------------------------------------------------- | -------- |
| `cd $SKILL_DIR/scripts && node record/get.js ...` | ✅ 正确  |
| `node $SKILL_DIR/scripts/record/get.js ...`       | ❌ 禁止  |
| `node scripts/record/get.js ...`                  | ❌ 禁止  |

### 2. 参数通过文件传递

所有脚本均使用 `--parameter-file-path` 参数传递配置。参数文件必须使用**绝对路径**，路径分隔符使用正斜杠 `/`，包含空格时用双引号包裹。各脚本所需的参数字段不同，请阅读对应的参考文档获取字段说明。

### 3. 临时文件管理

AI 调用脚本时自动管理临时参数文件：

- 临时文件创建在 **`$SKILL_DIR/temp`** 目录
- 清理时机：调用技能完成用户需求后，或调用技能因报错终止后，运行 `clear_temp.js` 清理 temp 目录
- ❌ 不要将参数文件创建在 `$SKILL_DIR/temp` 以外的目录

详细临时文件管理流程、工具函数用法与参数配置示例参见 [参数配置示例与最佳实践]($SKILL_DIR/references/examples.md)。

### 4. 🚨 禁止用 Shell 命令写文件

AI 在执行本 Skill 过程中**创建或修改任何文件（包括参数文件、配置文件等）**，**必须使用 Write 工具**。**禁止使用任何 Shell 文件写入命令**（`>` 重定向、`echo >`、`Set-Content`、`Out-File`、`[System.IO.File]::WriteAllText()` 等）。

> **原因**：部分 Shell 写入命令会在文件中添加 UTF-8 BOM（`EF BB BF`），这个不可见字符会导致：
>
> - **JSON**：`JSON.parse()` 抛出 `Unexpected token` 异常
> - **JS**：Node.js 无法加载带 BOM 的模块，报语法错误
> - **Markdown**：frontmatter 解析失败，metadata 字段读取为 undefined
>
> **Write 工具**不产生 BOM，是唯一安全的文件写入方式。

### 5. 输出格式

- **成功**：返回操作结果数据（JSON 格式），包含完整的 API 响应
- **失败**：返回错误信息，包含错误码和解决建议

## 脚本日志输出机制

`$SKILL_DIR/scripts/` 目录下的 JS 脚本的**所有日志均通过 `console.error` 输出至标准错误流（stderr）**

据此，脚本运行期间产生的所有输出（含进度日志与结构化结果数据 JSON）均经由 stderr 输出，标准输出流（stdout）为空。AI 在调用脚本、捕获输出时应知晓此特性。

## 脚本与触发词总表

> 🚨 **执行任何脚本前，先 Read 对应参考文档（最右列链接），再 `cd $SKILL_DIR/scripts`，最后才运行脚本。** 没有例外。本表合并原「触发映射」与「全业务脚本索引清单」两张表。

### 基础能力

| 用户输入触发词              | 脚本                         | 功能                                           | 参考文档                                                         |
| --------------------------- | ---------------------------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| "获取访问凭证"/"刷新 token" | `get-tenant-access-token.js` | 获取 `tenant_access_token`                     | [获取访问凭证]($SKILL_DIR/references/get_tenant_access_token.md) |
| "解析飞书链接"              | `parse-bitable-url.js`       | 从 URL 提取 `app_token`、`table_id`、`view_id` | [解析飞书链接]($SKILL_DIR/references/parse_bitable_url.md)       |
| （清理临时文件）            | `clear_temp.js`              | 清理 `$SKILL_DIR/temp` 下的临时文件            | [参数配置示例与最佳实践]($SKILL_DIR/references/examples.md)      |

### 数据表操作（table/）

| 用户输入触发词              | 脚本               | 功能                                     | 参考文档                                                       |
| --------------------------- | ------------------ | ---------------------------------------- | -------------------------------------------------------------- |
| "创建表格"/"添加数据表"     | `create-single.js` | 新增一个数据表，支持指定名称、视图和字段 | [创建单个数据表]($SKILL_DIR/references/table/create_single.md) |
| "批量创建表格"              | `batch-create.js`  | 新增多个数据表，仅可指定名称             | [批量创建数据表]($SKILL_DIR/references/table/batch_create.md)  |
| "修改表格名称"/"重命名表格" | `update.js`        | 更新指定数据表的名称                     | [更新数据表]($SKILL_DIR/references/table/update.md)            |
| "查看表格"/"数据表列表"     | `list.js`          | 获取所有数据表的 ID、版本号和名称        | [列出数据表]($SKILL_DIR/references/table/list.md)              |
| "删除表格"/"移除数据表"     | `delete-one.js`    | 通过 `app_token` 和 `table_id` 删除      | [删除单个数据表]($SKILL_DIR/references/table/delete_one.md)    |
| "批量删除表格"              | `batch-delete.js`  | 批量删除多个数据表                       | [批量删除数据表]($SKILL_DIR/references/table/batch_delete.md)  |

### 记录操作（record/）

| 用户输入触发词                   | 脚本              | 功能                                | 参考文档                                                     |
| -------------------------------- | ----------------- | ----------------------------------- | ------------------------------------------------------------ |
| "添加记录"/"创建记录"/"插入记录" | `create.js`       | 在数据表中新增一条记录              | [创建记录]($SKILL_DIR/references/record/create.md)           |
| "修改记录"/"更新记录"/"编辑记录" | `update.js`       | 更新数据表中的一条记录              | [更新记录]($SKILL_DIR/references/record/update.md)           |
| "查看记录"/"获取记录"/"列出记录" | `get.js`          | 查询记录，单次最多 500 行，支持分页 | [获取记录]($SKILL_DIR/references/record/get.md)              |
| "删除记录"/"移除记录"            | `delete.js`       | 删除数据表中的一条记录              | [删除记录]($SKILL_DIR/references/record/delete.md)           |
| "批量添加记录"/"添加多条记录"    | `batch-create.js` | 批量新增记录，单次最多 1,000 条     | [批量创建记录]($SKILL_DIR/references/record/batch_create.md) |
| "批量修改记录"/"更新多条记录"    | `batch-update.js` | 批量更新记录，单次最多 1,000 条     | [批量更新记录]($SKILL_DIR/references/record/batch_update.md) |
| "批量获取记录"                   | `batch-get.js`    | 通过记录 ID 查询，最多 100 条       | [批量获取记录]($SKILL_DIR/references/record/batch_get.md)    |
| "批量删除记录"/"清空记录"        | `batch-delete.js` | 批量删除多条记录                    | [批量删除记录]($SKILL_DIR/references/record/batch_delete.md) |

### 字段操作（field/）

| 用户输入触发词      | 脚本        | 功能                              | 参考文档                                          |
| ------------------- | ----------- | --------------------------------- | ------------------------------------------------- |
| "添加字段"/"新列"   | `create.js` | 在数据表中新增一个字段            | [创建字段]($SKILL_DIR/references/field/create.md) |
| "修改字段"/"修改列" | `update.js` | 全量更新字段（property 会被覆盖） | [更新字段]($SKILL_DIR/references/field/update.md) |
| "查看字段"/"列信息" | `list.js`   | 获取数据表中的所有字段            | [列出字段]($SKILL_DIR/references/field/list.md)   |
| "删除字段"/"移除列" | `delete.js` | 删除数据表中的一个字段            | [删除字段]($SKILL_DIR/references/field/delete.md) |

### 素材/文件操作（media/）

| 用户输入触发词                   | 脚本                   | 功能                                                                    | 参考文档                                                         |
| -------------------------------- | ---------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------- |
| "上传文件"/"上传图片"/"上传附件" | `upload.js`            | 上传文件、图片、视频等素材（无大小限制，脚本内部自动区分直传/分片上传） | [上传素材]($SKILL_DIR/references/media/upload.md)                |
| "获取下载链接"/"获取直链"        | `file-token-to-url.js` | `file_token` 转临时下载链接（24小时有效）                               | [获取文件链接]($SKILL_DIR/references/media/file_token_to_url.md) |

## 决策流程（权威调用流程，全文唯一）

> **流程图的核心**：原流程是"想调用 → 直接调用"，现改为"想调用 → **先 Read 文档** → 再调用"。`Read doc` 是流程中的**第一个必经节点**，不可绕过。本节为权威流程，「强制三步走」「跨功能公共规则」均指向本节。

**第1步：判断是否涉及飞书多维表格**
否 → 不使用此 Skill
是 → 确定要调用的脚本名（如 record/create.js），进入第2步

**第2步：【必经节点 1】Read 对应参考文档**
运行 Read 读取 `$SKILL_DIR/references/<类别>/<操作>.md`
已 Read？→ 在输出中 cite 文档路径，进入第3步
未 Read？→ 立即 Read，不要继续

**第3步：准备访问凭证（如需要）**
按令牌使用策略执行（见「tenant_access_token 的获取与刷新」）
进入第4步

**第4步：准备资源标识（如需要）**
调 `parse-bitable-url.js`（同样先 Read 对应文档）
进入第5步

**第5步：【必经节点 2】cd 到 scripts 目录后执行**
运行 `cd $SKILL_DIR/scripts && node <script-path>.js --parameter-file-path "..."`
数据表操作 → `table/` 脚本
记录操作 → `record/` 脚本
字段操作 → `field/` 脚本
素材操作 → `media/` 脚本

**关键约束**：

- 任何脚本（包括 `get-tenant-access-token.js`、`parse-bitable-url.js` 这两个"基础操作"）都**必须**经过第2步 Read 对应 reference
- Read 文档后必须能在输出中"cite 出文档路径"，否则视为未读
- 跳过 Read 直接写参数文件 = 流程违规（参考文档顶部"反面案例"）

## 核心概念

| 概念                   | 说明                                                     |
| ---------------------- | -------------------------------------------------------- |
| **多维表格 (Bitable)** | 字节跳动的产品，结合电子表格的灵活性和数据库的结构化特性 |
| **数据表 (Table)**     | 多维表格中的单个表格，类似 Excel 工作表                  |
| **记录 (Record)**      | 数据表中的一行数据                                       |
| **字段 (Field)**       | 数据表中的一列的表头，用于设定该列的数据类型             |
| **素材 (Media)**       | 上传的文件、图片、视频等                                 |

## 索引列约束

### 字段基本结构

数据表中的字段对象包含以下属性：

```json
{
  "field_id": "fldYWaldeW", // 字段的 ID
  "field_name": "文本", // 字段名称
  "type": 1, // 字段的类型
  "description": "字段的描述", // 对字段的更多说明
  "is_primary": true, // 该字段是否是初始的索引字段
  "property": null, // 字段的属性
  "ui_type": "Text", // 字段在界面上的展示类型，例如进度字段是数字的一种展示形态
  "is_hidden": false // 字段是否是隐藏字段
}
```

### 索引列（is_primary）

数据表中第一列为索引列，即 `is_primary: true` 的字段。索引列有以下限制：

| 约束项   | 说明                                                           |
| -------- | -------------------------------------------------------------- |
| 不可删除 | 索引列不能被删除（调用 `field/delete.js` 会失败）              |
| 不可移动 | 索引列的位置固定为第一列，不能移动                             |
| 不可隐藏 | 索引列不能被设置为隐藏字段                                     |
| 可修改   | 索引列可以修改字段名称等属性，但修改字段类型时仅限以下几种类型 |

索引列修改字段类型时，仅支持以下类型：

| type 值 | 字段类型 |
| ------- | -------- |
| 1       | 多行文本 |
| 2       | 数字     |
| 5       | 日期     |
| 13      | 电话号码 |
| 15      | 超链接   |

## AI 处理示例

**用户说**："帮我在飞书表格 https://xxx.feishu.cn/wiki/xxx 里添加一条记录，任务名称是'完成报告'，进度50%"

**AI 执行步骤**（按「决策流程」执行，下表"已读证明"列需在输出中显式呈现）：

| 步骤 | 执行动作                            | 已读证明（必须显式 cite）                                                                 | 命令                                                                                                                                          |
| ---- | ----------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | 检查 tenant_access_token            | `已 Read references/get_tenant_access_token.md`                                           | 按令牌使用策略：**优先复用** config 中已有 token；仅当业务脚本返回失效描述时才 `cd $SKILL_DIR/scripts && node get-tenant-access-token.js ...` |
| 2    | 解析 URL 获取 app_token 和 table_id | `已 Read references/parse_bitable_url.md`                                                 | `cd $SKILL_DIR/scripts && node parse-bitable-url.js ...`                                                                                      |
| 3    | 读取参考文档                        | `已 Read references/record/create.md`（重点：行 22-156 Schema + 行 162-193 文本格式警告） | 读取 `$SKILL_DIR/references/record/create.md`，按 JSON Schema 构造参数                                                                        |
| 4    | 创建临时参数文件                    | —                                                                                         | 存放在 `$SKILL_DIR/temp` 目录                                                                                                                 |
| 5    | 创建记录                            | —                                                                                         | `cd $SKILL_DIR/scripts && node record/create.js --parameter-file-path "..."`                                                                  |
| 6    | 清理临时参数文件                    | —                                                                                         | 完成用户需求或报错终止后，运行 `clear_temp.js` 清理 temp 目录                                                                                 |
| 7    | 返回结果                            | —                                                                                         | 向用户返回："已成功创建记录！记录ID: recxxx"                                                                                                  |

**用户感知**：完全不需要知道临时文件的存在，只需自然语言交互。

## 全局错误处理

| 错误场景                                                                      | 错误表现                        | 处理方式                                                                      |
| ----------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------- |
| 令牌失效（业务脚本返回"token 不合法/已过期/失效"等描述，含 401/403/99991663） | API 返回 token 失效相关错误信息 | 运行 `get-tenant-access-token.js` 刷新令牌，更新参数文件后重试                |
| URL 解析失败                                                                  | 无法提取 app_token/table_id     | 检查 URL 格式是否正确，或手动提供参数                                         |
| 记录不存在                                                                    | API 返回 404 错误               | 检查 record_id 是否正确，或先运行 `record/get.js` 查询                        |
| 字段类型不匹配                                                                | API 返回 400 错误               | 运行 `field/list.js` 查看字段类型，调整参数后重试                             |
| 文本字段格式错误                                                              | `TextFieldConvFail` 错误        | 文本字段写入使用字符串格式，不要用富文本数组格式                              |
| 字段更新缺少参数                                                              | `field validation failed`       | 更新字段时必须提供 `type` 和 `field_name` 参数                                |
| 文件token格式错                                                               | `Cannot read properties`        | 使用 `file_tokens`（数组）而非 `file_token`（字符串）                         |
| 批量操作超限                                                                  | API 返回 422 错误               | 减少单次操作数量（创建/更新最多1000条，批量获取最多100条，批量删除最多500条） |
| 临时文件创建失败                                                              | 磁盘空间不足或权限问题          | 检查 `$SKILL_DIR/temp` 目录权限和磁盘空间                                     |
| 网络超时                                                                      | 请求无响应                      | 检查网络连接，稍后重试                                                        |

> 字段读写格式差异、常见错误详解及测试记录参见 [常见错误及解决方案]($SKILL_DIR/references/errors.md) 与 [参数配置示例与最佳实践]($SKILL_DIR/references/examples.md)。

## 参考文档

| 文档                                                                 | 说明                                                                              |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [认证与凭证管理指南]($SKILL_DIR/references/authentication.md)        | 详细的凭证管理说明，包括 App ID/App Secret 获取、tenant_access_token 自动获取流程 |
| [获取访问凭证 API]($SKILL_DIR/references/get_tenant_access_token.md) | 获取 tenant_access_token 的具体 API 调用说明和脚本使用方法                        |
| [解析飞书 URL 工具]($SKILL_DIR/references/parse_bitable_url.md)      | 从飞书多维表格 URL 中提取 app_token、table_id、view_id 的工具使用说明             |
| [常见错误及解决方案]($SKILL_DIR/references/errors.md)                | API 调用常见错误码及排查方法                                                      |
| [参数配置示例与最佳实践]($SKILL_DIR/references/examples.md)          | 各种操作场景的参数配置示例、字段格式差异、临时文件管理详细流程                    |
