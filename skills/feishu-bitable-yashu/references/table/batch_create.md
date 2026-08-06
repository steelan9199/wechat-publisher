# 飞书多维表格`新增多个数据表`API使用指南

## 📋 概述

**API功能**：新增多个数据表，仅可指定数据表名称
**频率限制**：10 次/秒

## 使用限制

每个多维表格中，数据表的总数量上限为 100。

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
  "tenant_access_token": {
    "type": "string",
    "description": "API 的访问凭证参数",
    "required": true
  },
  "tables": {
    "type": "array",
    "description": "多个数据表名称",
    "items": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "required": true,
          "description": "数据表名称"
        }
      }
    },
    "required": true
  }
}
```

## 飞书多维表格`新增多个数据表`工作步骤

1. **创建参数配置文件**

   根据上方【参数文件内容（JSON Schema）】创建 JSON 文件，例如 `params.json`：

   ```json
   {
     "app_token": "your_app_token",
     "tenant_access_token": "your_tenant_access_token",
     "tables": [{"name": "数据表1"}, {"name": "数据表2"}]
   }
   ```

2. **运行脚本**

   ```bash
   cd $SKILL_DIR/scripts && node table/batch-create.js --parameter-file-path "$SKILL_DIR/temp/feishu-operation-1740374400000-a7x9k2.json"
   ```

   > ⚠️ 注意：
   >
   > - `--parameter-file-path` 必须使用绝对路径
   > - 路径中必须使用正斜杠 `/`
