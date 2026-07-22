# getWorkflowInfo - 查询工作流基本信息

查询工作流的基本信息，重点是获取**开始节点**的输入参数定义和**结束节点**的输出参数定义。

> ⚠️ **重要**：每个 API 都是**独立的脚本文件**，只能通过命令行直接运行，**不能**作为模块导入使用！

## 命令行调用

```bash
cd $SKILL_DIR/scripts; node get_workflow_info.js <workflow_id>
```

> ⚠️ **必须先 cd 到 scripts 目录！** 例如：
>
> ```bash
> cd $SKILL_DIR/scripts; node get_workflow_info.js 7651238514168545306
> ```

## 参数

| 参数名        | 类型   | 必填 | 说明                                                |
| ------------- | ------ | ---- | --------------------------------------------------- |
| `workflow_id` | string | 是   | 工作流 ID，AI 从 `config/workflows.json` 中匹配获取 |

---

## 参考说明：什么是工作流 ID

> **工作流 ID**，获取方法如下：
>
> 进入工作流编排页面，在页面 URL 中，workflow 参数后的数字就是 Workflow ID。例如 `https://www.coze.com/work_flow?space_id=42463***&workflow_id=73505836754923***`，Workflow ID 为 `73505836754923***`。

---

## 获取工作流 ID

AI 应从配置文件 `$SKILL_DIR/config/workflows.json` 中获取工作流 ID，匹配规则如下：

1. 读取 `workflows.json` 中 `workflows` 数组，查看每个对象的 `name` 和 `description` 字段
2. 根据用户的任务描述，选择匹配度最高的工作流
3. 使用该工作流的 `id` 字段作为 `workflow_id`
4. **透明告知**用户：说明选择了哪个工作流（name）以及匹配理由

**用户交互场景：**

- **用户不知道什么是工作流 ID**：引导用户查看上方「参考说明：什么是工作流 ID」小节
- **用户想修改工作流 ID 或工作流信息**：告知用户前往 `$SKILL_DIR/config/workflows.json`，修改对应工作流对象的相关字段

---

## 返回

| 字段名        | 类型   | 说明                   |
| ------------- | ------ | ---------------------- |
| `workflow_id` | string | 工作流 ID              |
| `name`        | string | 工作流名称             |
| `description` | string | 工作流描述             |
| `input`       | object | 开始节点的输入参数定义 |
| `output`      | object | 结束节点的输出参数定义 |

### input / output 参数定义结构

`input` 和 `output` 字段遵循 OpenAPI Schema 格式，包含参数的名称、类型、是否必填等信息：

```json
{
  "workflow_id": "748xxxxxxxxxxxx",
  "name": "周报生成器",
  "description": "自动生成工作周报",
  "input": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string",
        "description": "周报标题"
      },
      "department": {
        "type": "string",
        "description": "所属部门"
      },
      "items": {
        "type": "array",
        "description": "工作项列表",
        "items": {
          "type": "string"
        }
      }
    },
    "required": ["title", "department"]
  },
  "output": {
    "type": "object",
    "properties": {
      "Output": {
        "type": "string",
        "description": "生成的周报内容"
      },
      "word_count": {
        "type": "integer",
        "description": "字数统计"
      }
    }
  }
}
```

### 关键字段解析

AI 在构造工作流输入参数时，应重点参考以下字段：

| 字段名        | 说明                                                                  |
| ------------- | --------------------------------------------------------------------- |
| `type`        | 参数类型：`string`、`integer`、`number`、`boolean`、`object`、`array` |
| `description` | 参数说明，帮助理解参数用途                                            |
| `required`    | 必填参数名数组，这些参数在调用 `run_workflow.js` 时必须提供           |
| `items`       | 当 `type` 为 `array` 时，描述数组元素的类型                           |
| `properties`  | 当 `type` 为 `object` 时，描述对象的各个属性                          |

## 调用示例

```bash
cd $SKILL_DIR/scripts; node get_workflow_info.js 7651238514168545306
```

## 使用场景

1. **首次调用工作流前**：先用本接口查询参数定义，确保传入正确的参数名和类型
2. **动态构建参数**：AI 根据 `input` 的定义，自动向用户收集必要信息并构造参数 JSON
3. **解析输出结果**：根据 `output` 的定义，正确提取和展示工作流返回的数据

## 注意事项

1. 调用本接口需要的访问令牌必须开通 `getMetaData` 权限
2. `required` 数组中的参数在调用 `run_workflow.js` 时必须提供，否则 API 会报错
3. 参数类型为 `array` 时，`items` 字段定义了数组元素的结构
