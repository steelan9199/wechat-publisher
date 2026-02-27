# 飞书多维表格`查询记录`API使用指南

## 📋 概述

**API功能**：查询数据表中的现有记录，单次最多查询 500 行记录，支持分页获取
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
  "tenant_access_token": {
    "type": "string",
    "description": "API 的访问凭证参数",
    "required": true
  },
  "page_token": {
    "type": "string",
    "description": "分页标记，第一次请求不填，表示从头开始遍历；分页查询结果还有更多项时会同时返回新的 page_token，下次遍历可采用该 page_token 获取查询结果",
    "required": false
  },
  "page_size": {
    "type": "int",
    "description": "分页大小, 默认20, 最大值500",
    "required": false
  },
  "view_id": {
    "type": "string",
    "description": "多维表格中视图的唯一标识",
    "required": false
  },
  "automatic_fields": {
    "type": "boolean",
    "description": "是否自动计算并返回创建时间(created_time)、修改时间(last_modified_time)、创建人(created_by)、修改人(last_modified_by)这四类字段。默认为false，表示不返回。",
    "required": false,
    "default": false
  },
  "field_names": {
    "type": "array",
    "description": "字段名称，用于指定本次查询返回记录中包含的字段",
    "items": {
      "type": "string",
      "description": "字段名称"
    },
    "maxItems": 200,
    "examples": [
      [
        "字段1",
        "字段2"
      ]
    ]
  },
  "sort": {
    "required": false,
    "type": "array",
    "description": "排序条件",
    "items": {
      "type": "object",
      "properties": {
        "field_name": {
          "type": "string",
          "description": "字段名称"
        },
        "desc": {
          "type": "string",
          "description": "是否倒序排序",
          "default": false
        }
      }
    },
    "maxItems": 100
  },
  "filter": {
    "required": false,
    "type": "object",
    "description": "包含条件筛选信息的对象",
    "properties": {
      "conjunction": {
        "type": "string",
        "description": "表示条件之间的逻辑连接词, 两种模式: 1. and 表示满足全部条件, 2. or 表示满足任一条件",
        "required": true,
        "enum": [
          "and",
          "or"
        ]
      },
      "conditions": {
        "required": true,
        "type": "array",
        "description": "筛选条件集合",
        "items": {
          "type": "object",
          "properties": {
            "field_name": {
              "type": "string",
              "required": true,
              "description": "筛选条件的左值，值为字段的名称"
            },
            "operator": {
              "type": "string",
              "required": true,
              "enum": [
                "is",
                "isNot（不支持日期字段）",
                "contains（不支持日期字段）",
                "doesNotContain（不支持日期字段）",
                "isEmpty",
                "isNotEmpty",
                "isGreater",
                "isGreaterEqual（不支持日期字段）",
                "isLess",
                "isLessEqual（不支持日期字段）"
              ],
              "description": "条件运算符"
            },
            "value": {
              "required": true,
              "type": "array",
              "description": "条件的值，可以是单个值或多个值的数组。不同字段类型和不同的 operator 可填的值不同",
              "items": {
                "oneOf": [
                  { "type": "string" },
                  { "type": "number" },
                  { "type": "boolean" }]
              }
            }
          }
        }
      }
    }
  },
  "examples": {
    "view_id": "vewqhz51lk",
    "field_names": [
      "字段1",
      "字段2"
    ],
    "sort": [
      {
        "field_name": "多行文本",
        "desc": true
      }
    ],
    "filter": {
      "conjunction": "and",
      "conditions": [
        {
          "field_name": "职位",
          "operator": "is",
          "value": [
            "初级销售员"
          ]
        },
        {
          "field_name": "销售额",
          "operator": "isGreater",
          "value": [
            "10000.0"
          ]
        }
      ]
    },
    "automatic_fields": false
  }
}
```

## 飞书多维表格`查询记录`工作步骤

1. **创建参数配置文件**

   根据上方【参数文件内容（JSON Schema）】创建 JSON 文件，例如 `params.json`：

   ```json
   {
     "app_token": "your_app_token",
     "table_id": "your_table_id",
     "tenant_access_token": "your_tenant_access_token",
     "field_names": ["字段1", "字段2"],
     "examples": ""
   }
   ```

2. **运行脚本**

   ```bash
   node scripts/record/get.js --parameter-file-path "C:/Users/username/AppData/Local/Temp/feishu-operation-1740374400000-a7x9k2.json"
   ```

   > ⚠️ 注意：
   >
   > - `--parameter-file-path` 必须使用绝对路径
   > - 路径中必须使用正斜杠 `/`
