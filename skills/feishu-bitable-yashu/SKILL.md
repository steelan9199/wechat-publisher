---
name: feishu-bitable-yashu
description: 操作飞书多维表格(Bitable)。激活条件：用户消息须包含以下关键词之一:`操作飞书多维表格`、`管理多维表格`、`操作飞书bitable`、`多维表格操作`、`bitable管理`。
metadata:
  author: "AI Assistant"
  updated: "2026-07-08 12:00:00"
  version: "1.0.0"
---

# 飞书多维表格 API 操作

为 AI 大模型提供处理飞书多维表格的完整能力，支持操作数据表、记录、字段和素材。

---

## 🚨🚨🚨 AI 调用任何脚本前必读 🚨🚨🚨

> **硬性规则**：本文档中每一个 `*.js` 脚本的调用，**必须**先 Read 对应的 `$SKILL_DIR/references/<功能>/<操作>.md` 文档，再构造参数文件，**最后**才执行脚本。
>
> **此规则适用于本 skill 的所有 23 个脚本**--包括"基础能力"的 `get-tenant-access-token.js` 和 `parse-bitable-url.js`，**没有任何脚本是例外**。

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

- **`$SKILL_DIR`**：本 Skill 所在的绝对目录，即 `SKILL.md` 文件所在文件夹。**⚠️ `$SKILL_DIR` 仅为文档占位符，不是环境变量**：执行命令时必须替换为实际绝对路径。在 PowerShell 中直接写 `$SKILL_DIR` 会被当作未定义变量解析为空字符串，导致 `cd $SKILL_DIR/scripts` 变成 `cd /scripts` 而报错"找不到路径"
- **Shell 类型**：PowerShell 5（Windows）/ bash（Linux/Mac）。本 Skill 运行命令时采用**条件执行**（前一条成功才执行下一条），跨平台规则如下：
  - **bash/zsh**（Linux/macOS）：`&&`（如 `cd $SKILL_DIR/scripts && node script.js`）
  - **PowerShell 5**（Windows）：`; if ($?) { }`（如 `cd $SKILL_DIR/scripts; if ($?) { node script.js }`）
  - **禁止单 `&`**：在 bash 中 `&` 表示后台执行，语义完全不同
- **脚本目录**：`$SKILL_DIR/scripts`
- **Node 版本**：>=18.20.8
- **依赖安装**：bash/zsh 用 `cd $SKILL_DIR/scripts && npm install`，PowerShell 用 `cd $SKILL_DIR/scripts; if ($?) { npm install }`
- **配置文件**：`$SKILL_DIR/config.default.json`（存储 appId、appSecret、tenant_access_token，AI 可自动读写）

### ⚠️ 脚本已混淆，禁止读取源码

`$SKILL_DIR/scripts/` 目录下的所有 JavaScript 文件已进行代码混淆处理，**禁止读取或分析 `.js` 文件内容**。混淆代码可读性极差，读取纯属浪费 token 和时间。

如需了解脚本功能和用法，请查阅下方「脚本清单」和 `$SKILL_DIR/references/` 目录下的接口文档。

## 全局前置条件

所有 API 操作都需要以下前提：

| 前置条件              | 说明                               | 获取方式                                       |
| --------------------- | ---------------------------------- | ---------------------------------------------- |
| `tenant_access_token` | API 访问凭证，有效期 2 小时        | 运行 `get-tenant-access-token.js`              |
| `app_token`           | 标识要操作的多维表格               | 运行 `parse-bitable-url.js` 从 URL 解析        |
| `table_id`            | 标识要操作的数据表（部分操作需要） | 运行 `parse-bitable-url.js` 或 `table/list.js` |

凭证管理详细规则参见 [认证与凭证管理指南]($SKILL_DIR/references/authentication.md)。

## 跨功能公共规则

> 以下规则适用于本 Skill 所有脚本调用，必须严格遵守。

### 1. 执行前必须进入 scripts 目录

执行任何脚本前，**必须先 `cd` 到 `$SKILL_DIR/scripts` 目录**，再运行命令：

```bash
# bash/zsh
cd $SKILL_DIR/scripts && node record/get.js --parameter-file-path "参数文件绝对路径"

# PowerShell 5
cd $SKILL_DIR/scripts; if ($?) { node record/get.js --parameter-file-path "参数文件绝对路径" }
```

| 写法                                                                                                                                | 是否允许 |
| ----------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `cd $SKILL_DIR/scripts && node record/get.js ...` (bash) / `cd $SKILL_DIR/scripts; if ($?) { node record/get.js ... }` (PowerShell) | ✅ 正确  |
| `node $SKILL_DIR/scripts/record/get.js ...`                                                                                         | ❌ 禁止  |
| `node scripts/record/get.js ...`                                                                                                    | ❌ 禁止  |

### 2. 🚨 执行前必须读取对应参考文档（强制流程，不可跳过）

> **这是硬性要求，不是建议。** 任何脚本调用前，**必须**先 Read 对应的参考文档，再构造参数文件。

**强制执行流程**：

| 步骤 | 动作                                                        | 是否可跳过  |
| ---- | ----------------------------------------------------------- | ----------- |
| 1    | **Read** 对应的参考文档（如 `references/record/create.md`） | ❌ 不可跳过 |
| 2    | 复制文档中提供的**完整 JSON Schema 示例**                   | ❌ 不可跳过 |
| 3    | 仅替换示例中的占位值为实际值，**不增删任何字段**            | ❌ 不可跳过 |
| 4    | Write 参数文件到 `$SKILL_DIR/temp/` 目录                    | —           |
| 5    | 执行脚本                                                    | —           |

**禁止行为**：

- ❌ **禁止凭记忆/直觉编写参数**：例如「上次用过 `record_ids`，这次也用」是严重错误
- ❌ **禁止跳过步骤1直接编写参数**：即使你"记得"参数格式，也必须先 Read 文档
- ❌ **禁止类比其他脚本推断字段**：批量创建/更新/删除/获取的 `records` 字段格式各不相同，必须看文档

**为什么必须这样做**：

不同脚本的参数字段差异巨大，记忆不可靠：

| 脚本                     | 关键参数     | 格式                                             |
| ------------------------ | ------------ | ------------------------------------------------ |
| `record/batch-create.js` | `records`    | 对象数组 `[{"fields": {...}}]`                   |
| `record/batch-update.js` | `records`    | 对象数组 `[{"record_id": "x", "fields": {...}}]` |
| `record/batch-delete.js` | `records`    | **字符串数组 `["recx", "recy"]`**                |
| `record/batch-get.js`    | `record_ids` | **字符串数组 `["recx", "recy"]`**                |

仅凭记忆很容易把 `record_ids`、`record_id` 等搞错，**唯一可靠的来源是当下 Read 的文档**。

**自检清单**（执行每个脚本前在内心过一遍）：

- [ ] 我刚才 Read 了对应的参考文档吗？
- [ ] 我使用的字段名（不是 `record_ids`，而是 `records`）是否与文档 Schema 一致？
- [ ] 我使用的字段格式（字符串数组 vs 对象数组）是否与文档示例一致？

### 3. 参数通过文件传递

所有脚本均使用 `--parameter-file-path` 参数传递配置。参数文件必须使用**绝对路径**，路径分隔符使用正斜杠 `/`，包含空格时用双引号包裹。各脚本所需的参数字段不同，请阅读对应的参考文档获取字段说明。

### 4. 临时文件管理

AI 调用脚本时自动管理临时参数文件：

- 临时文件创建在 **`$SKILL_DIR/temp`** 目录
- 清理时机：调用技能完成用户需求后，或调用技能因报错终止后，运行 `clear_temp.js` 清理 temp 目录
- ❌ 不要将参数文件创建在 `$SKILL_DIR/temp` 以外的目录

详细临时文件管理流程、工具函数用法与参数配置示例参见 [参数配置示例与最佳实践]($SKILL_DIR/references/examples.md)。

### 5. 🚨 禁止 PowerShell 写文件

AI 在执行本 Skill 过程中**创建或修改任何文件（包括参数文件、配置文件等）**，**必须使用 Write 工具**。**禁止使用任何 PowerShell 文件写入命令**（`Set-Content`、`Out-File`、`>` 重定向、`[System.IO.File]::WriteAllText()` 等）。

> **原因**：PowerShell 默认会在文件中添加 UTF-8 BOM（`EF BB BF`），这个不可见字符会导致：
>
> - **JSON**：`JSON.parse()` 抛出 `Unexpected token` 异常
> - **JS**：Node.js 无法加载带 BOM 的模块，报语法错误
> - **Markdown**：frontmatter 解析失败，metadata 字段读取为 undefined
>
> **Write 工具**不产生 BOM，是唯一安全的文件写入方式。

### 6. 输出格式

- **成功**：返回操作结果数据（JSON 格式），包含完整的 API 响应
- **失败**：返回错误信息，包含错误码和解决建议

## 触发映射：用户说 → AI 做

> ⚠️ **执行任意一条前必须先 Read 表格最右列的文档**——这是强制流程，不可跳过。

| 用户输入触发词                   | AI 执行动作                                   | 对应脚本                                        | 🔴 必读文档（先 Read 再执行）                                    |
| -------------------------------- | --------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------- |
| "查看记录"/"获取记录"/"列出记录" | 运行 `record/get.js` 查询记录列表             | `$SKILL_DIR/scripts/record/get.js`              | [获取记录]($SKILL_DIR/references/record/get.md)                  |
| "添加记录"/"创建记录"/"插入记录" | 运行 `record/create.js` 创建单条记录          | `$SKILL_DIR/scripts/record/create.js`           | [创建记录]($SKILL_DIR/references/record/create.md)               |
| "修改记录"/"更新记录"/"编辑记录" | 运行 `record/update.js` 更新单条记录          | `$SKILL_DIR/scripts/record/update.js`           | [更新记录]($SKILL_DIR/references/record/update.md)               |
| "删除记录"/"移除记录"            | 运行 `record/delete.js` 删除单条记录          | `$SKILL_DIR/scripts/record/delete.js`           | [删除记录]($SKILL_DIR/references/record/delete.md)               |
| "批量添加记录"/"添加多条记录"    | 运行 `record/batch-create.js` 批量创建记录    | `$SKILL_DIR/scripts/record/batch-create.js`     | [批量创建记录]($SKILL_DIR/references/record/batch_create.md)     |
| "批量修改记录"/"更新多条记录"    | 运行 `record/batch-update.js` 批量更新记录    | `$SKILL_DIR/scripts/record/batch-update.js`     | [批量更新记录]($SKILL_DIR/references/record/batch_update.md)     |
| "批量获取记录"                   | 运行 `record/batch-get.js` 批量获取记录       | `$SKILL_DIR/scripts/record/batch-get.js`        | [批量获取记录]($SKILL_DIR/references/record/batch_get.md)        |
| "批量删除记录"/"清空记录"        | 运行 `record/batch-delete.js` 批量删除记录    | `$SKILL_DIR/scripts/record/batch-delete.js`     | [批量删除记录]($SKILL_DIR/references/record/batch_delete.md)     |
| "查看表格"/"数据表列表"          | 运行 `table/list.js` 列出所有数据表           | `$SKILL_DIR/scripts/table/list.js`              | [列出数据表]($SKILL_DIR/references/table/list.md)                |
| "创建表格"/"添加数据表"          | 运行 `table/create-single.js` 创建单个数据表  | `$SKILL_DIR/scripts/table/create-single.js`     | [创建单个数据表]($SKILL_DIR/references/table/create_single.md)   |
| "批量创建表格"                   | 运行 `table/batch-create.js` 批量创建数据表   | `$SKILL_DIR/scripts/table/batch-create.js`      | [批量创建数据表]($SKILL_DIR/references/table/batch_create.md)    |
| "修改表格名称"/"重命名表格"      | 运行 `table/update.js` 更新数据表名称         | `$SKILL_DIR/scripts/table/update.js`            | [更新数据表]($SKILL_DIR/references/table/update.md)              |
| "删除表格"/"移除数据表"          | 运行 `table/delete-one.js` 删除单个数据表     | `$SKILL_DIR/scripts/table/delete-one.js`        | [删除单个数据表]($SKILL_DIR/references/table/delete_one.md)      |
| "批量删除表格"                   | 运行 `table/batch-delete.js` 批量删除数据表   | `$SKILL_DIR/scripts/table/batch-delete.js`      | [批量删除数据表]($SKILL_DIR/references/table/batch_delete.md)    |
| "查看字段"/"列信息"              | 运行 `field/list.js` 列出所有字段             | `$SKILL_DIR/scripts/field/list.js`              | [列出字段]($SKILL_DIR/references/field/list.md)                  |
| "添加字段"/"新列"                | 运行 `field/create.js` 创建字段               | `$SKILL_DIR/scripts/field/create.js`            | [创建字段]($SKILL_DIR/references/field/create.md)                |
| "修改字段"/"修改列"              | 运行 `field/update.js` 更新字段               | `$SKILL_DIR/scripts/field/update.js`            | [更新字段]($SKILL_DIR/references/field/update.md)                |
| "删除字段"/"移除列"              | 运行 `field/delete.js` 删除字段               | `$SKILL_DIR/scripts/field/delete.js`            | [删除字段]($SKILL_DIR/references/field/delete.md)                |
| "上传文件"/"上传图片"/"上传附件" | 运行 `media/upload.js` 上传素材               | `$SKILL_DIR/scripts/media/upload.js`            | [上传素材]($SKILL_DIR/references/media/upload.md)                |
| "获取下载链接"/"获取直链"        | 运行 `media/file-token-to-url.js` 获取文件URL | `$SKILL_DIR/scripts/media/file-token-to-url.js` | [获取文件链接]($SKILL_DIR/references/media/file_token_to_url.md) |
| "获取访问凭证"/"刷新 token"      | 运行 `get-tenant-access-token.js` 获取凭证    | `$SKILL_DIR/scripts/get-tenant-access-token.js` | [获取访问凭证]($SKILL_DIR/references/get_tenant_access_token.md) |
| "解析飞书链接"                   | 运行 `parse-bitable-url.js` 解析 URL          | `$SKILL_DIR/scripts/parse-bitable-url.js`       | [解析飞书链接]($SKILL_DIR/references/parse_bitable_url.md)       |

## 决策流程

> **流程图的核心改动**：原流程是"想调用 → 直接调用"，现改为"想调用 → **先 Read 文档** → 再调用"。`Read doc` 是流程中的**第一个必经节点**，不可绕过。

**第1步：判断是否涉及飞书多维表格**
→ 否 → 不使用此 Skill
→ 是 → 确定要调用的脚本名（如 record/create.js），进入第2步

**第2步：【必经节点 1】Read 对应参考文档**
→ 运行 Read 读取 `$SKILL_DIR/references/<类别>/<操作>.md`
→ 已 Read？→ 在输出中 cite 文档路径，进入第3步
→ 未 Read？→ 立即 Read，不要继续

**第3步：准备访问凭证（如需要）**
→ 调 `get-tenant-access-token.js`（同样先 Read 对应文档）
→ 进入第4步

**第4步：准备资源标识（如需要）**
→ 调 `parse-bitable-url.js`（同样先 Read 对应文档）
→ 进入第5步

**第5步：【必经节点 2】cd 到 scripts 目录后执行**
→ 运行 `cd $SKILL_DIR/scripts && node <script-path>.js --parameter-file-path "..."`（PowerShell 用 `; if ($?) { }`）
→ 数据表操作 → `table/` 脚本
→ 记录操作 → `record/` 脚本
→ 字段操作 → `field/` 脚本
→ 素材操作 → `media/` 脚本

**关键约束**：

- 任何脚本（包括 `get-tenant-access-token.js`、`parse-bitable-url.js` 这两个"基础操作"）都**必须**经过第2步 Read 对应 reference
- Read 文档后必须能在输出中"cite 出文档路径"，否则视为未读
- 跳过 Read 直接写参数文件 = 流程违规（参考文档顶部"反面案例"）

## 全业务脚本索引清单

> 🚨 **执行任何脚本前，先 Read 对应参考文档（每个脚本的最右列链接），再 `cd $SKILL_DIR/scripts`，最后才运行脚本。** 没有例外。

### 基础能力

| 脚本                         | 功能                                           | 参考文档                                                         |
| ---------------------------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| `get-tenant-access-token.js` | 获取 `tenant_access_token`                     | [获取访问凭证]($SKILL_DIR/references/get_tenant_access_token.md) |
| `parse-bitable-url.js`       | 从 URL 提取 `app_token`、`table_id`、`view_id` | [解析飞书链接]($SKILL_DIR/references/parse_bitable_url.md)       |
| `clear_temp.js`              | 清理 `$SKILL_DIR/temp` 下的临时文件            | [参数配置示例与最佳实践]($SKILL_DIR/references/examples.md)      |

### 数据表操作（table/）

| 脚本               | 功能                                     | 参考文档                                                       |
| ------------------ | ---------------------------------------- | -------------------------------------------------------------- |
| `create-single.js` | 新增一个数据表，支持指定名称、视图和字段 | [创建单个数据表]($SKILL_DIR/references/table/create_single.md) |
| `batch-create.js`  | 新增多个数据表，仅可指定名称             | [批量创建数据表]($SKILL_DIR/references/table/batch_create.md)  |
| `update.js`        | 更新指定数据表的名称                     | [更新数据表]($SKILL_DIR/references/table/update.md)            |
| `list.js`          | 获取所有数据表的 ID、版本号和名称        | [列出数据表]($SKILL_DIR/references/table/list.md)              |
| `delete-one.js`    | 通过 `app_token` 和 `table_id` 删除      | [删除单个数据表]($SKILL_DIR/references/table/delete_one.md)    |
| `batch-delete.js`  | 批量删除多个数据表                       | [批量删除数据表]($SKILL_DIR/references/table/batch_delete.md)  |

### 记录操作（record/）

| 脚本              | 功能                                | 参考文档                                                     |
| ----------------- | ----------------------------------- | ------------------------------------------------------------ |
| `create.js`       | 在数据表中新增一条记录              | [创建记录]($SKILL_DIR/references/record/create.md)           |
| `update.js`       | 更新数据表中的一条记录              | [更新记录]($SKILL_DIR/references/record/update.md)           |
| `get.js`          | 查询记录，单次最多 500 行，支持分页 | [获取记录]($SKILL_DIR/references/record/get.md)              |
| `delete.js`       | 删除数据表中的一条记录              | [删除记录]($SKILL_DIR/references/record/delete.md)           |
| `batch-create.js` | 批量新增记录，单次最多 1,000 条     | [批量创建记录]($SKILL_DIR/references/record/batch_create.md) |
| `batch-update.js` | 批量更新记录，单次最多 1,000 条     | [批量更新记录]($SKILL_DIR/references/record/batch_update.md) |
| `batch-get.js`    | 通过记录 ID 查询，最多 100 条       | [批量获取记录]($SKILL_DIR/references/record/batch_get.md)    |
| `batch-delete.js` | 批量删除多条记录                    | [批量删除记录]($SKILL_DIR/references/record/batch_delete.md) |

### 字段操作（field/）

| 脚本        | 功能                              | 参考文档                                          |
| ----------- | --------------------------------- | ------------------------------------------------- |
| `create.js` | 在数据表中新增一个字段            | [创建字段]($SKILL_DIR/references/field/create.md) |
| `update.js` | 全量更新字段（property 会被覆盖） | [更新字段]($SKILL_DIR/references/field/update.md) |
| `list.js`   | 获取数据表中的所有字段            | [列出字段]($SKILL_DIR/references/field/list.md)   |
| `delete.js` | 删除数据表中的一个字段            | [删除字段]($SKILL_DIR/references/field/delete.md) |

### 素材/文件操作（media/）

| 脚本                   | 功能                                                                    | 参考文档                                                         |
| ---------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `upload.js`            | 上传文件、图片、视频等素材（无大小限制，脚本内部自动区分直传/分片上传） | [上传素材]($SKILL_DIR/references/media/upload.md)                |
| `file-token-to-url.js` | `file_token` 转临时下载链接（24小时有效）                               | [获取文件链接]($SKILL_DIR/references/media/file_token_to_url.md) |

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
    "field_id": "fldYWaldeW",   // 字段的 ID
    "field_name": "文本",        // 字段名称
    "type": 1,                  // 字段的类型
    "description": "字段的描述", // 对字段的更多说明
    "is_primary": true,         // 该字段是否是初始的索引字段
    "property": null,           // 字段的属性
    "ui_type": "Text",          // 字段在界面上的展示类型，例如进度字段是数字的一种展示形态
    "is_hidden": false          // 字段是否是隐藏字段
}
```

### 索引列（is_primary）

数据表中第一列为索引列，即 `is_primary: true` 的字段。索引列有以下限制：

| 约束项   | 说明                                                                     |
| -------- | ------------------------------------------------------------------------ |
| 不可删除 | 索引列不能被删除（调用 `field/delete.js` 会失败）                        |
| 不可移动 | 索引列的位置固定为第一列，不能移动                                       |
| 不可隐藏 | 索引列不能被设置为隐藏字段                                               |
| 可修改   | 索引列可以修改字段名称等属性，但修改字段类型时仅限以下几种类型           |

索引列修改字段类型时，仅支持以下类型：

| type 值 | 字段类型   |
| ------- | ---------- |
| 1       | 多行文本   |
| 2       | 数字       |
| 5       | 日期       |
| 13      | 电话号码   |
| 15      | 超链接     |

## AI 处理示例

**用户说**："帮我在飞书表格 https://xxx.feishu.cn/wiki/xxx 里添加一条记录，任务名称是'完成报告'，进度50%"

**AI 执行步骤**（每个脚本调用前都必须先 Read 对应文档，下表「已读证明」列需在输出中显式呈现）：

| 步骤 | 执行动作                            | 已读证明（必须显式 cite）                                                                 | 命令                                                                         |
| ---- | ----------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1    | 检查 tenant_access_token            | `已 Read references/get_tenant_access_token.md`                                           | 如无则 `cd $SKILL_DIR/scripts && node get-tenant-access-token.js ...`        |
| 2    | 解析 URL 获取 app_token 和 table_id | `已 Read references/parse_bitable_url.md`                                                 | `cd $SKILL_DIR/scripts && node parse-bitable-url.js ...`                     |
| 3    | 读取参考文档                        | `已 Read references/record/create.md`（重点：行 22-156 Schema + 行 162-193 文本格式警告） | 读取 `$SKILL_DIR/references/record/create.md`，按 JSON Schema 构造参数       |
| 4    | 创建临时参数文件                    | —                                                                                         | 存放在 `$SKILL_DIR/temp` 目录                                                |
| 5    | 创建记录                            | —                                                                                         | `cd $SKILL_DIR/scripts && node record/create.js --parameter-file-path "..."` |
| 6    | 清理临时参数文件                    | —                                                                                         | 完成用户需求或报错终止后，运行 `clear_temp.js` 清理 temp 目录                |
| 7    | 返回结果                            | —                                                                                         | 向用户返回："已成功创建记录！记录ID: recxxx"                                 |

**反例对照**（请勿重演，详见文档顶部"反面案例"小节）：

| 步骤 | ❌ 错误做法                                        | 后果                                                        |
| ---- | -------------------------------------------------- | ----------------------------------------------------------- |
| 1    | 直接 `cd ...; node get-tenant-access-token.js ...` | 可能漏传 `appId`/`appSecret`，脚本拒绝执行                  |
| 2    | 不读 `parse_bitable_url.md` 直接写 `{url: "..."}`  | 漏传 `tenant_access_token`，脚本返回"参数文件中必须包含..." |
| 3    | 不读 `record/create.md` 直接构造 fields            | 文本字段误用富文本数组格式，触发 `TextFieldConvFail`        |

**用户感知**：完全不需要知道临时文件的存在，只需自然语言交互。

## 全局错误处理

| 错误场景         | 错误表现                                                                      | 处理方式                                                                      |
| ---------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 缺少访问凭证     | API 返回 401/403 错误                                                         | 运行 `get-tenant-access-token.js` 获取凭证                                    |
| 访问凭证过期     | API 返回 错误代码: 99991663, 错误信息: Invalid access token for authorization | 运行 `get-tenant-access-token.js` 获取凭证                                    |
| URL 解析失败     | 无法提取 app_token/table_id                                                   | 检查 URL 格式是否正确，或手动提供参数                                         |
| 记录不存在       | API 返回 404 错误                                                             | 检查 record_id 是否正确，或先运行 `record/get.js` 查询                        |
| 字段类型不匹配   | API 返回 400 错误                                                             | 运行 `field/list.js` 查看字段类型，调整参数后重试                             |
| 文本字段格式错误 | `TextFieldConvFail` 错误                                                      | 文本字段写入使用字符串格式，不要用富文本数组格式                              |
| 字段更新缺少参数 | `field validation failed`                                                     | 更新字段时必须提供 `type` 和 `field_name` 参数                                |
| 文件token格式错  | `Cannot read properties`                                                      | 使用 `file_tokens`（数组）而非 `file_token`（字符串）                         |
| 批量操作超限     | API 返回 422 错误                                                             | 减少单次操作数量（创建/更新最多1000条，批量获取最多100条，批量删除最多500条） |
| 临时文件创建失败 | 磁盘空间不足或权限问题                                                        | 检查 `$SKILL_DIR/temp` 目录权限和磁盘空间                                     |
| 网络超时         | 请求无响应                                                                    | 检查网络连接，稍后重试                                                        |

> 字段读写格式差异、常见错误详解及测试记录参见 [常见错误及解决方案]($SKILL_DIR/references/errors.md) 与 [参数配置示例与最佳实践]($SKILL_DIR/references/examples.md)。

## 参考文档

| 文档                                                                 | 说明                                                                              |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [认证与凭证管理指南]($SKILL_DIR/references/authentication.md)        | 详细的凭证管理说明，包括 App ID/App Secret 获取、tenant_access_token 自动获取流程 |
| [获取访问凭证 API]($SKILL_DIR/references/get_tenant_access_token.md) | 获取 tenant_access_token 的具体 API 调用说明和脚本使用方法                        |
| [解析飞书 URL 工具]($SKILL_DIR/references/parse_bitable_url.md)      | 从飞书多维表格 URL 中提取 app_token、table_id、view_id 的工具使用说明             |
| [常见错误及解决方案]($SKILL_DIR/references/errors.md)                | API 调用常见错误码及排查方法                                                      |
| [参数配置示例与最佳实践]($SKILL_DIR/references/examples.md)          | 各种操作场景的参数配置示例、字段格式差异、临时文件管理详细流程                    |
