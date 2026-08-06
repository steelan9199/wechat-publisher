# sendMessage - 发送消息

向智能体发送消息，支持纯文本或带附件（图片/文件/音频）。

> ⚠️ **重要**：每个 API 都是**独立的脚本文件**，只能通过命令行直接运行，**不能**作为模块导入使用！

---

## 🚨 常见错误警示（必读）

**为什么必须是 `path` 字段？**

`send_message.js` 脚本内部按固定字段名解析 JSON：只读取 `path` 和 `files` 两个字段。如果用 `query`、`message` 等字段名，脚本在校验阶段就会报错 `参数错误：JSON 中缺少或无效的 'path' 字段`，因为脚本根本不会去读取这些字段。这不是约定俗成的习惯，而是脚本代码的硬性要求。

**错误写法（会导致失败）：**

```json
// ❌ 错误做法 1：将 query 作为 JSON 的根级字段
{ "query": "你好，请介绍一下你自己" }
// → 脚本只认 "path"，不认 "query"，校验失败

// ❌ 错误做法 2：将消息内容直接写在 JSON 中
{ "message": "你好" }
// → 同上，"message" 字段会被忽略
```

**正确写法：**

```json
// ✅ 正确做法：使用 "path" 字段指向用户问题文件
{
  "path": "$SKILL_DIR/temp/user_input.txt"
}
```

> ⚠️ **关键点**：参数 JSON 中**必须**包含 `path` 字段，指向一个包含用户问题的 `.txt` 文件。**不要**使用 `query`、`message`、`text` 等其他字段名！

---

## 命令行调用

```bash
cd "$SKILL_DIR/scripts" && node send_message.js <conversation_id> <param_json_absolute_path>
```

> ⚠️ **必须先 cd 到 scripts 目录！** 例如：
>
> ```bash
> cd "$SKILL_DIR/scripts" && node send_message.js 7652343036010610715 $SKILL_DIR/temp/send_msg_param.json
> ```

## ⚠️ 重要：必须使用绝对路径

- `param_json_absolute_path` 必须是 **绝对路径**（如 `$SKILL_DIR/temp/param.json`）
- 不能使用相对路径（如 `temp/param.json` 或 `param.json`），否则脚本将无法找到文件
- 原因：脚本从 `$SKILL_DIR/scripts` 目录执行，相对路径会基于该目录解析

## 参数

| 参数名                     | 类型   | 必填 | 说明                                 |
| -------------------------- | ------ | ---- | ------------------------------------ |
| `conversation_id`          | string | 是   | 会话 ID，由 `create_session.js` 返回 |
| `param_json_absolute_path` | string | 是   | 参数 JSON 文件的**绝对路径**         |

### param_json 文件格式

**纯文本（必填字段）：**

```json
{
  "path": "$SKILL_DIR/temp/your_question.txt"
}
```

| 字段   | 类型   | 必填 | 说明                           |
| ------ | ------ | ---- | ------------------------------ |
| `path` | string | 是   | 用户问题文本文件的**绝对路径** |

> ⚠️ **重要**：`path` 必须指向一个包含用户问题的 `.txt` 文件，文件内容就是你想发送给智能体的消息。

### 校验规则

- `path` **必填**，且必须是**绝对路径**
- 如果 `files` 数组长度 > 0，则 `path` 指向的文本文件**不能为空字符串**，否则报错："上传文件、图片或音频时，必须附带文字说明"

### 带图片/文件时的格式

当需要发送图片、文件或音频时，在 JSON 中添加 `files` 数组：

```json
{
  "path": "$SKILL_DIR/temp/your_description.txt",
  "files": [
    { "type": "image", "file_url": "https://example.com/photo.jpg" },
    {
      "type": "file",
      "file_id": "xxx",
      "file_url": "https://example.com/doc.pdf"
    },
    { "type": "audio", "file_id": "xxx" }
  ]
}
```

| 字段               | 类型         | 必填                | 说明                                     |
| ------------------ | ------------ | ------------------- | ---------------------------------------- |
| `path`             | string       | 是                  | 文字说明文件的**绝对路径**（不能为空）   |
| `files`            | object array | 否                  | 文件附件列表                             |
| `files[].type`     | string       | 是（当files存在时） | 文件类型：`image` / `file` / `audio`     |
| `files[].file_id`  | string       | 否                  | 用 `upload_file.js` 上传后返回的文件 ID  |
| `files[].file_url` | string       | 否                  | 文件的在线地址，必须可公开访问           |
| `files` 中每个元素 | -            | -                   | **`file_id` 和 `file_url` 至少要有一个** |

## 返回

| 字段名            | 类型   | 说明    | 用于后续哪一步                                           |
| ----------------- | ------ | ------- | -------------------------------------------------------- |
| `chat_id`         | string | 对话 ID | 作为 `check_status.js` 和 `get_messages.js` 的第二个参数 |
| `conversation_id` | string | 会话 ID | 作为 `check_status.js` 和 `get_messages.js` 的第一个参数 |

```json
{
  "chat_id": "7651251220132708392",
  "conversation_id": "7651243864586878991"
}
```

## 调用示例

> ⚠️ **重要**：所有临时文件必须放在 `$SKILL_DIR/temp` 目录下！

### 纯文本

先创建问题文件 `my_question.txt`（放在 temp 目录）：

```
你好，请介绍一下自己
```

再创建参数 JSON 文件 `send_msg_param.json`（放在 temp 目录），指向问题文件：

```json
{
  "path": "$SKILL_DIR/temp/my_question.txt"
}
```

然后运行（第二个参数使用**绝对路径**，指向参数 JSON 文件）：

```bash
cd "$SKILL_DIR/scripts" && node send_message.js 7651243864586878991 $SKILL_DIR/temp/send_msg_param.json
# 输出: { "chat_id": "...", "conversation_id": "..." }
```

### 带图片

先创建参数文件 `param.json`（放在 temp 目录，使用绝对路径）：

```json
{
  "path": "$SKILL_DIR/temp/请分析这张图片.txt",
  "files": [{ "type": "image", "file_url": "https://example.com/photo.jpg" }]
}
```

然后运行（第二个参数使用**绝对路径**）：

```bash
cd "$SKILL_DIR/scripts" && node send_message.js 7651243864586878991 $SKILL_DIR/temp/param.json
# 输出: { "chat_id": "...", "conversation_id": "..." }
```
