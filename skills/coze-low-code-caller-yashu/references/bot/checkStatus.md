# checkStatus - 查询状态

查询对话的执行状态，用于轮询等待智能体处理完成。

> ⚠️ **重要**：每个 API 都是**独立的脚本文件**，只能通过命令行直接运行，**不能**作为模块导入使用！

## 命令行调用

```bash
cd "$SKILL_DIR/scripts" && node check_status.js 7652343036010610715 7652343403598299174
```

> ⚠️ **必须先 cd 到 scripts 目录！** 例如：
>
> ```bash
> cd "$SKILL_DIR/scripts" && node check_status.js 7652343036010610715 7652343403598299174
> ```

## 参数

| 参数名            | 类型   | 必填 | 说明                                 |
| ----------------- | ------ | ---- | ------------------------------------ |
| `conversation_id` | string | 是   | 会话 ID，由 `create_session.js` 返回 |
| `chat_id`         | string | 是   | 对话 ID，由 `send_message.js` 返回   |

---

## 操作步骤

### 步骤 1：发送消息后获取 chat_id

发送消息后，会返回 `conversation_id` 和 `chat_id`：

```json
{
  "chat_id": "7652343403598299174",
  "conversation_id": "7652343036010610715"
}
```

### 步骤 2：查询状态

```bash
cd "$SKILL_DIR/scripts" && node check_status.js 7652343036010610715 7652343403598299174
```

### 步骤 3：判断状态

**返回值：**

```json
{ "status": "completed" }
```

**状态判断：**

| status 值       | 含义   | 后续操作                                       |
| --------------- | ------ | ---------------------------------------------- |
| `"completed"`   | 已完成 | 停止轮询，调用 `get_messages.js` 获取回复      |
| `"in_progress"` | 进行中 | 继续轮询，等待 `POLLING_INTERVAL` 秒后再次调用 |

### 步骤 4：持续轮询（如果状态为 in_progress）

如果状态为 `in_progress`，需要重复查询：

```bash
# 等待一段时间后再次查询
cd "$SKILL_DIR/scripts" && node check_status.js 7652343036010610715 7652343403598299174
```

循环执行直到状态变为 `completed`。

轮询间隔时间从以下配置文件读取：

| 配置文件 | 路径              |
| -------- | ----------------- |
| `.env`   | `$SKILL_DIR/.env` |

| 配置项             | 默认值  | 说明                   |
| ------------------ | ------- | ---------------------- |
| `POLLING_INTERVAL` | 5（秒） | 每次轮询之间的等待时间 |

## 调用示例

```bash
# 查询状态
cd "$SKILL_DIR/scripts" && node check_status.js 7651243864586878991 7651251220132708392
# 输出: { "status": "in_progress" } 或 { "status": "completed" }

# 如果是 in_progress，重复调用直到 completed
cd "$SKILL_DIR/scripts" && node check_status.js 7651243864586878991 7651251220132708392
# 输出: { "status": "completed" }
```

## 注意事项

1. 执行命令前必须先 `cd` 到 scripts 目录
2. 当 `status` 为 `completed` 时，脚本会自动将本次端到端耗时（从创建会话到任务完成）记录到 `$SKILL_DIR/config/bots.json` 对应智能体的 `recent_durations` 字段中
