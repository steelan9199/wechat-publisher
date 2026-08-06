# Bot API 调用索引

> ⚠️ **重要**：每个 API 都是**独立的脚本文件**，只能通过命令行直接运行，**不能**作为模块导入使用！

## 🚨 关键警示（必读）

> ⚠️ **最容易犯的错误**：在创建参数 JSON 文件时，使用了 `{"query": "..."}` 而不是 `{"path": "xxx"}`
>
> **正确格式**：
>
> ```json
> {
>   "path": "$SKILL_DIR/temp/user_input.txt"
> }
> ```
>
> **禁止使用**：`query`、`message`、`text` 等其他字段名！否则会报错：`参数错误：JSON 中缺少或无效的 'path' 字段`

---

## ⚠️ 重要：必须使用绝对路径

- 所有参数 JSON 文件路径必须使用**绝对路径**（如 `$SKILL_DIR/temp/param.json`）
- 原因：脚本从 `$SKILL_DIR/scripts` 目录执行，相对路径会基于该目录解析
- 临时文件必须放在 `$SKILL_DIR/temp` 目录下

## 调用流程

| 步骤 | 脚本                | 功能     | 命令格式                                                                                  | 输出字段                     |
| ---- | ------------------- | -------- | ----------------------------------------------------------------------------------------- | ---------------------------- |
| 1    | `create_session.js` | 创建会话 | `cd "$SKILL_DIR/scripts" && node create_session.js <bot_id>`                              | `conversation_id`            |
| 2    | `send_message.js`   | 发送消息 | `cd "$SKILL_DIR/scripts" && node send_message.js <conversation_id> <绝对路径/param.json>` | `chat_id`, `conversation_id` |
| 3    | `check_status.js`   | 查询状态 | `cd "$SKILL_DIR/scripts" && node check_status.js <conversation_id> <chat_id>`             | `status`                     |
| 4    | `get_messages.js`   | 获取回复 | `cd "$SKILL_DIR/scripts" && node get_messages.js <conversation_id> <chat_id>`             | `content`                    |

---

## 📋 操作步骤：从零开始调用智能体

> ⚠️ **重要**：所有临时文件必须放在 `$SKILL_DIR/temp` 目录下，使用绝对路径！

### 步骤 0：读取配置（前置）

确保已按 [SKILL.md 前置条件](../../SKILL.md) 完成以下配置读取：

1. 读取 `$SKILL_DIR/.env`，确认 `COZE_API_KEY` 和 `COZE_SPACE_ID` 已配置
2. 读取 `$SKILL_DIR/config/bots.json`，确认智能体已配置

### 步骤 1：创建会话

开启与智能体的对话：

```bash
cd "$SKILL_DIR/scripts" && node create_session.js 7651224745501376564
```

**输出：**

```json
{
  "conversation_id": "7652343036010610715"
}
```

**保存好 `conversation_id`**，用于下一步发送消息。

### 步骤 2：发送消息

发送消息前，需要准备两个文件：

#### 2.1 创建用户问题文件

将用户的问题保存为 `.txt` 文件（放在 temp 目录）：

**文件：** `$SKILL_DIR/temp/user_input.txt`

**内容：**

```
今天天气怎么样？
```

#### 2.2 创建参数文件

参数文件告诉脚本用户的问题在哪里：

**文件：** `$SKILL_DIR/temp/send_msg_param.json`

**内容：**

```json
{
  "path": "$SKILL_DIR/temp/user_input.txt"
}
```

> ⚠️ **关键点**：`path` 必须指向包含用户问题的 `.txt` 文件的**绝对路径**。

#### 2.3 执行发送

```bash
cd "$SKILL_DIR/scripts" && node send_message.js 7652343036010610715 $SKILL_DIR/temp/send_msg_param.json
```

**输出：**

```json
{
  "chat_id": "7652343403598299174",
  "conversation_id": "7652343036010610715"
}
```

**保存好 `chat_id`**，用于后续步骤。

### 步骤 3：检查状态

轮询检查任务执行状态：

```bash
cd "$SKILL_DIR/scripts" && node check_status.js 7652343036010610715 7652343403598299174
```

**输出：**

```json
{
  "status": "in_progress"
}
```

重复执行，直到状态变为 `completed`：

```json
{
  "status": "completed"
}
```

### 步骤 4：获取回复

当状态变为 `completed` 后，获取智能体的回复：

```bash
cd "$SKILL_DIR/scripts" && node get_messages.js 7652343036010610715 7652343403598299174
```

**输出：**

```json
{
  "content": "好的，2026 年 06 月 17 日 20 时 40 分 42 秒"
}
```

---

## send_message.js 参数文件格式

根据用户输入类型不同，参数 JSON 有两种格式：

### 格式 1：纯文字输入

```json
{
  "path": "$SKILL_DIR/temp/your_question.txt"
}
```

- `path`：**必填**。必须是**绝对路径**，指向包含问题内容的文本文件。
- **为什么要用文本文件？** 为了避免用户输入中包含特殊字符（如 `"` `$` `\` 等）导致终端命令解析错误

### 格式 2：文字 + 文件（图片/音频/文档）

当需要发送图片、文件或音频时，在 JSON 中添加 `files` 数组：

```json
{
  "path": "$SKILL_DIR/temp/你的说明.txt",
  "files": [
    { "type": "image", "file_id": "xxx" },
    { "type": "file", "file_url": "https://..." },
    { "type": "audio", "file_id": "xxx", "file_url": "https://..." }
  ]
}
```

- `path`：**必填**。必须是**绝对路径**，指向包含文字说明的文本文件
- `files`：可选。文件附件列表
  - `type`：**必填**。文件类型：`image` / `file` / `audio`
  - `file_id`：可选。用 `upload_file.js` 上传后返回的文件 ID
  - `file_url`：可选。文件的在线地址，必须可公开访问
  - **`file_id` 和 `file_url` 至少要有一个**
- 带文件时，`path` 指向的文本文件**不能为空**，否则 API 会报错

> ⚠️ **重要**：带文件时，文字说明不能为空，否则 API 会报错。

---

## 详细文档

| 脚本                | 文档                                                   |
| ------------------- | ------------------------------------------------------ |
| `create_session.js` | [创建会话]($SKILL_DIR/references/bot/createSession.md) |
| `send_message.js`   | [发送消息]($SKILL_DIR/references/bot/sendMessage.md)   |
| `check_status.js`   | [查询状态]($SKILL_DIR/references/bot/checkStatus.md)   |
| `get_messages.js`   | [获取回复]($SKILL_DIR/references/bot/getMessages.md)   |

---

## 常见错误

| 错误信息                                    | 原因                              | 正确用法                                                          |
| ------------------------------------------- | --------------------------------- | ----------------------------------------------------------------- |
| `Cannot find module '...create_session.js'` | 未先 cd 到 scripts 目录就运行脚本 | 执行 `cd "$SKILL_DIR/scripts" && node create_session.js <bot_id>` |
| `参数错误：JSON 中缺少或无效的 'path' 字段` | 参数文件格式错误                  | 使用 `{"path": "绝对路径"}` 格式                                  |
| `参数错误：第二个参数必须是 JSON 文件路径`  | 传递了 `.txt` 或其他非 JSON 文件  | 第二个参数必须是 JSON 文件的绝对路径                              |
| `用户输入文件不存在`                        | path 指向的文件不存在             | 使用绝对路径，确保文件存在                                        |
