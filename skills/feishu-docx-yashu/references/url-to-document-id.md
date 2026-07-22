# 飞书云文档链接解析为 document_id

> ⚠️ **强制规则**：执行脚本前必须先阅读本文档，严格按照参数名和格式编写参数文件，禁止凭记忆编写参数。

## 概述

输入飞书云文档的链接，输出该文档对应的 `document_id`。支持以下两种链接格式：

| 链接类型   | URL 格式                                        | 说明                                                                                     |
| ---------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 云盘文档   | `https://{domain}.feishu.cn/docx/{document_id}` | document_id 直接从 URL 路径中提取                                                        |
| 知识库文档 | `https://{domain}.feishu.cn/wiki/{wiki_token}`  | 需调用知识库接口获取节点信息，当 `obj_type` 为 `docx` 时，`obj_token` 即为 `document_id` |

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
    "url_type": "docx"
  }
}
```

| 字段        | 说明                       |
| ----------- | -------------------------- |
| document_id | 飞书文档 ID                |
| url_type    | 链接类型：`docx` 或 `wiki` |

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
