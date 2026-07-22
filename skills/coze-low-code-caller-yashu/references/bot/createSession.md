# createSession - 创建会话

创建与智能体的会话，获取 `conversation_id` 后可用来发送消息。

> ⚠️ **重要**：每个 API 都是**独立的脚本文件**，只能通过命令行直接运行，**不能**作为模块导入使用！

## 命令行调用

```bash
cd $SKILL_DIR/scripts; node create_session.js <bot_id>
```

> ⚠️ **必须先 cd 到 scripts 目录！** 例如：
>
> ```bash
> cd $SKILL_DIR/scripts; node create_session.js 7651224745501376564
> ```

## 参数

| 参数名   | 类型   | 必填 | 说明                                           |
| -------- | ------ | ---- | ---------------------------------------------- |
| `bot_id` | string | 是   | 智能体 ID，AI 从 `config/bots.json` 中匹配获取 |

---

## 参考说明：什么是智能体 ID

> **智能体 ID**，获取方法如下：
>
> 进入智能体的开发页面，开发页面 URL 中 bot 参数后的数字就是智能体 ID。例如 `https://www.coze.cn/space/341****/bot/73428668*****`，智能体 ID 为 `73428668*****`。

---

## 操作步骤

### 步骤 1：获取智能体 ID

AI 应从配置文件 `$SKILL_DIR/config/bots.json` 中获取智能体 ID，匹配规则如下：

1. 读取 `bots.json` 中 `bots` 数组，查看每个对象的 `name` 和 `description` 字段
2. 根据用户的任务描述，选择匹配度最高的 bot
3. 使用该 bot 的 `id` 字段作为 `bot_id`
4. **透明告知**用户：说明选择了哪个 bot（name）以及匹配理由

**用户交互场景：**

- **用户不知道什么是智能体 ID**：引导用户查看上方「参考说明：什么是智能体 ID」小节
- **用户想修改智能体 ID**：告知用户前往 `$SKILL_DIR/config/bots.json`，修改对应 bot 对象的 `id` 字段

### 步骤 2：执行创建会话

```bash
cd $SKILL_DIR/scripts; node create_session.js 7651224745501376564
```

### 步骤 3：保存 conversation_id

**返回值：**

```json
{
  "conversation_id": "7652343036010610715"
}
```

> ⚠️ **重要**：必须保存好 `conversation_id`，后续发送消息需要用到。

---

## 返回

| 字段名            | 类型   | 说明    | 用于后续哪一步                      |
| ----------------- | ------ | ------- | ----------------------------------- |
| `conversation_id` | string | 会话 ID | 作为 `send_message.js` 的第一个参数 |

```json
{ "conversation_id": "7651243864586878991" }
```

## 调用示例

```bash
cd $SKILL_DIR/scripts; node create_session.js 7651224745501376564
# 输出: { "conversation_id": "7651243864586878991" }
```

## 注意事项

1. 执行命令前必须先 `cd` 到 scripts 目录
2. 每次与智能体对话都需要创建新的会话
3. conversation_id 有效期有限，如过期需要重新创建
