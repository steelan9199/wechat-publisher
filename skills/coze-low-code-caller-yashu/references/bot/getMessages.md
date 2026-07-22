# getMessages - 获取回复

获取智能体的回复消息，在 `check_status.js` 返回 `status === "completed"` 后调用。

> ⚠️ **重要**：每个 API 都是**独立的脚本文件**，只能通过命令行直接运行，**不能**作为模块导入使用！

## 命令行调用

```bash
cd $SKILL_DIR/scripts; node get_messages.js 7652343036010610715 7652343403598299174
```

> ⚠️ **必须先 cd 到 scripts 目录！** 例如：
>
> ```bash
> cd $SKILL_DIR/scripts; node get_messages.js 7652343036010610715 7652343403598299174
> ```

## 参数

| 参数名            | 类型   | 必填 | 说明                                 |
| ----------------- | ------ | ---- | ------------------------------------ |
| `conversation_id` | string | 是   | 会话 ID，由 `create_session.js` 返回 |
| `chat_id`         | string | 是   | 对话 ID，由 `send_message.js` 返回   |

---

## 操作步骤

### 前提条件

> ⚠️ **重要**：必须先确认智能体处理完成，再调用此 API！

先用 `check_status.js` 查询状态，确保返回 `status === "completed"`：

```bash
cd $SKILL_DIR/scripts; node check_status.js 7652343036010610715 7652343403598299174
# 输出: { "status": "completed" }
```

### 执行获取

确认状态为 `completed` 后，执行获取回复：

```bash
cd $SKILL_DIR/scripts; node get_messages.js 7652343036010610715 7652343403598299174
```

### 解析返回值

**返回：**

```json
{ "content": "好的，2026 年 06 月 17 日 20 时 40 分 42 秒" }
```

**字段说明：**

| 字段名    | 类型   | 说明                         |
| --------- | ------ | ---------------------------- |
| `content` | string | 智能体的回复文本（用户可见） |

---

## 使用场景

- 仅在 `check_status.js` 返回 `status === "completed"` 后才可调用
- `content` 字段是用户最终看到的回复内容

## 调用示例

```bash
# 假设 conversation_id = 7652343036010610715, chat_id = 7652343403598299174
cd $SKILL_DIR/scripts; node get_messages.js 7652343036010610715 7652343403598299174
# 输出: { "content": "好的，2026 年 06 月 17 日 20 时 40 分 42 秒" }
```
