# Workflow API 调用索引

> ⚠️ **重要**：每个 API 都是**独立的脚本文件**，只能通过命令行直接运行，**不能**作为模块导入使用！

## ⚠️ 重要：必须使用绝对路径

- 所有参数 JSON 文件路径必须使用**绝对路径**（如 `$SKILL_DIR/temp/params.json`）
- 原因：脚本从 `$SKILL_DIR/scripts` 目录执行，相对路径会基于该目录解析
- 临时文件必须放在 `$SKILL_DIR/temp` 目录下

## 调用流程

工作流**统一使用异步执行**，调用流程如下：

| 步骤 | 脚本                       | 功能               | 命令格式                                                                           | 输出字段                                                              |
| ---- | -------------------------- | ------------------ | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1    | `get_workflow_info.js`     | 查询工作流信息     | `cd $SKILL_DIR/scripts; node get_workflow_info.js <workflow_id>`                   | `workflow_id`, `name`, `description`, `input`, `output`               |
| 2    | `run_workflow.js`          | 执行工作流（异步） | `cd $SKILL_DIR/scripts; node run_workflow.js <workflow_id> <绝对路径/params.json>` | `execute_id`, `debug_url`                                             |
| 3    | `check_workflow_result.js` | 查询异步运行结果   | `cd $SKILL_DIR/scripts; node check_workflow_result.js <workflow_id> <execute_id>`  | `execute_status`, `output`, `raw_output`, `debug_url`, `execute_time` |

---

## 📋 操作步骤：从零开始调用工作流

> ⚠️ **重要**：所有临时文件必须放在 `$SKILL_DIR/temp` 目录下，使用绝对路径！

### 步骤 0：读取配置（前置）

确保已按 [SKILL.md 前置条件](../../SKILL.md) 完成以下配置读取：

1. 读取 `$SKILL_DIR/.env`，确认 `COZE_API_KEY` 和 `COZE_SPACE_ID` 已配置
2. 读取 `$SKILL_DIR/config/workflows.json`，确认工作流已配置

### 步骤 1：查询工作流基本信息（必选）

获取工作流需要哪些输入参数，以及会返回什么输出参数。

```bash
cd $SKILL_DIR/scripts; node get_workflow_info.js 7651238514168545306
```

**输出示例：**

```json
{
  "workflow_id": "7651238514168545306",
  "name": "coze_workflow_api_test",
  "input": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "用户查询" },
      "format": { "type": "string", "description": "输出格式" }
    },
    "required": ["query"]
  },
  "output": {
    "type": "object",
    "properties": {
      "result": { "type": "string", "description": "处理结果" }
    }
  }
}
```

**解析输出，记住**：

- 哪些参数是**必填**的（`required` 数组中的键名）
- 每个参数的数据类型（`string`、`array` 等）

### 步骤 2：创建参数文件

根据步骤 1 获取的参数定义，创建参数 JSON 文件。

**示例：** 如果工作流需要 `query`（必填字符串）和 `format`（可选字符串）两个参数：

```json
{
  "query": "分析2025年AI发展趋势",
  "format": "markdown"
}
```

**保存到：** `$SKILL_DIR/temp/workflow_params.json`

### 步骤 3：执行工作流

```bash
cd $SKILL_DIR/scripts; node run_workflow.js 7651238514168545306 $SKILL_DIR/temp/workflow_params.json
```

**输出：**

```json
{
  "execute_id": "765xxxxxxxxxxxx",
  "debug_url": "https://www.coze.cn/work_flow?execute_id=..."
}
```

> ⚠️ **重要**：每次执行都会返回 `debug_url`，将其提供给用户，便于排查问题。

### 步骤 4：轮询查询结果

循环执行本步骤，每次间隔 `POLLING_INTERVAL` 秒（默认 5 秒，可在 `$SKILL_DIR/.env` 中配置），直到状态变为 `Success` 或 `Fail`。

```bash
cd $SKILL_DIR/scripts; node check_workflow_result.js 7651238514168545306 765xxxxxxxxxxxx
```

**输出：**

```json
{
  "execute_status": "Running",
  "output": null,
  "debug_url": "https://www.coze.cn/work_flow?execute_id=..."
}
```

重复查询，直到：

```json
{
  "execute_status": "Success",
  "output": { "result": "..." },
  "raw_output": "{\"result\":\"...\"}",
  "debug_url": "https://www.coze.cn/work_flow?execute_id=...",
  "execute_time": 3250
}
```

---

## 参数 JSON 文件格式（进阶）

> 详细的参数 JSON 文件格式说明（普通参数、文件类型参数、嵌套对象、混合类型及完整示例）请参考 [runWorkflow.md 参数 JSON 文件格式章节]($SKILL_DIR/references/workflow/runWorkflow.md)。

---

## 详细文档

| 脚本                       | 文档                                                                            |
| -------------------------- | ------------------------------------------------------------------------------- |
| `get_workflow_info.js`     | [查询工作流信息]($SKILL_DIR/references/workflow/getWorkflowInfo.md)             |
| `run_workflow.js`          | [执行工作流（异步）]($SKILL_DIR/references/workflow/runWorkflow.md)             |
| `check_workflow_result.js` | [查询工作流异步运行结果]($SKILL_DIR/references/workflow/checkWorkflowResult.md) |

---

## 常见错误

| 错误场景         | 原因                             | 解决方法                                                   |
| ---------------- | -------------------------------- | ---------------------------------------------------------- |
| 参数缺失         | 未传入必填参数                   | 用 `get_workflow_info.js` 确认 required 字段，补充缺失参数 |
| 参数类型不匹配   | 传入的参数类型与工作流定义不一致 | 检查参数类型（如字符串 vs 数组），确保与工作流定义一致     |
| 执行失败         | 工作流内部错误                   | 用返回的 `debug_url` 查看运行日志，定位失败的节点          |
| 状态一直 Running | 工作流仍在执行中                 | 继续轮询，或用 `debug_url` 实时观察执行进度                |
