# 搜索 Wiki

## 概述

根据关键词搜索当前用户可见的 Wiki 节点，返回匹配的节点列表（包含节点 token、知识空间 ID、文档类型、标题、访问 URL 等）及分页信息。

> **注**：Wiki 存在但搜索不到，可能是用户没有查看该 Wiki 的权限，而非搜索功能问题。

## query 参数取值规则（重要）

`query` 参数本质上是飞书云文档的**标题**，用于在 Wiki 中搜索标题匹配的节点。用户既可以直接提供搜索关键词，也可以提供飞书云文档链接，AI Agent 需根据用户输入类型决定处理方式：

| 用户输入类型 | 判断条件 | AI Agent 处理方式 |
| ------------ | -------- | ----------------- |
| 搜索关键词 | 输入不是 URL（不含 `http://` 或 `https://`） | 直接将关键词作为 `query` 值 |
| 文档链接 | 输入是飞书云文档链接（`https://xxx.feishu.cn/docx/...` 或 `https://xxx.feishu.cn/wiki/...`） | 先通过链接获取文档标题，再将标题作为 `query` 值 |

### 链接转标题的执行流程

当用户提供文档链接时，AI Agent 须按以下步骤操作：

1. **解析链接获取 document_id**：读取 [链接解析指南]($SKILL_DIR/references/url-to-document-id.md)，执行 `url-to-document-id.js` 从链接中解析出 `document_id`（即文件 token）和 `obj_type`
2. **获取文档标题**：读取 [获取文件元数据指南]($SKILL_DIR/references/get-file-meta.md)，执行 `get-file-meta.js`，将上一步得到的 `document_id` 作为 `doc_token`、`obj_type` 作为 `doc_type` 传入，获取返回结果中的 `title` 字段
3. **执行搜索**：将获取到的文档标题作为 `query` 值，执行 `search-wiki.js` 进行搜索

> **注**：若标题超过 50 个字符，搜索时会报错。此时 AI Agent 应截取标题前 50 个字符作为 `query` 值。

## 使用方式

### 命令行调用

```bash
cd $SKILL_DIR/scripts; if ($?) { node search-wiki.js --parameter-file-path <参数文件绝对路径> }
```

### 参数文件格式

```json
{
  "tenant_access_token": "u-xxxxxx",
  "query": "搜索关键词"
}
```

### 参数说明

| 参数名              | 类型   | 必填 | 说明                                                                 | 默认值 |
| ------------------- | ------ | ---- | -------------------------------------------------------------------- | ------ |
| tenant_access_token | string | yes  | 用户访问令牌（user_access_token），通过 tenant_access_token 字段传入 | -      |
| query               | string | yes  | 搜索关键词或文档标题。支持直接输入关键词，也可输入飞书云文档链接（AI 会自动提取标题） | -      |
| space_id            | string | no   | 文档所属的知识空间 ID，默认不填则搜索全部知识空间                   | 不填   |
| node_id             | string | no   | 搜索该节点及其所有子节点，默认不填。**使用 node_id 时必须传入 space_id** | 不填 |
| page_size           | int    | no   | 本页返回数量的最大值，取值范围 (0, 50]                               | `50`   |
| page_token          | string | no   | 下一页的分页 token，首页不需要填写                                   | -      |

### obj_type 类型对照表

| obj_type | 类型说明          |
|----------|-------------------|
| 1        | Doc               |
| 2        | Sheet             |
| 3        | Bitable           |
| 4        | Mindnote          |
| 5        | File              |
| 6        | Slide（已废弃）   |
| 7        | Wiki              |
| 8        | Docx              |
| 9        | Folder            |
| 10       | Catalog           |
| 11       | Slides            |

## 使用示例

### 示例 1：基本搜索（搜索全部知识空间）

```json
{
  "tenant_access_token": "u-xxxxxx",
  "query": "项目"
}
```

### 示例 2：在指定知识空间中搜索

```json
{
  "tenant_access_token": "u-xxxxxx",
  "query": "项目",
  "space_id": "7307457194084925443"
}
```

### 示例 3：在指定节点及其子节点中搜索

```json
{
  "tenant_access_token": "u-xxxxxx",
  "query": "项目",
  "space_id": "7307457194084925443",
  "node_id": "BAgPwq6lIi5Nykk0E5fcJeabcef"
}
```

### 示例 4：分页搜索（获取第二页）

```json
{
  "tenant_access_token": "u-xxxxxx",
  "query": "项目",
  "page_size": 10,
  "page_token": "上一页返回的 page_token 值"
}
```

### 示例 5：通过文档链接搜索

用户提供了飞书云文档链接，AI Agent 自动执行以下步骤：

**步骤 1**：解析链接获取 document_id（执行 `url-to-document-id.js`）

```json
{
  "tenant_access_token": "u-xxxxxx",
  "url": "https://kr0lqjlbmo.feishu.cn/docx/ZWs5dGFL2onOptxC9VncqltEntb"
}
```

解析结果：`document_id` = `ZWs5dGFL2onOptxC9VncqltEntb`，`obj_type` = `docx`

**步骤 2**：获取文档标题（执行 `get-file-meta.js`）

```json
{
  "tenant_access_token": "u-xxxxxx",
  "request_docs": [
    {
      "doc_token": "ZWs5dGFL2onOptxC9VncqltEntb",
      "doc_type": "docx"
    }
  ]
}
```

获取结果：`title` = `项目周报`

**步骤 3**：用标题作为 query 执行搜索（执行 `search-wiki.js`）

```json
{
  "tenant_access_token": "u-xxxxxx",
  "query": "项目周报"
}
```

## 返回结果

### 成功

```json
{
  "code": 0,
  "msg": "搜索 Wiki 成功",
  "data": {
    "items": [
      {
        "node_id": "BAgPwq6lIi5Nykk0E5fcJeabcef",
        "space_id": "7307457194084925443",
        "obj_type": 8,
        "obj_type_name": "docx",
        "obj_token": "AcnMdexrlokOShxe40Fc0Oabcef",
        "title": "欢迎使用知识库 / Welcome to Wiki",
        "url": "https://sample.feishu.cn/wiki/BAgPwq6lIi5Nykk0E5fcJeabcef",
        "icon": "",
        "sort_id": 1
      }
    ],
    "has_more": false,
    "page_token": ""
  }
}
```

| 字段                    | 说明                                                                   |
| ----------------------- | ---------------------------------------------------------------------- |
| items                   | 搜索结果 Wiki 节点列表                                                 |
| items[].node_id         | Wiki 节点的 token                                                      |
| items[].space_id        | Wiki 所属知识空间 ID                                                   |
| items[].obj_type        | Wiki 类型（数字编码，参考 obj_type 类型对照表）                        |
| items[].obj_type_name   | Wiki 类型名称（doc/sheet/bitable/docx/folder 等）                      |
| items[].obj_token       | 节点真实文档的 token，获取或编辑节点内容时使用此 token 调用对应接口    |
| items[].title           | Wiki 标题                                                              |
| items[].url             | Wiki 的访问 URL                                                        |
| items[].icon            | Wiki 对应图标的 URL                                                    |
| items[].sort_id         | 该知识库文档的序号，从 1 开始计数                                      |
| has_more                | 是否还有下一页数据                                                     |
| page_token              | 下一页的分页 token（has_more 为 true 时有效）                          |

### 失败

```json
{
  "code": -1,
  "msg": "错误信息描述",
  "data": null
}
```

## 注意事项

1. **认证方式**：此接口使用 `user_access_token`（用户身份）鉴权，**不支持** `tenant_access_token`（应用身份）。需将用户提供的 `user_access_token` 值填入参数文件的 `tenant_access_token` 字段
2. **query 取值**：`query` 本质是文档标题。用户可直接提供关键词，也可提供飞书云文档链接——此时 AI Agent 须先通过 `url-to-document-id.js` + `get-file-meta.js` 获取文档标题，再将标题作为 `query` 执行搜索
3. **权限要求**：需要「查看知识库」权限
4. **搜索范围**：仅返回当前用户有权限查看的 Wiki 节点
5. **分页机制**：通过 `page_token` + `page_size` 实现分页，首次请求不传 `page_token`，后续请求将上一页返回的 `page_token` 传入即可获取下一页
6. **搜索范围控制**：
   - 只传 `query`：搜索全部知识空间
   - 传 `query` + `space_id`：搜索指定知识空间
   - 传 `query` + `space_id` + `node_id`：搜索指定节点及其子节点
7. **获取/编辑内容**：使用返回的 `obj_token` 调用对应文档类型的接口操作节点内容

## 错误处理

| 错误码 | 错误信息                                | 解决方案                                                                         |
| ------ | --------------------------------------- | -------------------------------------------------------------------------------- |
| 10001  | invalid param                           | 参数错误，检查输入参数（如 query 超过 50 字符、node_id 未传 space_id 等）        |
| 10002  | network anomaly, please try again       | 后端服务异常或网络异常，可重新请求                                               |
| 99991663 | Invalid access token                  | user_access_token 无效或已过期，需重新获取新的 user_access_token                 |
| -1     | 参数文件中必须包含 tenant_access_token  | 检查参数文件是否包含 `tenant_access_token` 字段                                 |
| -1     | 参数文件中必须包含 query                | 检查参数文件是否包含 `query` 字段                                               |
| -1     | query 长度不超过 50 个字符              | 缩短搜索关键词                                                                   |
| -1     | page_size 取值范围为 (0, 50]            | 检查 page_size 参数是否在有效范围内                                              |
| -1     | 使用 node_id 过滤搜索时必须传入 space_id | 添加 space_id 参数或移除 node_id 参数                                           |
