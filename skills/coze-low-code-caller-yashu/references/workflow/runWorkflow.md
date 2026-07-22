# runWorkflow - 执行工作流（异步）

异步执行扣子平台上的工作流。执行成功后返回 `execute_id`，用于后续查询执行结果。

> ⚠️ **重要**：每个 API 都是**独立的脚本文件**，只能通过命令行直接运行，**不能**作为模块导入使用！

## 命令行调用

```bash
cd $SKILL_DIR/scripts; node run_workflow.js <workflow_id> <绝对路径/params.json>
```

> ⚠️ **必须先 cd 到 scripts 目录！** 例如：
>
> ```bash
> cd $SKILL_DIR/scripts; node run_workflow.js 7651238514168545306 $SKILL_DIR/temp/workflow_params.json
> ```

## 参数

| 参数名         | 类型   | 必填 | 说明                                               |
| -------------- | ------ | ---- | -------------------------------------------------- |
| `workflow_id`  | string | 是   | 工作流 ID，从扣子平台获取                          |
| `参数JSON文件` | string | 是   | 包含工作流输入参数的 JSON 文件路径（**绝对路径**） |

---

## 操作步骤（推荐顺序）

### 步骤 1：先查询工作流信息（必选）

在执行工作流之前，先用 `get_workflow_info.js` 查看需要哪些输入参数：

```bash
cd $SKILL_DIR/scripts; node get_workflow_info.js 7651238514168545306
```

**为什么需要这一步？**

- 确认哪些参数是**必填**的（`required` 数组中的键名）
- 确认每个参数的正确**数据类型**（`string`、`array`、`object` 等）
- 避免因为参数缺失或类型错误导致工作流执行失败

### 步骤 2：根据参数定义创建参数文件

从步骤 1 获取的参数定义，创建对应的 JSON 文件。

**示例：** 如果工作流需要 `query`（必填字符串）和 `format`（可选字符串）：

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

---

## 参数 JSON 文件格式（完整指南）

### 格式 1：普通参数

参数 JSON 文件的**顶层键值对**对应工作流开始节点的输入参数：

```json
{
  "title": "周报总结",
  "department": "技术部"
}
```

- 每个键对应工作流开始节点定义的一个输入参数名
- 参数值类型可以是 `string`、`number`、`boolean`、`object`、`array` 等，需与工作流定义的类型一致

### 格式 2：文件类型参数

当工作流开始节点需要图片、文件或音频时，有两种传参方式：

#### 方式 A：使用 file_id（推荐）

1. 先用 `upload_file.js` 上传文件，获得 `file_id`
2. 将 `file_id` 作为 JSON 字符串传入

- 单个文件：

  ```json
  {
    "image": "{\"file_id\":\"1122334455\"}"
  }
  ```

- 多个文件（数组）：
  ```json
  {
    "images": ["{\"file_id\":\"1122334455\"}", "{\"file_id\":\"6677889900\"}"]
  }
  ```

#### 方式 B：使用文件 URL

直接传入可公开访问的链接：

```json
{
  "query": "请总结图片内容",
  "image": "https://example.com/photo.jpg"
}
```

### 格式 3：嵌套对象参数

如果工作流需要嵌套的对象参数：

```json
{
  "options": {
    "language": "zh-CN",
    "max_tokens": 2000,
    "temperature": 0.7
  }
}
```

### 格式 4：混合类型

同时包含普通参数、文件参数和嵌套参数：

```json
{
  "query": "分析这篇文档",
  "document": "{\"file_id\":\"9988776655\"}",
  "options": {
    "language": "zh-CN"
  }
}
```

---

## 返回

| 字段名       | 类型   | 说明                                                                                         |
| ------------ | ------ | -------------------------------------------------------------------------------------------- |
| `execute_id` | string | 工作流执行 ID，用于查询异步执行结果                                                          |
| `debug_url`  | string | **调试链接（必返回）**。可直接在浏览器中打开，查看本次工作流执行的完整运行图、节点状态及日志 |

```json
{
  "execute_id": "765xxxxxxxxxxxx",
  "debug_url": "https://www.coze.cn/work_flow?execute_id=..."
}
```

> ⚠️ **重要**：`debug_url` 每次都会返回，将其提供给用户，用于排查问题。

---

## 调用示例

### 示例 1：带普通参数

1. 使用 Write 工具创建参数文件 `$SKILL_DIR/temp/workflow_params.json`，内容如下：

   ```json
   {
     "query": "分析2025年AI发展趋势",
     "format": "markdown"
   }
   ```

2. 执行工作流：

   ```bash
   cd $SKILL_DIR/scripts; node run_workflow.js 7651238514168545306 $SKILL_DIR/temp/workflow_params.json
   ```

### 示例 2：带文件参数

1. 上传文件：

   ```bash
   cd $SKILL_DIR/scripts; node upload_file.js $SKILL_DIR/temp/my_image.jpg
   # 输出: { "file_id": "1122334455", "file_name": "my_image.jpg" }
   ```

2. 使用 Write 工具创建参数文件 `$SKILL_DIR/temp/workflow_params.json`，内容如下：

   ```json
   {
     "image": "{\"file_id\":\"1122334455\"}",
     "query": "分析这张图片"
   }
   ```

3. 执行工作流：

   ```bash
   cd $SKILL_DIR/scripts; node run_workflow.js 7651238514168545306 $SKILL_DIR/temp/workflow_params.json
   ```

---

## 注意事项

1. 本接口**固定使用异步模式**（`is_async: true`），执行成功后需配合 [`check_workflow_result.js`]($SKILL_DIR/references/workflow/checkWorkflowResult.md) 查询结果
2. 参数 JSON 文件中的键必须与工作流开始节点的参数名完全一致（区分大小写）
3. 如果传入的参数类型与工作流定义不匹配，API 会返回错误
4. 所有临时文件必须放在 `$SKILL_DIR/temp` 目录下
5. 执行命令前必须先 `cd` 到 scripts 目录
