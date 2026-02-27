# 飞书多维表格`更新字段`API使用指南

## 📋 概述

**API功能**：在多维表格数据表中更新一个字段。更新字段时为全量更新，property 等字段会被完全覆盖
**频率限制**：10 次/秒

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
  "field_id": {
    "type": "string",
    "description": "数据表中一个字段的唯一标识。通过列出字段接口获取",
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

## 飞书多维表格`更新字段`工作步骤

1. **创建参数配置文件**

   根据上方【参数文件内容（JSON Schema）】创建 JSON 文件，例如 `params.json`：

   ```json
   {
     "app_token": "your_app_token",
     "table_id": "your_table_id",
     "field_id": "fldxxxxxxxx",
     "tenant_access_token": "your_tenant_access_token",
     "field_name": "字段名称",
     "type": 1
   }
   ```

   > ⚠️ **重要提示**：
   > - `type` 字段是**必需**的，更新字段时必须提供
   > - 如果不提供 `type`，会返回错误：`field validation failed - type is required`
   > - 常见字段类型：`1`=文本, `2`=数字, `3`=单选, `4`=多选, `5`=日期, `7`=复选框

2. **运行脚本**

   ```bash
   node scripts/field/update.js --parameter-file-path "C:/Users/username/AppData/Local/Temp/feishu-operation-1740374400000-a7x9k2.json"
   ```

   > ⚠️ 注意：
   >
   > - `--parameter-file-path` 必须使用绝对路径
   > - 路径中必须使用正斜杠 `/`
