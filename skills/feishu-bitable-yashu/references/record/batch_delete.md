# 飞书多维表格`删除多条记录`API使用指南

## 📋 概述

**API功能**：删除多维表格数据表中现有的多条记录。单次调用最多删除 500 条记录。
**频率限制**：50 次/秒

## 要传入的参数说明

### 1. 命令行参数

本脚本通过命令行参数接收配置：

| 参数名                  | 类型   | 必填 | 说明                                                                                     |
| ----------------------- | ------ | ---- | ---------------------------------------------------------------------------------------- |
| `--parameter-file-path` | string | 是   | 参数配置文件的路径，**必须使用绝对路径**；路径中使用正斜杠 `/`；包含空格时需用双引号包裹 |

### 2. 参数文件内容（JSON Schema）

```json
{
  "app_token": {
    "type": "string",
    "description": "多维表格 App 的唯一标识",
    "required": true
  },
  "table_id": {
    "type": "string",
    "description": "多维表格数据表的唯一标识",
    "required": true
  },
  "records": {
    "type": "array",
    "description": "删除的多条记录 ID 列表",
    "required": true,
    "items": {
      "type": "string",
      "description": "要删除的记录 ID"
    }
  },
  "tenant_access_token": {
    "type": "string",
    "description": "API 的访问凭证参数",
    "required": true
  }
}
```

## ⚠️ 重要提示：records 参数格式

### 批量删除的 records 格式

批量删除时，`records` 字段必须是**字符串数组**（仅包含记录ID），而不是对象数组。

✅ **正确格式** - 字符串数组：

```json
{
  "records": ["recxxxxxxxx", "recyyyyyyyy"]
}
```

❌ **错误格式** - 对象数组（这是批量创建/更新使用的格式）：

```json
{
  "records": [{ "record_id": "recxxxxxxxx" }, { "record_id": "recyyyyyyyy" }]
}
```

### 批量操作参数格式对比

| 操作         | 参数名       | 格式                               | 示例                                      |
| ------------ | ------------ | ---------------------------------- | ----------------------------------------- |
| **批量创建** | `records`    | 对象数组，包含 fields              | `[{"fields": {...}}]`                     |
| **批量更新** | `records`    | 对象数组，包含 record_id 和 fields | `[{"record_id": "xxx", "fields": {...}}]` |
| **批量删除** | `records`    | **字符串数组**，仅 record_id       | `["recxxx", "recyyy"]`                    |
| **批量获取** | `record_ids` | **字符串数组**，仅 record_id       | `["recxxx", "recyyy"]`                    |

> 💡 **记忆技巧**：需要传递字段数据的操作（创建/更新）用对象数组；只需要ID的操作（删除/获取）用字符串数组。

## 飞书多维表格`删除多条记录`工作步骤

1. **创建参数配置文件**

   根据上方【参数文件内容（JSON Schema）】创建 JSON 文件，例如 `params.json`：

   ```json
   {
     "app_token": "your_app_token",
     "table_id": "your_table_id",
     "records": ["recxxxxxxxx", "recyyyyyyyy"],
     "tenant_access_token": "your_tenant_access_token"
   }
   ```

2. **运行脚本**

   ```bash
   cd $SKILL_DIR/scripts && node record/batch-delete.js --parameter-file-path "$SKILL_DIR/temp/feishu-operation-1740374400000-a7x9k2.json"
   ```

   > ⚠️ 注意：
   >
   > - `--parameter-file-path` 必须使用绝对路径
   > - 路径中必须使用正斜杠 `/`
