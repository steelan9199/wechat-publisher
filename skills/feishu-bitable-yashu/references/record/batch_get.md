# 飞书多维表格`批量获取记录`API使用指南

## 📋 概述

**API功能**：通过多个记录 ID 查询记录信息。该接口最多支持查询 100 条记录。
**频率限制**：20 次/秒

## 要传入的参数说明

### 1. 命令行参数

本脚本通过命令行参数接收配置：

| 参数名                  | 类型   | 必填 | 说明                                                                   |
| ----------------------- | ------ | ---- | ---------------------------------------------------------------------- |
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
  "record_ids": {
    "minItems": 1,
    "maxItems": 100,
    "type": "array",
    "description": "记录 ID 列表。调用查询记录获取",
    "required": true,
    "items": {
      "type": "string",
      "description": "记录 ID"
    }
  },
  "tenant_access_token": {
    "type": "string",
    "description": "API 的访问凭证参数",
    "required": true
  },
  "with_shared_url": {
    "type": "boolean",
    "description": "是否返回记录的分享链接",
    "required": false,
    "default": false
  },
  "automatic_fields": {
    "type": "boolean",
    "description": "是否自动计算并返回创建时间(created_time)、修改时间(last_modified_time)、创建人(created_by)、修改人(last_modified_by)这四类字段。默认为false，表示不返回。",
    "required": false,
    "default": false
  }
}
```

## ⚠️ 重要提示：record_ids 参数格式

### 批量获取的 record_ids 格式

批量获取时，`record_ids` 字段必须是**字符串数组**（仅包含记录ID）。

✅ **正确格式**：
```json
{
  "record_ids": ["recxxxxxxxx", "recyyyyyyyy"]
}
```

### 批量操作参数格式对比

| 操作 | 参数名 | 格式 | 示例 |
| --- | --- | --- | --- |
| **批量创建** | `records` | 对象数组，包含 fields | `[{"fields": {...}}]` |
| **批量更新** | `records` | 对象数组，包含 record_id 和 fields | `[{"record_id": "xxx", "fields": {...}}]` |
| **批量删除** | `records` | **字符串数组**，仅 record_id | `["recxxx", "recyyy"]` |
| **批量获取** | `record_ids` | **字符串数组**，仅 record_id | `["recxxx", "recyyy"]` |

> 💡 **记忆技巧**：需要传递字段数据的操作（创建/更新）用对象数组；只需要ID的操作（删除/获取）用字符串数组。

## 飞书多维表格`批量获取记录`工作步骤

1. **创建参数配置文件**

   根据上方【参数文件内容（JSON Schema）】创建 JSON 文件，例如 `params.json`：

   ```json
   {
     "app_token": "your_app_token",
     "table_id": "your_table_id",
     "record_ids": ["recxxxxxxxx", "recyyyyyyyy"],
     "tenant_access_token": "your_tenant_access_token"
   }
   ```

2. **运行脚本**

   ```bash
   cd $SKILL_DIR/scripts && node record/batch-get.js --parameter-file-path "$SKILL_DIR/temp/feishu-operation-1740374400000-a7x9k2.json"
   ```

   > ⚠️ 注意：
   >
   > - `--parameter-file-path` 必须使用绝对路径
   > - 路径中必须使用正斜杠 `/`
