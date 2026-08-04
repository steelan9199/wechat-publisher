# 批量删除文件

## 概述

根据一组文件信息列表，批量删除飞书云空间中的文件。文件被删除后会进入回收站，可在飞书客户端中恢复。

支持多种文件类型（`docx`、`doc`、`sheet`、`bitable`、`mindnote`、`slides`、`shortcut`、`file`），不支持文件夹。如需删除文件夹，请使用 `delete-file.js` 单个删除。

## ⚠️ 调用前置条件（必读）

**调用本脚本前，必须同时满足以下两个条件，否则禁止调用：**

| 条件 | 说明 |
| ---- | ---- |
| ① 已知文件 token | 每个文件的 token 必须已明确获取 |
| ② 已知文件类型 | 每个文件的 type 必须已明确确认 |

**token 和 type 是一个文件的完整信息，必须成对提供，缺一不可。** 如果任一条件不满足，禁止调用本功能。

### 类型确认方式

通过以下方式获取文件的 `token` 和 `type`，确认后方可调用本脚本：

| 确认方式 | 适用场景 | 操作 |
| -------- | -------- | ---- |
| `get-files.js` | 批量确认某文件夹下所有文件的类型 | 获取文件清单后，从返回结果中提取每个文件的 `token` 和 `type` |
| `get-file-meta.js` | 确认单个或少量文件的类型 | 根据文件 token 获取元数据，查看 `type` 字段 |

### 禁止调用的情形

- ❌ 未经过任何类型确认，直接传入 token 列表
- ❌ 文件信息中缺少 `token` 或 `type`
- ❌ `files` 中包含 `folder` 类型的文件夹

## 使用限制

- 飞书删除接口限制：**5 QPS**，不支持并发，**10000 次/天**
- 脚本内置频率控制：每删除一个文件后等待 250ms，每 5 个文件额外等待 1 秒
- 删除文件为**同步操作**，无需查询异步任务状态

## 使用方式

### 命令行调用

```bash
cd $SKILL_DIR/scripts; if ($?) { node batch-delete-file.js --parameter-file-path <参数文件绝对路径> }
```

### 参数文件格式

`files` 为对象数组，每个对象必须同时包含 `token` 和 `type`：

```json
{
  "tenant_access_token": "t-xxx",
  "files": [
    { "token": "token1", "type": "docx" },
    { "token": "token2", "type": "sheet" },
    { "token": "token3", "type": "bitable" }
  ]
}
```

### 参数说明

| 参数名              | 类型   | 必填 | 说明                                              | 默认值 |
| ------------------- | ------ | ---- | ------------------------------------------------- | ------ |
| tenant_access_token | string | yes  | 飞书应用租户访问令牌                              | -      |
| files               | array  | yes  | 文件信息列表，每个元素为 `{ "token": "xxx", "type": "docx" }` 对象 | -      |

> ⚠️ **每个文件对象必须同时包含 `token` 和 `type`**，二者缺一不可。`type` 没有默认值，不支持仅传 token 字符串数组。调用前必须通过 `get-files.js` 或 `get-file-meta.js` 确认文件类型。

#### type 参数可选值（仅文件类型）

| 类型       | 说明           |
| ---------- | -------------- |
| `file`     | 普通文件类型   |
| `docx`     | 新版文档类型   |
| `bitable`  | 多维表格类型   |
| `doc`      | 文档类型       |
| `sheet`    | 电子表格类型   |
| `mindnote` | 思维笔记类型   |
| `slides`   | 幻灯片类型     |
| `shortcut` | 快捷方式类型   |

> ⚠️ **不支持 `folder` 类型**。如需删除文件夹，请使用 `delete-file.js`。

## 使用示例

### 示例 1：批量删除同类型文件

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "files": [
    { "token": "BJLkdtBiKooLjUxiCN3caeHanog", "type": "docx" },
    { "token": "KcMndDwQWoAbjXx3acJcA8ynnYh", "type": "docx" }
  ]
}
```

### 示例 2：批量删除混合类型文件

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "files": [
    { "token": "BJLkdtBiKooLjUxiCN3caeHanog", "type": "docx" },
    { "token": "XmlTfpUwQlH7ZTdih8gcN753nyc", "type": "sheet" },
    { "token": "I1acdiFyzoPGiCxyUnNcNwK4nLf", "type": "bitable" }
  ]
}
```

### ❌ 错误用法：仅传 token 字符串（脚本会拒绝执行）

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "files": ["token1", "token2", "token3"]
}
```

> 上述写法缺少 `type`，脚本会报错拒绝执行。token 和 type 必须成对提供。

### ❌ 错误用法：对象缺少 type（脚本会拒绝执行）

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "files": [
    { "token": "token1", "type": "docx" },
    { "token": "token2" }
  ]
}
```

> 第二个文件缺少 `type`，脚本会标记该文件为失败。

## 返回结果

### 成功

```json
{
  "code": 0,
  "msg": "批量删除完成：成功 3 个，失败 0 个，耗时 2.5 秒",
  "data": {
    "total": 3,
    "success": 3,
    "failed": 0,
    "elapsed_seconds": 2.5,
    "failed_files": [],
    "results": [
      { "index": 1, "file_token": "token1", "type": "docx", "status": "success" },
      { "index": 2, "file_token": "token2", "type": "docx", "status": "success" },
      { "index": 3, "file_token": "token3", "type": "docx", "status": "success" }
    ]
  }
}
```

### 部分失败

```json
{
  "code": 0,
  "msg": "批量删除完成：成功 2 个，失败 1 个，耗时 3.0 秒",
  "data": {
    "total": 3,
    "success": 2,
    "failed": 1,
    "elapsed_seconds": 3.0,
    "failed_files": [
      { "index": 2, "token": "token2", "type": "docx", "msg": "文件不存在或已删除" }
    ],
    "results": [
      { "index": 1, "file_token": "token1", "type": "docx", "status": "success" },
      { "index": 2, "file_token": "token2", "type": "docx", "status": "failed", "msg": "文件不存在或已删除" },
      { "index": 3, "file_token": "token3", "type": "docx", "status": "success" }
    ]
  }
}
```

### 返回字段说明

| 字段                  | 说明                                                         |
| --------------------- | ------------------------------------------------------------ |
| total                 | 传入的文件总数                                               |
| success               | 成功删除的数量                                               |
| failed                | 删除失败的数量                                               |
| elapsed_seconds       | 总耗时（秒）                                                 |
| failed_files          | 失败文件列表，含 index、token、type、msg                     |
| results               | 全部文件的删除结果明细                                       |
| results[].index       | 文件序号（从 1 开始）                                        |
| results[].file_token  | 文件 token                                                   |
| results[].type        | 文件类型                                                     |
| results[].status      | 删除状态：`success` 或 `failed`                              |
| results[].msg         | 失败原因（仅失败时存在）                                     |

## 注意事项

1. **⚠️ 调用前必须确认文件类型**：每个文件的类型必须通过 `get-files.js` 或 `get-file-meta.js` 确认，未知类型的文件禁止传入
2. **token 和 type 成对提供**：每个文件对象必须同时包含 `token` 和 `type`，不支持仅传 token 字符串，`type` 没有默认值
3. **不支持文件夹**：本脚本仅支持文件类型，`type` 为 `folder` 时会直接报错
4. **回收站**：文件被删除后会进入回收站，可在飞书云空间回收站中恢复
5. **频率控制**：脚本内置 5 QPS 频率控制，无需手动调整
6. **权限要求**：应用或用户需为文件所有者并具有父文件夹的编辑权限，或为父文件夹的所有者/拥有全部权限
7. **输出大小**：当删除文件较多时，完整结果可能较大，脚本会自动将超长结果写入临时文件

## 错误处理

| 错误码   | 错误信息               | 解决方案                                                                                                                    |
| -------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 99991663 | Invalid access token   | 运行 `cd $SKILL_DIR/scripts; if ($?) { node get-tenant-access-token.js --parameter-file-path <参数文件绝对路径> }` 刷新令牌 |
| 1061003  | not found              | 检查 `type` 参数是否与实际文件类型匹配，检查 `file_token` 是否正确                                                          |
| 1061004  | forbidden              | 确认应用或用户是否具有删除权限（文件所有者+父文件夹编辑权限，或父文件夹所有者）                                            |
| 1061045  | too many requests      | 请求频率超限，脚本已内置频率控制，如仍触发可稍后重试失败的文件                                                              |
| -1       | 参数文件中必须包含...  | 检查参数文件是否包含 `tenant_access_token` 和 `files` 字段                                                                  |
| -1       | 缺少 token 或 type     | 每个文件对象必须同时包含 `token` 和 `type`。请先通过 `get-files.js` 或 `get-file-meta.js` 确认文件信息                      |
| -1       | type 参数无效          | 检查 `type` 参数是否为支持的文件类型：file, docx, bitable, doc, sheet, mindnote, slides, shortcut                           |
