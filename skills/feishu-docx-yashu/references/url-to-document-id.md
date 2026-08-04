# 飞书云文档链接解析为 document_id

## 概述

输入飞书云文档的链接，输出该文档对应的 `document_id`。支持以下两种链接格式：

| 链接类型   | URL 格式                                        | 说明                                                                                     |
| ---------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 云盘文档   | `https://{domain}.feishu.cn/docx/{document_id}` | document_id 直接从 URL 路径中提取                                                        |
| 知识库文档 | `https://{domain}.feishu.cn/wiki/{wiki_token}`  | 需调用知识库接口获取节点信息，当 `obj_type` 为 `docx` 时，`obj_token` 即为 `document_id` |

### document_id 与文件 token 的关系

飞书云空间中的每个文件都有一个唯一的 **token** 作为标识。根据文件类型不同，该 token 在飞书官方 API 中的命名可能不同，常见的包括 `token`、`document_id`、`file_token`、`app_token`、`spreadsheetToken` 等，但本质上都是同一个概念——**文件 token**。

本技能解析出的 `document_id` **就是飞书云文档的文件 token**（即 `file_token`）。在调用飞书其他 API（如下载文档、获取文档内容等）需要传入 `file_token` 或 `document_id` 参数时，可直接使用本技能解析得到的结果。

## 使用方式

### 命令行调用

```bash
cd $SKILL_DIR/scripts; if ($?) { node url-to-document-id.js --parameter-file-path <参数文件绝对路径> }
```

### 参数文件格式

```json
{
  "tenant_access_token": "t-xxx",
  "url": "https://kr0lqjlbmo.feishu.cn/docx/LBMLdKhq5xxxxxxxxxxxxx"
}
```

### 参数说明

| 参数名              | 类型   | 必填 | 说明                        | 默认值 |
| ------------------- | ------ | ---- | --------------------------- | ------ |
| tenant_access_token | string | yes  | 飞书应用租户访问令牌        | -      |
| url                 | string | yes  | 飞书云文档链接（docx/wiki） | -      |

## 使用示例

### 示例 1：解析云盘文档链接

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "url": "https://kr0lqjlbmo.feishu.cn/docx/LBMLdKhq5xxxxxxxxxxxxx"
}
```

### 示例 2：解析知识库文档链接

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "url": "https://kr0lqjlbmo.feishu.cn/wiki/HOWDwbHxxxxxxxxxxxxxxx"
}
```

## 返回结果

### 成功

```json
{
  "code": 0,
  "msg": "解析成功",
  "data": {
    "document_id": "LBMLdKhq5xxxxxxxxxxxxx",
    "obj_type": "docx"
  }
}
```

| 字段        | 说明                                                |
| ----------- | --------------------------------------------------- |
| document_id | 飞书文档 ID，即文件的 token（file_token）           |

### 失败

```json
{
  "code": -1,
  "msg": "错误信息描述",
  "data": null
}
```

## 注意事项

1. **权限要求**：解析知识库链接需要应用具有知识库节点的读取权限
2. **链接类型**：仅支持 `docx`（云文档）和 `wiki`（知识库）两种链接格式
3. **知识库节点类型**：当知识库节点的 `obj_type` 不为 `docx` 时，将返回错误

## 错误处理

| 错误码   | 错误信息             | 解决方案                                                                                                                    |
| -------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 99991663 | Invalid access token | 运行 `cd $SKILL_DIR/scripts; if ($?) { node get-tenant-access-token.js --parameter-file-path <参数文件绝对路径> }` 刷新令牌 |
