# 搜索云文档

## 概述

根据搜索关键词（query）对当前用户可见的云文档进行搜索。支持通过 `doc_filter`（云文档过滤）和 `wiki_filter`（知识库过滤）进行精细过滤，二者至少传一个。

## 使用方式

### 命令行调用

```bash
cd $SKILL_DIR/scripts; if ($?) { node search-document.js --parameter-file-path <参数文件绝对路径> }
```

### 参数文件格式

```json
{
  "tenant_access_token": "t-g10483bSOFA4XMW5U4CWO7JDB7SLVRAYGIKY2Q5Y",
  "query": "项目",
  "doc_filter": {
    "doc_types": ["DOC", "SHEET"]
  },
  "page_size": 20
}
```

### 参数说明

| 参数名              | 类型   | 必填 | 说明                                                                                                                       | 默认值 |
| ------------------- | ------ | ---- | -------------------------------------------------------------------------------------------------------------------------- | ------ |
| tenant_access_token | string | yes  | 访问令牌，统一通过 tenant_access_token 字段传入（值可为应用令牌或用户令牌）                                                | -      |
| query               | string | yes  | 搜索关键词，长度范围 0~30 字符                                                                                             | -      |
| doc_filter          | object | no   | 云文档过滤参数，与 wiki_filter 至少传一个。若 doc_filter 和 wiki_filter 均未传，脚本默认使用空的 doc_filter 搜索全部云文档 | -      |
| wiki_filter         | object | no   | 知识库过滤参数，与 doc_filter 至少传一个                                                                                   | -      |
| page_size           | int    | no   | 分页大小，取值范围 [0, 20], 默认值：20                                                                                     | -      |
| page_token          | string | no   | 分页标记，首次请求不填；后续请求使用返回的 page_token 继续遍历                                                             | -      |

### doc_filter 子参数

> `doc_filter` 为请求体第一层级对象，下表字段均为其子字段。

| 字段名               | 类型       | 说明                                                                                 | 默认值 / 约束             |
| -------------------- | ---------- | ------------------------------------------------------------------------------------ | ------------------------- |
| creator_ids          | string[]   | 文档所有者 Open ID 列表                                                              | 长度范围 0~20             |
| doc_types            | string[]   | 文档类型过滤，可选值见下方枚举表                                                     | 长度范围 0~10             |
| folder_tokens        | string[]   | 搜索指定文件夹内的文档（文件夹 token 列表）。**注：存在该字段时 wiki_filter 将失效** | 长度范围 0~50             |
| only_title           | boolean    | 仅搜文档标题                                                                         | 默认 `false`              |
| open_time            | time_range | 浏览文档的时间范围（秒级时间戳，包含start和end字段）                                 | `{start, end}` 秒级时间戳 |
| sort_type            | string     | 排序方式，可选值见下方枚举表                                                         | 默认排序 `DEFAULT_TYPE`   |
| create_time          | time_range | 文档创建的时间范围（秒级时间戳，包含start和end字段）                                 | `{start, end}` 秒级时间戳 |
| chat_ids             | string[]   | 搜索在会话内的文档, 示例值：["ou_7890123456"]                                        | 长度范围 0~20             |
| sharer_ids           | string[]   | 文档分享者 Open ID 列表, 示例值：["ou_789012"]                                       | 长度范围 0~20             |
| only_comment         | boolean    | 仅搜文档评论                                                                         | 默认 `false`              |
| my_edit_time         | time_range | 我编辑的文档的时间范围（秒级时间戳，包含start和end字段）                             | `{start, end}` 秒级时间戳 |
| my_comment_time      | time_range | 我评论的文档的时间范围（秒级时间戳，包含start和end字段）                             | `{start, end}` 秒级时间戳 |
| original_creator_ids | string[]   | 文档创建者者OpenID，注意和creator_ids区分开. 示例值：["ou_789012"]                   | 长度范围 0~20             |

### wiki_filter 子参数

> `wiki_filter` 为请求体第一层级对象，下表字段均为其子字段。与 `doc_filter` 至少传一个。

| 字段名               | 类型       | 说明                                                                          | 默认值 / 约束             |
| -------------------- | ---------- | ----------------------------------------------------------------------------- | ------------------------- |
| creator_ids          | string[]   | Wiki 所有者 Open ID 列表, 示例值：["ou_7890123456abcdef"]                     | 长度范围 0~20             |
| doc_types            | string[]   | Wiki 类型过滤，可选值见下方枚举表, 示例值：["SHORTCUT"]                       | 长度范围 0~10             |
| space_ids            | string[]   | 搜索指定 Space 下的 Wiki（Space ID 列表）, 示例值：["space_1234567890fedcba"] | 长度范围 0~50             |
| only_title           | boolean    | 仅搜 Wiki 标题                                                                | 默认 `false`              |
| open_time            | time_range | 浏览文档的时间范围（秒级时间戳，包含start和end字段）                          | `{start, end}` 秒级时间戳 |
| sort_type            | string     | 排序方式，可选值见下方枚举表                                                  | 默认排序                  |
| create_time          | time_range | Wiki 创建的时间范围（秒级时间戳，包含start和end字段）                         | `{start, end}` 秒级时间戳 |
| chat_ids             | string[]   | 搜索在会话内的文档, 示例值：["ou_7890123456"]                                 | 长度范围 0~20             |
| sharer_ids           | string[]   | 文档分享者 Open ID 列表, 示例值：["ou_789012"]                                | 长度范围 0~20             |
| only_comment         | boolean    | 仅搜文档评论                                                                  | 默认 `false`              |
| my_edit_time         | time_range | 我编辑的文档的时间范围（秒级时间戳，包含start和end字段）                      | `{start, end}` 秒级时间戳 |
| my_comment_time      | time_range | 我评论的文档的时间范围（秒级时间戳，包含start和end字段）                      | `{start, end}` 秒级时间戳 |
| original_creator_ids | string[]   | 文档创建者者OpenID，注意和creator_ids区分开, 示例值：["ou_789012"]            | 长度范围 0~20             |

### time_range 结构

所有时间范围字段复用该结构，`start`、`end` 均为**秒级时间戳**：

```json
{
  "start": 1700000000,
  "end": 1710000000
}
```

### doc_types 枚举值

| 值         | 类型说明      |
| ---------- | ------------- |
| `DOC`      | 文档          |
| `SHEET`    | 表格          |
| `BITABLE`  | 多维表格      |
| `MINDNOTE` | 思维导图      |
| `FILE`     | 文件          |
| `WIKI`     | wiki          |
| `DOCX`     | 新版文档      |
| `FOLDER`   | space文件夹   |
| `CATALOG`  | wiki2.0文件夹 |
| `SLIDES`   | 新版幻灯片    |
| `SHORTCUT` | 快捷方式      |

### sort_type 枚举值

| 值              | 说明               |
| --------------- | ------------------ |
| `DEFAULT_TYPE`  | 默认排序           |
| `OPEN_TIME`     | User打开时间排序   |
| `EDIT_TIME`     | User编辑时间降序   |
| `EDIT_TIME_ASC` | User编辑时间升序   |
| `CREATE_TIME`   | 按文档创建时间排序 |

## 使用示例

### 示例 1：基本搜索

不传任何过滤参数，脚本默认搜索全部云文档：

```json
{
  "tenant_access_token": "t-g10483bSOFA4XMW5U4CWO7JDB7SLVRAYGIKY2Q5Y",
  "query": "项目"
}
```

### 示例 2：按文档类型过滤

```json
{
  "tenant_access_token": "t-g10483bSOFA4XMW5U4CWO7JDB7SLVRAYGIKY2Q5Y",
  "query": "项目",
  "doc_filter": {
    "doc_types": ["DOC", "SHEET"]
  }
}
```

### 示例 3：按文件夹搜索

```json
{
  "tenant_access_token": "t-g10483bSOFA4XMW5U4CWO7JDB7SLVRAYGIKY2Q5Y",
  "query": "项目",
  "doc_filter": {
    "folder_tokens": ["fld_123456"]
  }
}
```

### 示例 4：按所有者过滤

```json
{
  "tenant_access_token": "t-g10483bSOFA4XMW5U4CWO7JDB7SLVRAYGIKY2Q5Y",
  "query": "项目",
  "doc_filter": {
    "creator_ids": ["ou_b97fbe610114d9489ff3b501a71abcef"]
  }
}
```

### 示例 5：按创建时间范围过滤

```json
{
  "tenant_access_token": "t-g10483bSOFA4XMW5U4CWO7JDB7SLVRAYGIKY2Q5Y",
  "query": "项目",
  "doc_filter": {
    "create_time": {
      "start": 1700000000,
      "end": 1710000000
    }
  }
}
```

### 示例 6：分页搜索（获取第二页）

```json
{
  "tenant_access_token": "t-g10483bSOFA4XMW5U4CWO7JDB7SLVRAYGIKY2Q5Y",
  "query": "项目",
  "page_token": "上一页返回的 page_token 值"
}
```

### 示例 7：搜索指定知识空间的 Wiki

```json
{
  "tenant_access_token": "t-g10483bSOFA4XMW5U4CWO7JDB7SLVRAYGIKY2Q5Y",
  "query": "项目",
  "wiki_filter": {
    "space_ids": ["space_1234567890fedcba"]
  }
}
```

## 返回结果

### 成功

```json
{
  "code": 0,
  "msg": "搜索云文档成功",
  "data": {
    "res_units": [
      {
        "title": "<h>项目</h>进展周报",
        "summary": "本文介绍<h>项目</h>的管理流程",
        "entity_type": "DOC",
        "token": "dox_9876543210fedcba",
        "doc_types": "SHORTCUT",
        "url": "https://www.feishu.cn/docs/dox-1234567890abcdef",
        "owner_id": "ou_7890123456abcdef",
        "owner_name": "张三",
        "create_time": 1766567446,
        "update_time": 1766567446,
        "file_type": "pdf",
        "is_cross_tenant": false
      }
    ],
    "has_more": true,
    "total": 100,
    "page_token": "token_1234567890fedcba"
  }
}
```

| 字段                        | 说明                                        |
| --------------------------- | ------------------------------------------- |
| res_units                   | 搜索结果列表                                |
| res_units[].title           | 文档标题（含高亮标记 `<h></h>`）            |
| res_units[].summary         | 内容摘要（含高亮标记 `<h></h>`）            |
| res_units[].entity_type     | 实体类型（DOC / SHEET / BITABLE 等）        |
| res_units[].token           | 文档 token                                  |
| res_units[].doc_types       | 文档类型                                    |
| res_units[].url             | 文档访问 URL                                |
| res_units[].owner_id        | 所有者 Open ID                              |
| res_units[].owner_name      | 所有者名称                                  |
| res_units[].create_time     | 创建时间（秒级时间戳）                      |
| res_units[].update_time     | 更新时间（秒级时间戳）                      |
| res_units[].file_type       | 文件类型                                    |
| res_units[].is_cross_tenant | 是否跨租户                                  |
| has_more                    | 是否还有下一页数据                          |
| total                       | 匹配的文件总数量                            |
| page_token                  | 下一页分页 token（has_more 为 true 时有效） |

### 失败

```json
{
  "code": -1,
  "msg": "错误信息描述",
  "data": null
}
```

## 注意事项

1. **认证方式**：统一通过 `tenant_access_token` 字段传入访问令牌（值可为应用令牌 tenant_access_token 或用户令牌 user_access_token）
2. **搜索范围**：仅搜索当前用户**可见**的云文档，非云空间全部文档
3. **过滤条件**：`doc_filter` 和 `wiki_filter` 至少传一个；若均未传，脚本默认使用空的 `doc_filter` 搜索全部云文档
4. **folder_tokens 特殊行为**：`doc_filter` 中设置 `folder_tokens` 后，`wiki_filter` 将失效
5. **creator_ids 与 original_creator_ids**：前者为文档所有者，后者为文档原始创建者，语义不同，请勿混淆
6. **分页机制**：通过 `page_token` + `page_size` 实现分页，首次请求不传 `page_token`，后续请求将上一页返回的 `page_token` 传入即可获取下一页
7. **频率限制**：接口频率限制为 100 次/分钟，超限会返回 429 错误
8. **关键词长度**：`query` 不超过 30 个字符
9. **权限要求**：需为应用开启「搜索云文档」权限
10. **获取 tenant_access_token**：参考飞书官方文档 [获取 tenant_access_token](https://open.feishu.cn/document/ukTMukTMukTM/ukDNz4SO0MjL5QzM/auth-v3/auth/tenant_access_token_internal)

## 错误处理

| 错误码  | 错误信息                                | 解决方案                                                    |
| ------- | --------------------------------------- | ----------------------------------------------------------- |
| 1274001 | invalid param: missing required fields  | 检查请求头和请求体中是否包含必要的认证信息且字段是否完整    |
| 1274002 | invalid param: illegal enum value       | 验证枚举字段的值是否符合定义的合法枚举范围                  |
| 1274011 | user_access_token is invalid or expired | access token 无效或已过期，需重新获取新的 user_access_token |
| 1277001 | rate limit exceeded                     | 检查当前请求频率是否超过接口限制阈值（100 次/分钟）         |
| -1      | 参数文件中必须包含 tenant_access_token  | 检查参数文件是否包含 `tenant_access_token` 字段             |
| -1      | 参数文件中必须包含 query                | 检查参数文件是否包含 `query` 字段                           |
| -1      | query 长度不超过 30 个字符              | 缩短搜索关键词                                              |
| -1      | page_size 取值范围为 [0, 20]            | 检查 page_size 参数是否在有效范围内                         |
