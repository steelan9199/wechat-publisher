# Markdown 上传到飞书文档

> ⚠️ **强制规则**：执行脚本前必须先阅读本文档，严格按照参数名和格式编写参数文件，禁止凭记忆编写参数。

## 概述

将本地 Markdown 文件上传到飞书文档，支持文本、标题、列表、表格、图片、代码块、引用等常见 Markdown 元素。

## 工作流程

### Callout格式规范

脚本代码内部，要求 Callout 必须使用 Markdown 引用块语法，即 Callout 的每一行都必须以 `>` 开头。

#### 正确格式

```markdown
> [!bulb]
> 这是一个提示类型的 Callout，用于展示提示信息。

> [!warning]
> 这是一个警告类型的 Callout，用于展示警告信息。
```

#### 错误格式

```markdown
[!bulb] 这是一个提示 Callout。
[!warning] 这是一个警告 Callout。
```

#### AI 预处理规则

Callout 的格式修正与语义类型转换**必须由 AI 在会话层完成**。AI 执行上传前应按以下步骤预处理：

1. 扫描待上传的 Markdown 文件，识别所有不以 `>` 开头但包含 `[!type]` 的 Callout 行。
2. 将错误格式修正为标准引用块格式（为 `[!type]` 行添加 `>` 前缀）。
3. 将所有非标准语义 `type` 按语义映射表转换为飞书支持的标准 `emoji_id`（例如 `[!think]` -> `[!thinking_face]`）。
4. 将处理后的内容写入 `$SKILL_DIR/temp/` 下的临时 Markdown 文件，**不要修改原始文件**。
5. 将临时 Markdown 文件路径传给上传脚本继续上传。

> ⚠️ **注意**：脚本不会修改 Callout 格式或执行语义转换。

---

#### ⚠️ 临时文件图片资源处理（强制，极易遗漏）

> **这是最容易出错的一步，必须严格执行，否则上传必定失败。**

**问题根因**：Markdown 中的图片通常使用相对路径引用（如 `![](image.png)`），路径相对于 Markdown 文件所在目录解析。当 AI 将处理后的内容写入 `$SKILL_DIR/temp/` 下的临时文件时，临时文件所在目录与原始文件所在目录不同，导致相对路径指向的图片在临时目录中找不到，脚本会报错 "图片文件不存在" 并中断上传。

**强制操作**：在执行上述步骤 4（写入临时 Markdown 文件）时，**必须同步完成以下操作**：

1. 扫描原始 Markdown 文件中所有图片引用，提取图片文件名（相对路径）。
2. 将这些图片文件从**原始 Markdown 文件所在目录**复制到**临时 Markdown 文件所在目录**（即 `$SKILL_DIR/temp/`）。
3. 确认复制完成后，再执行步骤 5 将临时文件路径传给脚本。

**示例**：

```
原始文件路径: D:/articles/my-article.md
原始图片位置: D:/articles/image1.png
临时文件路径: $SKILL_DIR/temp/my-article_upload.md

✅ 正确操作：将 D:/articles/image1.png 复制到 $SKILL_DIR/temp/image1.png
❌ 错误操作：只写临时文件，不复制图片，导致 $SKILL_DIR/temp/image1.png 不存在
```

> ⚠️ **再次强调**：每次创建临时 Markdown 文件时，都必须同时复制图片。这不是可选步骤，而是写入临时文件的必要配套操作。

### Callout格式特殊处理

飞书文档支持`[!type]`格式的Callout标识，但要求`type`必须是飞书官方限定的emoji id。上传前必须自动完成**语义类型匹配转换**：将用户常用的语义化type单词（如`think`、`note`、`tip`等）自动映射到飞书支持的标准emoji id。

- 处理逻辑：自动扫描待上传的Markdown文件，将所有不在飞书emoji id列表中的语义化`[!type]`标识，按照语义映射表自动转换为飞书支持的标准emoji id格式（例如：`[!think]` → `[!thinking_face]`）
- ⚠️ **重要规则**：语义转换只能由AI在会话层完成，禁止使用任何代码脚本进行语义转换，因为代码没有语义理解能力，无法准确匹配上下文语义

#### 语义匹配优先级规则

| 语义场景                      | 对应飞书Emoji ID                     |
| ----------------------------- | ------------------------------------ |
| 思考/分析/疑问/需要解答       | `thinking_face`/`question`           |
| 提示/建议/灵感/解决方案       | `bulb`                               |
| 警告/注意/风险/提醒           | `warning`/`exclamation`/`clock`      |
| 成功/完成/正确/通过/赞同/优秀 | `white_check_mark`/`+1`/`fire`/`100` |
| 错误/失败/取消/不可用         | `x`                                  |
| 对话/评论/讨论/备注           | `speech_balloon`/`memo`              |
| 日期/计划/日程/待办           | `calendar`                           |
| 标记/收藏/重要位置            | `bookmark`                           |
| 无法明确语义                  | `memo`（默认）                       |

#### 支持的标准emoji_id列表（脚本仅支持这些ID）

| Emoji ID           | 用途说明                   |
| ------------------ | -------------------------- |
| `thinking_face`    | 思考、分析、需要进一步考虑 |
| `bulb`             | 想法、灵感、解决方案提示   |
| `warning`          | 警告、注意事项、潜在风险   |
| `exclamation`      | 重要提醒、强调、紧急事项   |
| `question`         | 疑问、需要解答的问题       |
| `white_check_mark` | 完成、正确、已验证         |
| `x`                | 错误、取消、不可用         |
| `+1`               | 赞同、支持、点赞           |
| `fire`             | 热门、重要、紧急、优秀     |
| `100`              | 完美、满分、最佳           |
| `speech_balloon`   | 对话、评论、讨论           |
| `memo`             | 笔记、记录、备忘录         |
| `calendar`         | 日期、计划、日程           |
| `clock`            | 时间、提醒、截止日期       |
| `bookmark`         | 标记、收藏、重要位置       |

## 标准任务执行清单（严格按顺序执行）

| 步骤 | 任务内容                                                                                                                                                 | 验证标准                                                                                                                                                                                                                                                                   |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | 读取 `$SKILL_DIR/config.default.json` 文件，获取 `appId`、`appSecret`、`tenant_access_token` 凭证信息                                                    | 凭证字段完整且非空，无需手动输入或向用户索要已存在的凭证                                                                                                                                                                                                                   |
| 2    | AI 预处理 Callout：扫描待上传的 Markdown 文件，修正不规范 Callout 格式，并将所有非标准 `[!type]` 标识按语义映射表转换为标准 `emoji_id`，结果写入临时文件 | AI 已完成 Callout 格式修正（所有 `[!type]` 行均为 `>` 开头的引用块格式）；所有 `type` 均属于飞书支持的标准 `emoji_id` 列表；原始 Markdown 文件未被修改；**已将原始文件目录中的图片资源复制到临时文件目录**（见上方"临时文件图片资源处理"章节）；临时文件路径已正确传给脚本 |
| 3    | 在 `$SKILL_DIR/temp/` 目录下创建JSON参数文件                                                                                                             | 必须包含必填参数：<br>- `tenant_access_token`：从配置文件复制<br>- `markdown_file_path`：本地Markdown文件的正斜杠绝对路径（**禁止使用别名如markdownFilePath/md_path等**）<br>可选参数根据需要添加，所有参数名严格与文档规范一致                                            |
| 4    | 执行上传脚本                                                                                                                                             | 必须先 `cd $SKILL_DIR/scripts`，再使用 `--parameter-file-path` 参数传递配置文件的绝对路径                                                                                                                                                                                  |
| 5    | 处理执行结果                                                                                                                                             | 成功：返回文档链接、文档ID和上传统计信息<br>失败：根据错误码匹配解决方案，自动重试或提示用户                                                                                                                                                                               |

### 常见异常处理清单

| 异常场景                       | 自动处理方案                                                                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 访问令牌过期（错误码99991663） | 运行 `cd $SKILL_DIR/scripts; if ($?) { node get-tenant-access-token.js --parameter-file-path <参数文件绝对路径> }` 刷新令牌，更新参数文件后重试 |
| Callout格式不规范              | 由 AI 在预处理阶段修正为标准引用块格式，写入临时文件后重新上传；脚本仅做校验，不再自动修正                                                      |
| Callout标识不合法              | 由 AI 在预处理阶段按照语义映射表转换所有非标准标识，写入临时文件后重新上传；脚本仅做校验，不再自动转换                                          |
| 文档所有权转移失败             | 正常返回文档链接，提示用户手动申请访问权限                                                                                                      |
| 本地图片不存在                 | 脚本会**中断上传流程**并报错，不会创建任何飞书文档。AI 应在预处理阶段确保所有图片已复制到临时文件目录（见上方"临时文件图片资源处理"章节）       |

## 脚本使用规范

### ⚠️ 重要：脚本执行工作目录要求

**所有脚本执行前必须先 `cd` 到 `$SKILL_DIR/scripts` 目录**，再运行命令。

- ✅ **正确做法**：`cd $SKILL_DIR/scripts; if ($?) { node markdown-to-feishu.js --parameter-file-path <参数文件绝对路径> }`
- ❌ **错误做法**：在技能根目录或其他目录下直接通过 `node scripts/markdown-to-feishu.js` 执行，会导致内部相对路径引用错误

### ⚠️ 重要：路径规范

- ✅ **必须使用绝对路径**：`--parameter-file-path` 的值必须是文件的绝对路径
- ✅ **必须使用正斜杠**：路径分隔符必须使用正斜杠 `/`，不要使用反斜杠 `\`
- ✅ **统一放在 temp 目录**：所有临时文件统一放在 `$SKILL_DIR/temp` 目录中

### 工具说明

- **文件写入工具**：用于将参数内容写入临时JSON文件
- **命令执行工具**：用于执行Node.js脚本
- **文件删除工具**：用于清理临时参数文件

### 输出格式

执行完成后，输出：

- **成功**：返回操作结果数据（JSON 格式），包含完整的 API 响应，文档链接、文档ID和上传统计信息
- **失败**：返回错误信息，包含错误码和解决建议

## 脚本使用方式

### 命令行调用

```bash
cd $SKILL_DIR/scripts; if ($?) { node markdown-to-feishu.js --parameter-file-path <参数文件绝对路径> }
```

### 参数文件格式

```json
{
  "tenant_access_token": "t-xxx",
  "markdown_file_path": "D:/path/to/article.md",
  "document_id": "",
  "title": "文章标题",
  "table_column_widths": [120, 120, 120],
  "image_max_width": 500,
  "image_max_height": 500
}
```

### 参数说明

> ⚠️ **强制规则**：所有参数名必须严格与下表中"参数名"列完全一致，不得使用任何别名、缩写或大小写变体，否则脚本会报错。

| 参数名              | 类型   | 必填 | 说明                                     | 默认值          |
| ------------------- | ------ | ---- | ---------------------------------------- | --------------- |
| tenant_access_token | string | yes  | 飞书应用访问令牌                         | -               |
| markdown_file_path  | string | yes  | 本地 Markdown 文件路径                   | -               |
| document_id         | string | no   | 飞书文档 ID（不填则创建新文档）          | 创建新文档      |
| title               | string | no   | 文档标题（创建新文档时使用）             | Markdown 文件名 |
| table_column_widths | array  | no   | 表格列宽（像素）                         | [120, 120, 120] |
| image_max_width     | number | no   | 图片最大宽度（像素）                     | 500             |
| image_max_height    | number | no   | 图片最大高度（像素）                     | 500             |
| image_align         | number | no   | 图片对齐方式：1=左对齐，2=居中，3=右对齐 | 2               |
| heading1_color      | number | no   | 一级标题颜色（颜色值参考下方说明）       | 默认黑色        |
| heading2_color      | number | no   | 二级标题颜色（颜色值参考下方说明）       | 默认黑色        |
| heading3_color      | number | no   | 三级标题颜色（颜色值参考下方说明）       | 默认黑色        |
| heading4_color      | number | no   | 四级标题颜色（颜色值参考下方说明）       | 默认黑色        |
| heading5_color      | number | no   | 五级标题颜色（颜色值参考下方说明）       | 默认黑色        |
| heading6_color      | number | no   | 六级标题颜色（颜色值参考下方说明）       | 默认黑色        |
| bold_color          | number | no   | 粗体文字颜色（颜色值参考下方说明）       | 默认黑色        |
| italic_color        | number | no   | 斜体文字颜色（颜色值参考下方说明）       | 默认黑色        |
| bold_italic_color   | number | no   | 粗斜体文字颜色（颜色值参考下方说明）     | 默认黑色        |

### 颜色值说明

所有颜色参数使用数字值，可选值如下：
| 数值 | 颜色 |
|------|------|
| 1 | 红色 |
| 2 | 橙色 |
| 3 | 黄色 |
| 4 | 绿色 |
| 5 | 蓝色 |
| 6 | 紫色 |
| 7 | 灰色 |

## 使用示例

### 示例 1：上传 Markdown 到新文档

```json
{
  "tenant_access_token": "t-g104362q5GLRTWIMYKCYDA47CPOCMKJT74FXIJRH",
  "markdown_file_path": "D:/articles/my-article.md",
  "title": "我的文章"
}
```

### 示例 2：上传到已有文档

```json
{
  "tenant_access_token": "t-g104362q5GLRTWIMYKCYDA47CPOCMKJT74FXIJRH",
  "markdown_file_path": "D:/articles/my-article.md",
  "document_id": "doxcnePuYufKa49ISjhD8Iabcef"
}
```

### 示例 3：使用自定义配置

```json
{
  "tenant_access_token": "t-g104362q5GLRTWIMYKCYDA47CPOCMKJT74FXIJRH",
  "markdown_file_path": "D:/articles/my-article.md",
  "title": "我的文章",
  "table_column_widths": [120, 120, 120],
  "image_max_width": 500,
  "image_max_height": 500
}
```

---

## 注意事项

1. **图片路径**：Markdown 中的图片路径相对于 Markdown 文件所在目录。使用临时文件上传时，**必须将图片复制到临时文件所在目录**（详见上方"临时文件图片资源处理"章节），否则脚本会因找不到图片而中断上传
2. **图片格式**：支持常见图片格式（PNG、JPG、JPEG）
3. **权限要求**：需要创建及编辑新版文档权限
