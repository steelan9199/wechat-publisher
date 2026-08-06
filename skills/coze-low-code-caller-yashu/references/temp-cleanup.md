# 清理 temp 文件夹

## 概述

在完成用户请求并将结果交付给用户后，AI 执行清理 `$SKILL_DIR/temp` 目录下的临时文件，以防止文件堆积。

脚本在运行过程中会产生临时文件（如参数文件、上传的附件等），长期积累会导致目录混乱且占用磁盘空间。

## 清理时机

- **执行时机**：每次独立请求完成、结果交付给用户**之后**执行
- **执行频率**：一问一清 — 每完成一次用户请求（如调用一次智能体或工作流并交付结果），执行一次清理

## AI 执行步骤

每次完成用户请求并将结果交付后，AI 执行以下清理操作：

1. 执行 `node clear_temp.js`

> ⚠️ **必须先 cd 到 scripts 目录！** 例如：
>
> ```bash
> cd "$SKILL_DIR/scripts" && node clear_temp.js
> ```

示例调用流程：

```bash
# 1. 执行扣子智能体或工作流的调用流程
cd "$SKILL_DIR/scripts" && node create_session.js <bot_id>
cd "$SKILL_DIR/scripts" && node send_message.js <conversation_id> <参数JSON文件绝对路径>
cd "$SKILL_DIR/scripts" && node check_status.js <conversation_id> <chat_id>
cd "$SKILL_DIR/scripts" && node get_messages.js <conversation_id> <chat_id>

# 2. 将结果交付给用户后，清理 temp 目录（AI 自动执行）
cd "$SKILL_DIR/scripts" && node clear_temp.js
```

## 注意事项

- 清理操作由 AI 自动执行，**无需用户手动操作**
- 具体清理哪些文件、保留哪些文件由 `clear_temp.js` 脚本内部逻辑决定，文档不干涉
- 删除失败的文件（如被占用）会被忽略，不影响整体流程
