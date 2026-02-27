# 飞书多维表格`新增字段`API使用指南

## 📋 概述

**API功能**：在多维表格数据表中新增一个字段
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
  "tenant_access_token": {
    "type": "string",
    "description": "API 的访问凭证参数",
    "required": true
  },
  "field_name": {
    "type": "string",
    "description": "多维表格字段名称。名称中的首尾空格将会被去除。",
    "required": true
  },
  "type": {
    "required": true,
    "type": "integer",
    "description": "字段类型",
    "enum": [
      {
        "value": 1,
        "label": "文本"
      },
      {
        "value": 2,
        "label": "数字"
      },
      {
        "value": 3,
        "label": "单选"
      },
      {
        "value": 4,
        "label": "多选"
      },
      {
        "value": 5,
        "label": "日期"
      },
      {
        "value": 7,
        "label": "复选框"
      },
      {
        "value": 13,
        "label": "电话号码"
      },
      {
        "value": 15,
        "label": "超链接"
      },
      {
        "value": 17,
        "label": "附件"
      },
      {
        "value": 1001,
        "label": "创建时间"
      },
      {
        "value": 1002,
        "label": "最后更新时间"
      },
      {
        "value": 1005,
        "label": "自动编号"
      }
    ]
  },
  "property": {
    "required": false,
    "type": "object",
    "description": "字段属性",
    "properties": {
      "options": {
        "type": "array",
        "required": false,
        "description": "单选、多选字段的选项信息",
        "items": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string",
              "required": false,
              "description": "选项名"
            },
            "id": {
              "type": "string",
              "required": false,
              "description": "选项 ID，创建时不可指定 ID"
            },
            "color": {
              "type": "int",
              "required": false,
              "description": "选项颜色, 取值范围：0 ～ 54"
            }
          }
        }
      },
      "auto_fill": {
        "type": "boolean",
        "required": false,
        "description": "日期字段中新纪录自动填写创建时间"
      },
      "min": {
        "type": "number(float)",
        "required": false,
        "description": "进度、评分等字段的数据范围最小值, 示例值：0"
      },
      "max": {
        "type": "number(float)",
        "required": false,
        "description": "进度、评分等字段的数据范围最大值,示例值：10"
      },
      "range_customize": {
        "type": "boolean",
        "required": false,
        "description": "进度等字段是否支持自定义范围"
      },
      "currency_code": {
        "type": "string",
        "required": false,
        "description": "货币币种, 示例值：'CNY'"
      }
    }
  },
  "description": {
    "required": false,
    "type": "object",
    "description": "字段的描述",
    "properties": {
      "disable_sync": {
        "type": "boolean",
        "required": false,
        "description": "是否禁止同步，如果为true，表示禁止同步该描述内容到表单的问题描述"
      },
      "text": {
        "type": "string",
        "required": false,
        "description": "字段描述内容，支持换行\n"
      }
    }
  },
  "ui_type": {
    "required": false,
    "type": "string",
    "description": "字段在界面上的展示类型，例如 Progress 进度字段是数字的一种展示形态",
    "enum": [
      {
        "value": "Text",
        "label": "文本"
      },
      {
        "value": "Barcode",
        "label": "条码"
      },
      {
        "value": "Number",
        "label": "数字"
      },
      {
        "value": "SingleSelect",
        "label": "单选"
      },
      {
        "value": "MultiSelect",
        "label": "多选"
      },
      {
        "value": "DateTime",
        "label": "日期"
      },
      {
        "value": "Checkbox",
        "label": "复选框"
      },
      {
        "value": "Phone",
        "label": "电话号码"
      },
      {
        "value": "Url",
        "label": "超链接"
      },
      {
        "value": "Attachment",
        "label": "附件"
      },
      {
        "value": "CreatedTime",
        "label": "创建时间"
      },
      {
        "value": "ModifiedTime",
        "label": "最后更新时间"
      },
      {
        "value": "AutoNumber",
        "label": "自动编号"
      }
    ]
  }
}
```

## ⚠️ 重要提示：参数命名注意

### 字段类型参数名是 `type`，不是 `field_type`

创建字段时，需要注意参数命名的一致性：

| 参数 | 正确的参数名 | 错误的参数名 |
| --- | --- | --- |
| 字段名称 | `field_name` | - |
| 字段类型 | **`type`** | ❌ `field_type` |

### 常见错误

❌ **错误示例** - 使用 `field_type`：
```json
{
  "field_name": "新字段",
  "field_type": 1
}
```

✅ **正确示例** - 使用 `type`：
```json
{
  "field_name": "新字段",
  "type": 1
}
```

> 💡 **说明**：虽然字段名称用 `field_name`，但字段类型只用 `type`。这是飞书 API 的设计，请特别注意。

## 新增字段 工作步骤

1. **创建参数配置文件**

   根据上方【参数文件内容（JSON Schema）】创建 JSON 文件，例如 `field-params.json`：

   ```json
   {
     "app_token": "your_app_token",
     "table_id": "your_table_id",
     "tenant_access_token": "your_token",
     "field_name": "新字段名称",
     "type": 1
   }
   ```

2. **运行脚本**

   ```bash
   node scripts/field/create.js --parameter-file-path "C:/Users/username/AppData/Local/Temp/feishu-operation-1740374400000-a7x9k2.json"
   ```
   
   > ⚠️ 注意：
   >
   > - `--parameter-file-path` 必须使用绝对路径
   > - 路径中必须使用正斜杠 `/`
