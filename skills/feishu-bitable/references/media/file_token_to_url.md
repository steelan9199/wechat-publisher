# 飞书多维表格`获取素材/文件的直链`API使用指南

## 📋 概述

**API功能**：该接口用于获取云文档中素材的临时下载链接。链接的有效期为 24 小时，过期失效。
**接口限制**：

- 接口调用频率上限为 5 QPS，10000 次/天

## 要传入的参数说明

### 1. 命令行参数

本脚本通过命令行参数接收配置：

| 参数名                  | 类型   | 必填 | 说明                                                                   |
| ----------------------- | ------ | ---- | ---------------------------------------------------------------------- |
| `--parameter-file-path` | string | 是   | 参数配置文件的路径，**必须使用绝对路径**；路径中使用正斜杠 `/`；包含空格时需用双引号包裹 |

### 2. 参数文件内容（JSON Schema）

```json
{
  "tenant_access_token": {
    "type": "string",
    "description": "API 的访问凭证参数",
    "required": true
  },
  "file_tokens": {
    "required": true,
    "type": "array",
    "description": "素材文件的token列表, 飞书多维表格：通过`批量获取记录`或者`查询记录`任意一个接口, 获取指定附件字段类型的文件/素材信息的 file_token，即为素材的 token",
    "minLength": 1,
    "maxLength": 5,
    "items": {
      "type": "string",
      "description": "素材/文件的file_token"
    }
  },
  "extra": {
    "required": true,
    "type": "string",
    "description": "扩展信息，用于高级权限多维表格的鉴权，包含素材/文件所在的数据表的table_id",
    "examples": [
      "{\"bitablePerm\":{\"tableId\":\"tblO6OeNZxfabcef\"}}",
      "{\"bitablePerm\":{\"tableId\":\"tbleb6obtRqCEIiV\"}}"
    ]
  }
}
```

## 飞书多维表格`获取素材/文件的直链`工作步骤

1. **创建参数配置文件**

   根据上方【参数文件内容（JSON Schema）】创建 JSON 文件，例如 `params.json`：

   ```json
   {
     "tenant_access_token": "your_tenant_access_token",
     "file_tokens": ["file_token_1", "file_token_2"],
     "extra": ""
   }
   ```

   > ⚠️ **重要提示**：
   > - 参数名必须是 `file_tokens`（复数形式，带 s），不是 `file_token`
   > - `file_tokens` 必须是**数组类型**，即使只有一个 token 也要用数组包裹
   > - 错误示例 ❌：`"file_token": "xxx"`
   > - 正确示例 ✅：`"file_tokens": ["xxx"]`

2. **运行脚本**

   ```bash
   node scripts/media/file-token-to-url.js --parameter-file-path "C:/Users/username/AppData/Local/Temp/feishu-operation-1740374400000-a7x9k2.json"
   ```

   > ⚠️ 注意：
   >
   > - `--parameter-file-path` 必须使用绝对路径
   > - 路径中必须使用正斜杠 `/`
