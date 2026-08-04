# 搜索云文档

## 概述

根据搜索关键词（search_key）对当前用户可见的云文档进行搜索，返回匹配的文件列表（包含文件 token、类型、所有者、标题）及总数。

## 使用方式

### 命令行调用

```bash
cd $SKILL_DIR/scripts; if ($?) { node search-document.js --parameter-file-path <参数文件绝对路径> }
```

### 参数文件格式

```json
{
  "tenant_access_token": "t-g10483bSOFA4XMW5U4CWO7JDB7SLVRAYGIKY2Q5Y",
  "search_key": "项目",
  "count": 10,
  "offset": 0,
  "owner_ids": [],
  "chat_ids": [],
  "docs_types": ["doc", "sheet"]
}
```

### 参数说明

| 参数名              | 类型     | 必填 | 说明                                                      | 默认值 |
| ------------------- | -------- | ---- | --------------------------------------------------------- | ------ |
| tenant_access_token | string   | yes  | 访问令牌（支持 tenant_access_token 与 user_access_token） | -      |
| search_key          | string   | yes  | 搜索关键词                                                | -      |
| count               | int      | no   | 返回的文件数量，取值范围 [0, 50]                          | `20`   |
| offset              | int      | no   | 搜索偏移量，最小为 0。约束：offset + count < 200          | `0`    |
| owner_ids           | string[] | no   | 文件所有者的 Open ID 列表，用于过滤指定所有者的文件       | `[]`   |
| chat_ids            | string[] | no   | 文件所在群的 ID 列表，用于过滤指定群内的文件              | `[]`   |
| docs_types          | string[] | no   | 文件类型过滤，可选值见下方枚举表                          | `[]`   |

### docs_types 枚举值

| 值         | 类型说明                         |
| ---------- | -------------------------------- |
| `doc`      | 文档（包括旧版 doc 和新版 docx） |
| `sheet`    | 电子表格                         |
| `slides`   | 幻灯片                           |
| `bitable`  | 多维表格                         |
| `mindnote` | 思维笔记                         |
| `file`     | 文件                             |

## 使用示例

### 示例 1：基本搜索

```json
{
  "tenant_access_token": "t-g10483bSOFA4XMW5U4CWO7JDB7SLVRAYGIKY2Q5Y",
  "search_key": "项目"
}
```

### 示例 2：按文件类型过滤搜索

```json
{
  "tenant_access_token": "t-g10483bSOFA4XMW5U4CWO7JDB7SLVRAYGIKY2Q5Y",
  "search_key": "项目",
  "count": 10,
  "docs_types": ["doc", "sheet"]
}
```

### 示例 3：分页搜索（第二页）

```json
{
  "tenant_access_token": "t-g10483bSOFA4XMW5U4CWO7JDB7SLVRAYGIKY2Q5Y",
  "search_key": "项目",
  "count": 10,
  "offset": 10
}
```

### 示例 4：按所有者过滤搜索

```json
{
  "tenant_access_token": "t-g10483bSOFA4XMW5U4CWO7JDB7SLVRAYGIKY2Q5Y",
  "search_key": "项目",
  "owner_ids": ["ou_b97fbe610114d9489ff3b501a71abcef"]
}
```

## 返回结果

### 成功

```json
{
  "code": 0,
  "msg": "搜索云文档成功",
  "data": {
    "docs_entities": [
      {
        "docs_token": "shtcnLkpxnlYksumuGNZM1abcef",
        "docs_type": "sheet",
        "owner_id": "ou_b97fbe610114d9489ff3b501a71abcef",
        "title": "项目进展周报"
      },
      {
        "docs_token": "shtcnHO7UvaulkYDXCyQraabcef",
        "docs_type": "sheet",
        "owner_id": "ou_b97fbe610114d9489ff3b501a71abcef",
        "title": "项目管理十大模板"
      }
    ],
    "has_more": true,
    "total": 59
  }
}
```

| 字段                       | 说明                                               |
| -------------------------- | -------------------------------------------------- |
| docs_entities              | 搜索结果文件列表                                   |
| docs_entities[].docs_token | 文件的 token                                       |
| docs_entities[].docs_type  | 文件类型（doc/sheet/slides/bitable/mindnote/file） |
| docs_entities[].owner_id   | 文件所有者的 Open ID                               |
| docs_entities[].title      | 文件标题                                           |
| has_more                   | 结果列表后是否还有数据                             |
| total                      | 包含搜索关键词的文件总数量                         |

### 失败

```json
{
  "code": -1,
  "msg": "错误信息描述",
  "data": null
}
```

## 注意事项

1. **认证方式**：此接口同时支持 `tenant_access_token`（应用身份）和 `user_access_token`（用户身份）鉴权
2. **搜索范围**：仅搜索当前用户**可见**的云文档，非云空间全部文档
3. **分页约束**：`offset + count < 200`，单次最多返回 50 条（count 上限 50），超出约束脚本会报错
4. **权限要求**：需为应用开启 `docs:doc:readonly`、`docs:doc` 或 `search:document:readonly` 权限，开启任一即可
5. **获取 tenant_access_token**：参考飞书官方文档 [获取 tenant_access_token](https://open.feishu.cn/document/ukTMukTMukTM/ukDNz4SO0MjL5QzM/auth-v3/auth/tenant_access_token_internal)

## 错误处理

| 错误码   | 错误信息                               | 解决方案                                                                                                |
| -------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 99991663 | Invalid access token                   | access token 无效或已过期，需重新获取新的 tenant_access_token 或 user_access_token                      |
| 91201    | FAILED                                 | 处理失败，请稍后重试或联系飞书技术支持                                                                  |
| 91204    | FORBIDDEN                              | 当前应用或用户没有权限，请为应用开启 `docs:doc:readonly`、`docs:doc` 或 `search:document:readonly` 权限 |
| -1       | 参数文件中必须包含 tenant_access_token | 检查参数文件是否包含 `tenant_access_token` 字段                                                         |
| -1       | 参数文件中必须包含 search_key          | 检查参数文件是否包含 `search_key` 字段                                                                  |
| -1       | count 取值范围为 [0, 50]               | 检查 count 参数是否在有效范围内                                                                         |
| -1       | 约束条件：offset + count < 200         | 减小 offset 或 count，确保两者之和小于 200                                                              |
