# 飞书多维表格`删除字段`API使用指南

## 📋 概述

**API功能**：删除多维表格数据表中的一个字段
**频率限制**：10 次/秒

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
  "field_id": {
    "type": "string",
    "description": "数据表中一个字段的唯一标识。通过列出字段接口获取",
    "required": true
  },
  "tenant_access_token": {
    "type": "string",
    "description": "API 的访问凭证参数",
    "required": true
  }
}
```

## 飞书多维表格`删除字段`工作步骤

1. **创建参数配置文件**

   根据上方【参数文件内容（JSON Schema）】创建 JSON 文件，例如 `params.json`：

   ```json
   {
     "app_token": "your_app_token",
     "table_id": "your_table_id",
     "field_id": "fldxxxxxxxx",
     "tenant_access_token": "your_tenant_access_token"
   }
   ```

2. **运行脚本**

   ```bash
   node scripts/field/delete.js --parameter-file-path "C:/Users/username/AppData/Local/Temp/feishu-operation-1740374400000-a7x9k2.json"
   ```

   > ⚠️ 注意：
   >
   > - `--parameter-file-path` 必须使用绝对路径
   > - 路径中必须使用正斜杠 `/`
