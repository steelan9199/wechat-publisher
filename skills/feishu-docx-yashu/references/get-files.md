# 获取文件夹中的文件清单

## 概述

获取用户云空间指定文件夹中文件信息清单。文件信息包括名称、类型、token、创建时间、修改时间、所有者 ID、上级目录 token、URL 等。

**使用限制**：

- 本接口仅支持获取当前层级的文件信息，不支持递归获取子文件夹中的文件信息清单
- 获取根目录下的清单时返回全部数据，不支持分页
- `page_size` 最大值为 200，默认值为 100

## 使用方式

### 命令行调用

```bash
cd "$SKILL_DIR/scripts" && node get-files.js --parameter-file-path <参数文件绝对路径>
```

### 参数文件格式

```json
{
  "tenant_access_token": "t-xxx",
  "folder_token": "XmlTfpUwQlH7ZTdih8gcN753nyc"
}
```

### 参数说明

| 参数名              | 类型   | 必填 | 说明                                                                                                                                            | 默认值         |
| ------------------- | ------ | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| tenant_access_token | string | yes  | 飞书应用租户访问令牌                                                                                                                            | -              |
| folder_token        | string | no   | 文件夹的 token。为空字符串或不传时获取根目录下的清单                                                                                            | `""`（根目录） |
| page_size           | int    | no   | 每页数据项数量，最大 200                                                                                                                        | 100            |
| page_token          | string | no   | 分页标记，第一次请求不填，表示从头开始遍历                                                                                                      | -              |
| order_by            | string | no   | 排序字段：`EditedTime`（按编辑时间）、`CreatedTime`（按创建时间）                                                                               | `EditedTime`   |
| direction           | string | no   | 排序规则：`ASC`（升序）、`DESC`（降序）                                                                                                         | `DESC`         |
| fetch_all           | bool   | no   | 是否自动遍历所有分页返回全部文件。设为 `true` 时忽略 `page_token` 自动翻页                                                                      | `false`        |
| limit               | int    | no   | 返回结果的最大数量。获取数据后在内存截取前 N 项输出，适用于根目录等不支持分页的场景，可显著减少输出体积                                         | -              |
| filter_type         | string | no   | 类型筛选：`file`(仅文件，排除folder)、`folder`(仅文件夹)、或具体类型(`docx`/`sheet`/`bitable`/`doc`/`mindnote`/`slides`/`file`等)。不传则不筛选 | -              |

> **user_id_type 固定为 `open_id`**，由脚本内部自动设置，无需手动传入。

## 使用示例

### 示例 1：获取指定文件夹下的文件清单

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "folder_token": "XmlTfpUwQlH7ZTdih8gcN753nyc"
}
```

### 示例 2：获取根目录下的文件清单

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "folder_token": ""
}
```

### 示例 3：自定义每页数量和排序

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "folder_token": "XmlTfpUwQlH7ZTdih8gcN753nyc",
  "page_size": 50,
  "order_by": "CreatedTime",
  "direction": "ASC"
}
```

### 示例 4：翻页获取下一页

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "folder_token": "XmlTfpUwQlH7ZTdih8gcN753nyc",
  "page_size": 2,
  "page_token": "v3|bcOzKsKPwo3DrcK2wqfDsUHCi8OlYcKuw6fCn2PDh8Ofw4PCgj"
}
```

### 示例 5：自动获取全部文件（跨分页）

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "folder_token": "XmlTfpUwQlH7ZTdih8gcN753nyc",
  "fetch_all": true
}
```

### 示例 6：仅返回最新的 N 个文件（推荐用于根目录）

根目录不支持分页，会一次性返回全部文件。通过 `limit` 在内存截取前 N 项，避免输出过大。

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "folder_token": "",
  "limit": 3,
  "order_by": "EditedTime",
  "direction": "DESC"
}
```

### 示例 7：仅获取最新的 N 个文件（排除文件夹）

通过 `filter_type: "file"` 排除文件夹类型，仅返回真正的文件（docx/sheet/bitable 等）。筛选在 limit 截断之前执行，确保 limit 针对筛选后的结果。

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "folder_token": "",
  "filter_type": "file",
  "limit": 3,
  "order_by": "EditedTime",
  "direction": "DESC"
}
```

返回示例（筛选 + limit 截断场景，展示 `filtered_total` / `filter_type` / `filtered` 的非 null 取值）：

```json
{
  "code": 0,
  "msg": "获取文件清单成功（filter_type=file，筛选后 4 项（筛选前 5 项），已按 limit=3 截断，返回前 3 项）",
  "data": {
    "folder_token": "",
    "files": [
      {
        "name": "周报.docx",
        "type": "docx",
        "token": "ZWs5dGFL2onOptxC9VncqltEntb",
        "url": "https://kr0lqjlbmo.feishu.cn/docx/ZWs5dGFL2onOptxC9VncqltEntb",
        "parent_token": "",
        "owner_id": "ou_c7c36c578623b98085029b7879b6a080",
        "created_time": "1785678609",
        "modified_time": "1785678611"
      }
    ],
    "has_more": false,
    "next_page_token": "",
    "total": 5,
    "filtered_total": 4,
    "returned": 3,
    "fetch_all": false,
    "filter_type": "file",
    "filtered": true,
    "limit": 3,
    "limited": true
  }
}
```

### 示例 8：仅获取文件夹

通过 `filter_type: "folder"` 仅返回文件夹类型。

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "folder_token": "",
  "filter_type": "folder",
  "limit": 5,
  "order_by": "EditedTime",
  "direction": "DESC"
}
```

### 示例 9：按具体类型筛选

通过指定具体类型（如 `docx`、`sheet`、`bitable` 等）仅返回该类型的文件。

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "folder_token": "",
  "filter_type": "docx",
  "limit": 5,
  "order_by": "EditedTime",
  "direction": "DESC"
}
```

## 返回结果

### 成功

```json
{
  "code": 0,
  "msg": "获取文件清单成功",
  "data": {
    "folder_token": "XmlTfpUwQlH7ZTdih8gcN753nyc",
    "files": [
      {
        "name": "测试文档标题",
        "type": "docx",
        "token": "ZWs5dGFL2onOptxC9VncqltEntb",
        "url": "https://kr0lqjlbmo.feishu.cn/docx/ZWs5dGFL2onOptxC9VncqltEntb",
        "parent_token": "XmlTfpUwQlH7ZTdih8gcN753nyc",
        "owner_id": "ou_c7c36c578623b98085029b7879b6a080",
        "created_time": "1785678609",
        "modified_time": "1785678611"
      }
    ],
    "has_more": false,
    "next_page_token": "",
    "total": 1,
    "filtered_total": null,
    "returned": 1,
    "fetch_all": false,
    "filter_type": null,
    "filtered": false,
    "limit": null,
    "limited": false
  }
}
```

| 字段                  | 说明                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------- |
| folder_token          | 当前查询的文件夹 token                                                                   |
| files                 | 文件清单列表                                                                             |
| files[].name          | 文件名称                                                                                 |
| files[].type          | 文件类型（`docx`、`folder`、`sheet`、`bitable`、`doc`、`mindnote`、`slides`、`file` 等） |
| files[].token         | 文件的唯一标识 token                                                                     |
| files[].url           | 文件的 URL 链接                                                                          |
| files[].parent_token  | 上级目录的 token                                                                         |
| files[].owner_id      | 所有者 ID（open_id 类型）                                                                |
| files[].created_time  | 创建时间（Unix 时间戳，秒）                                                              |
| files[].modified_time | 最后修改时间（Unix 时间戳，秒）                                                          |
| has_more              | 是否还有更多项                                                                           |
| next_page_token       | 下一页的分页标记，`has_more` 为 `true` 时返回                                            |
| total                 | 实际获取到的文件总数（截断前）                                                           |
| filtered_total        | 筛选后的文件数量，未筛选时为 `null`                                                      |
| returned              | 实际返回的文件数量（截断后）                                                             |
| fetch_all             | 是否为自动遍历全部模式                                                                   |
| filter_type           | 筛选类型，未筛选时为 `null`                                                              |
| filtered              | 是否已按 `filter_type` 筛选，未筛选时为 `false`                                          |
| limit                 | 限制返回数量，未设置时为 `null`                                                          |
| limited               | 是否已按 `limit` 截断                                                                    |

### 失败

```json
{
  "code": -1,
  "msg": "错误信息描述",
  "data": null
}
```

## 注意事项

1. **层级限制**：仅返回当前层级文件，不递归获取子文件夹内容
2. **根目录**：`folder_token` 为空字符串或不传时获取根目录清单，此时飞书 API 返回全部数据且不支持分页
3. **默认排除文件夹（重要）**：当用户表达"获取文件""获取最新文件""列出文件"等意图时，AI **默认必须**在参数文件中添加 `"filter_type": "file"` 以排除 folder 类型，仅返回真正的文件（docx/sheet/bitable/slides 等）。仅当用户明确提及"文件夹"或"包括文件夹"或"获取文件夹"时，才不添加此筛选参数
4. **limit 截断**：根目录等不支持分页的场景下，文件较多会导致输出过大。传入 `limit` 可在获取后在内存截取前 N 项输出，显著减少输出体积（如「获取最新 3 个文件」用 `limit: 3`）
5. **分页**：当 `has_more` 为 `true` 时，使用返回的 `next_page_token` 作为 `page_token` 请求下一页
6. **权限要求**：需要应用具有该文件夹的读取权限
7. **权限配置**：若返回 `1061004`（forbidden），需在浏览器中打开文件夹链接，将飞书企业自建应用添加为协作者并赋予「可管理」权限
8. **fetch_all**：开启后会自动翻页直到 `has_more` 为 `false`，文件较多时耗时较长（每页按 200 条高效拉取）
9. **filter_type 筛选**：在内存中对获取到的文件按 `type` 字段筛选，在 `limit` 截断之前执行。`file` 排除 `folder` 类型，`folder` 仅返回文件夹，也可传具体类型如 `docx`/`sheet`/`bitable` 等

## 错误处理

| 错误码   | 错误信息                               | 解决方案                                                                                                            |
| -------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 99991663 | Invalid access token                   | 运行 `cd "$SKILL_DIR/scripts" && node get-tenant-access-token.js --parameter-file-path <参数文件绝对路径>` 刷新令牌 |
| 1061004  | forbidden                              | 在浏览器中打开文件夹链接，将飞书企业自建应用添加为协作者并赋予「可管理」权限                                        |
| -1       | 参数文件中必须包含 tenant_access_token | 检查参数文件是否包含 `tenant_access_token` 字段                                                                     |
| -1       | 必须提供 --parameter-file-path 参数    | 通过 `--parameter-file-path` 传递参数文件绝对路径                                                                   |
