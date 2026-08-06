# checkWorkflowResult - 查询工作流异步运行结果

查询异步工作流的执行状态和结束节点输出数据。

> ⚠️ **重要**：每个 API 都是**独立的脚本文件**，只能通过命令行直接运行，**不能**作为模块导入使用！

## 命令行调用

```bash
cd "$SKILL_DIR/scripts" && node check_workflow_result.js <workflow_id> <execute_id>
```

> ⚠️ **必须先 cd 到 scripts 目录！** 例如：
>
> ```bash
> cd "$SKILL_DIR/scripts" && node check_workflow_result.js 7651238514168545306 7652350786920562688
> ```

## 参数

| 参数名        | 类型   | 必填 | 说明                               |
| ------------- | ------ | ---- | ---------------------------------- |
| `workflow_id` | string | 是   | 工作流 ID                          |
| `execute_id`  | string | 是   | 执行 ID，由 `run_workflow.js` 返回 |

## 返回

| 字段名           | 类型   | 说明                                                                                           |
| ---------------- | ------ | ---------------------------------------------------------------------------------------------- |
| `execute_status` | string | 执行状态：`Running`（运行中）、`Success`（成功）、`Fail`（失败）                               |
| `output`         | object | 解析后的结束节点输出参数对象                                                                   |
| `raw_output`     | string | 原始的 output JSON 字符串（调试用）                                                            |
| `debug_url`      | string | **调试链接（必返回）**。可直接在浏览器中打开，查看该次工作流执行的完整运行详情、节点状态及日志 |
| `execute_time`   | number | 执行耗时（毫秒）                                                                               |

### output 字段说明

`output` 是扣子工作流结束节点的输出参数集合。不同工作流的输出参数数量和名称可能不同：

- 简单工作流通常只有一个 `Output` 参数
- 复杂工作流可能有 1 个、2 个或更多输出参数

```json
{
  "execute_status": "Success",
  "output": {
    "Output": "这是结束节点输出的内容..."
  },
  "raw_output": "{\"Output\":\"这是结束节点输出的内容...\"}",
  "debug_url": "https://www.coze.cn/work_flow?execute_id=...",
  "execute_time": 3250
}
```

### 多输出参数示例

如果结束节点配置了多个输出参数，`output` 会包含多个键：

```json
{
  "execute_status": "Success",
  "output": {
    "Output": "主要结果内容",
    "summary": "摘要内容",
    "score": 95
  }
}
```

### debug_url 字段说明

`debug_url` 是每次查询结果时**必定返回**的字段，非常重要，在实际调用后始终将其提供给用户。

- **用途**：打开该链接可直接在扣子网页端查看本次工作流执行的完整运行图，包括每个节点的执行状态、输入输出数据、耗时及异常日志。
- **使用场景**：
  - 当 `execute_status` 为 `Running` 时，可通过 `debug_url` 实时观察执行进度。
  - 当 `execute_status` 为 `Fail` 时，可通过 `debug_url` 定位具体失败节点和错误原因。
  - 当输出结果与预期不符时，可通过 `debug_url` 核对各中间节点的数据流转是否正确。
- **格式示例**：`https://www.coze.cn/work_flow?execute_id=xxx&space_id=xxx&workflow_id=xxx&execute_mode=2`

## 调用示例

```bash
cd "$SKILL_DIR/scripts" && node check_workflow_result.js 7651238514168545306 7652350786920562688
```

## 轮询策略

由于异步工作流可能需要一定时间执行，按以下策略轮询：

1. 调用 `run_workflow.js` 获取 `execute_id`
2. 等待 `POLLING_INTERVAL` 秒（默认 5 秒，可在 `.env` 中配置）
3. 调用 `check_workflow_result.js` 查询状态
4. 如果 `execute_status` 为 `Running`，重复步骤 2-3
5. 如果 `execute_status` 为 `Success`，取 `output` 中的数据
6. 如果 `execute_status` 为 `Fail`，向用户报告失败

## 注意事项

1. 工作流输出节点的输出数据最多保存 24 小时，结束节点为 7 天
2. 输出内容超过 1MB 时，无法保证返回内容的完整性
3. 如果 `execute_status` 长期为 `Running`，可通过 `debug_url` 在浏览器中查看执行详情
4. 当 `execute_status` 为 `Success` 时，脚本会自动将本次端到端耗时记录到 `$SKILL_DIR/config/workflows.json` 对应工作流的 `recent_durations` 字段中
