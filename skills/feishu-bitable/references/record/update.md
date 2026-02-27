# 飞书多维表格`更新记录`API使用指南

## 📋 概述

**API功能**：更新多维表格数据表中的一条记录
**频率限制**：50 次/秒

## 注意事项。

1. 更新记录为增量更新，仅更新传入的字段。
2. 如果想对记录中的某个字段值置空，可将字段设为 null。例如:

```json
{
  "fields": {
    "文本字段": null
  }
}
```

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
  "record_id": {
    "type": "string",
    "description": "数据表中一条记录的唯一标识",
    "required": true
  },
  "tenant_access_token": {
    "type": "string",
    "description": "API 的访问凭证参数",
    "required": true
  },
  "fields": {
    "type": "object",
    "description": "fields数据, fields 字段中的 key 始终为字符串类型，对应的是多维表格每列的标题，如 '任务情况总结'。",
    "patternProperties": {
      "^.*$": {
        "oneOf": [
          {
            "type": "string",
            "description": "文本字段：普通文本内容, 单个单元格内容最多 10 万个字符"
          },
          {
            "type": "number",
            "description": "数字字段：包括数字、进度、货币、评分、日期(日期必须是Unix毫秒级时间戳)等"
          },
          {
            "type": "boolean",
            "description": "布尔字段：复选框类型"
          },
          {
            "type": "array",
            "description": "数组类型字段：多选、附件等",
            "items": {
              "oneOf": [
                {
                  "type": "string",
                  "description": "多选字段的选项值"
                },
                {
                  "type": "object",
                  "title": "附件字段对象",
                  "description": "附件类型字段的详细信息",
                  "properties": {
                    "file_token": {
                      "type": "string",
                      "description": "附件的token，可用于下载"
                    },
                    "name": {
                      "type": "string",
                      "description": "附件名称"
                    },
                    "type": {
                      "type": "string",
                      "description": "附件的mime类型，如image/png"
                    },
                    "size": {
                      "type": "integer",
                      "description": "附件大小（字节）"
                    }
                  },
                  "required": [
                    "file_token",
                    "name",
                    "type",
                    "size"
                  ],
                  "additionalProperties": false
                }
              ]
            }
          },
          {
            "type": "object",
            "title": "单对象字段",
            "description": "单个对象类型的字段，如超链接",
            "oneOf": [
              {
                "type": "object",
                "title": "超链接字段对象",
                "properties": {
                  "text": {
                    "type": "string",
                    "description": "链接显示文本"
                  },
                  "link": {
                    "type": "string",
                    "format": "uri",
                    "description": "链接地址"
                  }
                },
                "required": [
                  "text",
                  "link"
                ],
                "additionalProperties": false
              }
            ]
          }
        ]
      }
    },
    "additionalProperties": true,
    "examples": {
      "任务名称": "拜访潜在客户",
      "工时": 10,
      "货币": 3,
      "评分": 3,
      "进度": 0.25,
      "单选": "选项1",
      "多选": [
        "选项1",
        "选项2"
      ],
      "日期": 1674206443000,
      "复选框": true,
      "电话号码": "1302616xxxx",
      "超链接": {
        "text": "飞书多维表格官网",
        "link": "https://www.feishu.cn/product/base"
      },
      "附件": [
        {
          "file_token": "DRiFbwaKsoZaLax4WKZbEGCccoe"
        },
        {
          "file_token": "BZk3bL1Enoy4pzxaPL9bNeKqcLe"
        }
      ]
    }
  }
}
```

## ⚠️ 重要提示：字段格式说明

### 文本字段的更新格式

更新记录时，**文本/多行文本字段必须使用字符串格式**，而不是查询时返回的富文本数组格式：

| 操作 | 正确格式 | 错误格式 |
| --- | --- | --- |
| **更新记录** | `"字段名": "文本内容"` | `"字段名": [{"text": "内容", "type": "text"}]` |

### 常见错误

如果你看到错误 `TextFieldConvFail`，说明你可能使用了查询返回的格式来更新记录。

✅ **正确示例**：
```json
{
  "record_id": "recxxxxxxxx",
  "fields": {
    "任务描述": "更新后的任务描述",
    "进度": 75
  }
}
```

❌ **错误示例**：
```json
{
  "record_id": "recxxxxxxxx",
  "fields": {
    "任务描述": [{"text": "更新后的任务描述", "type": "text"}],
    "进度": 75
  }
}
```

> 💡 **提示**：查询记录时返回的富文本格式不能直接用于更新记录，需要转换为简化格式。

## 飞书多维表格`更新记录`工作步骤

1. **创建参数配置文件**

   根据上方【参数文件内容（JSON Schema）】创建 JSON 文件，例如 `params.json`：

   ```json
   {
     "app_token": "your_app_token",
     "table_id": "your_table_id",
     "record_id": "recxxxxxxxx",
     "tenant_access_token": "your_tenant_access_token",
     "fields": {}
   }
   ```

2. **运行脚本**

   ```bash
   node scripts/record/update.js --parameter-file-path "C:/Users/username/AppData/Local/Temp/feishu-operation-1740374400000-a7x9k2.json"
   ```

   > ⚠️ 注意：
   >
   > - `--parameter-file-path` 必须使用绝对路径
   > - 路径中必须使用正斜杠 `/`
