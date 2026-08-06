# 飞书多维表格`素材/文件上传`API使用指南

## 📋 概述

**API功能**：将文件、图片、视频等素材上传到指定的飞书多维表格中
**接口限制**：

- 接口调用频率上限为 5 QPS，10000 次/天

## 要传入的参数说明

### 1. 命令行参数

本脚本通过命令行参数接收配置：

| 参数名                  | 类型   | 必填 | 说明                                                                                     |
| ----------------------- | ------ | ---- | ---------------------------------------------------------------------------------------- |
| `--parameter-file-path` | string | 是   | 参数配置文件的路径，**必须使用绝对路径**；路径中使用正斜杠 `/`；包含空格时需用双引号包裹 |

### 2. 参数文件内容（JSON Schema）

```json
{
  "tenant_access_token": {
    "type": "string",
    "description": "API 的访问凭证参数",
    "required": true
  },
  "file_name": {
    "required": true,
    "type": "string",
    "description": "要上传的素材的名称",
    "maxLength": 250,
    "examples": ["demo.jpeg"]
  },
  "parent_type": {
    "required": true,
    "type": "string",
    "description": "上传点的类型。你可根据上传的素材类型,确定上传点类型。如果是图片, 那么就用'bitable_image', 如果是其他类型的文件, 那么就用'bitable_file'",
    "enum": ["bitable_image", "bitable_file"],
    "enumDescriptions": {
      "bitable_image": "多维表格图片",
      "bitable_file": "多维表格文件"
    },
    "examples": ["bitable_file"]
  },
  "parent_node": {
    "required": true,
    "type": "string",
    "description": "就是飞书多维表格的app_token(多维表格 App 的唯一标识), 只是参数名字不一样.",
    "examples": ["D7rGbT0YGaJzKRsg3eUcCyzSnlf"]
  },
  "extra": {
    "required": true,
    "type": "string",
    "description": "JSON字符串，格式：`{\"drive_route_token\":\"多维表格的app_token\"}`<br>例如：`{\"drive_route_token\":\"D7rGbT0YGaJzKRsg3eUcCyzSnlf\"}`",
    "pattern": "^\\{\\s*\"drive_route_token\"\\s*:\\s*\"[^\"\\r\\n]+\"\\s*\\}$",
    "examples": ["{\"drive_route_token\":\"D7rGbT0YGaJzKRsg3eUcCyzSnlf\"}"]
  },
  "file_path": {
    "required": true,
    "type": "string",
    "description": "要上传的文件的绝对路径, 路径之间的分隔符使用'/', 禁止使用'\\'"
  }
}
```

## ⚠️ 常见错误及解决方案

| 错误信息                 | 原因                         | 解决方案                                 |
| ------------------------ | ---------------------------- | ---------------------------------------- |
| `file_name is required`  | 缺少 `file_name` 参数        | 确保参数文件中包含 `file_name` 字段      |
| `parent_type is invalid` | `parent_type` 值不正确       | 使用 `bitable_image` 或 `bitable_file`   |
| `extra format error`     | `extra` 参数格式错误         | 确保格式为 `{"drive_route_token":"xxx"}` |
| `file not found`         | `file_path` 指向的文件不存在 | 检查文件路径是否正确                     |

## 📝 文件路径格式说明

`file_path` 参数**必须使用正斜杠 `/`**，即使在 Windows 系统上：

✅ **正确示例**：

```json
{
  "file_path": "D:/测试专用/电商/小图.png"
}
```

❌ **错误示例**：

```json
{
  "file_path": "D:\\测试专用\\电商\\小图.png"
}
```

> 💡 **提示**：如果使用 Node.js 的 `path.join()`，请使用 `path.posix.join()` 或手动替换反斜杠为正斜杠。

## 🔗 与其他操作的关联

上传文件后，通常需要进行以下操作：

### 1. 获取下载链接

使用返回的 `file_token` 调用 `file-token-to-url.js` 获取临时下载链接。

### 2. 将图片添加到记录

使用 `file_token` 创建或更新记录，将图片添加到图片/附件类型的字段中：

```json
{
  "fields": {
    "图片字段名": [
      {
        "file_token": "Q47YbwKmcoZiPaxQUcScFrbonPe"
      }
    ]
  }
}
```

### 3. 批量操作

如果需要上传多个文件，可以：

1. 多次调用 `upload.js` 获取多个 `file_token`
2. 在创建记录时将所有 `file_token` 放入同一个数组中

## 飞书多维表格`素材/文件上传`工作步骤

1. **创建参数配置文件**

   根据上方【参数文件内容（JSON Schema）】创建 JSON 文件，例如 `params.json`：

   ```json
   {
     "tenant_access_token": "your_tenant_access_token",
     "file_name": "带后缀的文件名",
     "parent_type": "bitable_image",
     "parent_node": "D7rGbxxxxxxxxxxxxx",
     "extra": "{\"drive_route_token\":\"素材所在的飞书多维表格的app_token\"}",
     "file_path": "本地文件的绝对路径, 分隔符使用正斜杆('/')"
   }
   ```

2. **运行脚本**

   ```bash
   cd $SKILL_DIR/scripts && node media/upload.js --parameter-file-path "$SKILL_DIR/temp/feishu-operation-1740374400000-a7x9k2.json"
   ```

   > ⚠️ 注意：
   >
   > - `--parameter-file-path` 必须使用绝对路径
   > - 路径中必须使用正斜杠 `/`
