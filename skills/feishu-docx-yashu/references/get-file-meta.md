# 获取文件元数据

## 概述

根据文件 token **批量**获取飞书云空间文件的元数据，包括标题、所有者、创建时间、最近修改时间、密级标签、访问链接等。一次最多可查询 200 个文件。

**接口地址**：`POST https://open.feishu.cn/open-apis/drive/v1/metas/batch_query`

**频率限制**：1000 次/分钟，50 次/秒

**与「获取文件夹元数据」的区别**：

| 接口                      | 适用对象           | 支持批量 | 返回信息侧重                             |
| ------------------------- | ------------------ | -------- | ---------------------------------------- |
| get-folder-meta（文件夹） | 仅文件夹（folder） | 否       | 文件夹的 ID、名称、上级目录 ID 等        |
| get-file-meta（本接口）   | 任意类型文件       | 是       | 标题、所有者、密级、访问链接等通用元数据 |

## doc_type 取值

| doc_type       | 说明                   |
| -------------- | ---------------------- |
| `docx`         | 飞书新版文档（最常用） |
| `bitable`      | 飞书多维表格（最常用） |
| `doc`          | 飞书旧版文档           |
| `sheet`        | 飞书电子表格           |
| `mindnote`     | 飞书思维笔记           |
| `file`         | 飞书文件               |
| `wiki`         | 飞书知识库             |
| `folder`       | 飞书文件夹             |
| `synced_block` | 文档同步块（灰度中）   |
| `slides`       | 飞书幻灯片             |

## doc_type 推断规则（重要）

用户通常只会提供文档链接，不会主动告知 `doc_type`。AI Agent 需根据链接路径推断：

| 链接格式                                          | 推断的 doc_type | 说明                                                       |
| ------------------------------------------------- | --------------- | ---------------------------------------------------------- |
| `https://{domain}.feishu.cn/docx/{token}`         | `docx`          | 云盘中的云文档                                             |
| `https://{domain}.feishu.cn/base/{token}`         | `bitable`       | 云盘中的多维表格                                           |
| `https://{domain}.feishu.cn/sheets/{token}`       | `sheet`         | 云盘中的电子表格                                           |
| `https://{domain}.feishu.cn/wiki/{wiki_token}`    | 需先解析        | 知识库节点，需先调用 `url-to-document-id.js` 获取 obj_type |
| `https://{domain}.feishu.cn/docs/{token}`         | `doc`           | 旧版文档                                                   |
| `https://{domain}.feishu.cn/mindnotes/{token}`    | `mindnote`      | 思维笔记                                                   |
| `https://{domain}.feishu.cn/slides/{token}`       | `slides`        | 幻灯片                                                     |
| `https://{domain}.feishu.cn/drive/folder/{token}` | `folder`        | 文件夹                                                     |

**说明**：

- 飞书用户使用最多的是「飞书云文档（docx）」和「飞书多维表格（bitable）」，优先匹配这两种。
- 知识库链接（`/wiki/`）中的 `wiki_token` 并非文件本身的 token，需先调用 [url-to-document-id.js](url-to-document-id.md) 解析出 `document_id`（即真正的 file token）和 `obj_type`（即 doc_type），再调用本接口。
- 若链接中带 `?table=xxx&view=xxx` 等查询参数，忽略这些参数，仅依据路径段判断类型。

## 使用方式

### 命令行调用

```bash
cd "$SKILL_DIR/scripts" && node get-file-meta.js --parameter-file-path <参数文件绝对路径>
```

### 参数文件格式

```json
{
  "tenant_access_token": "t-xxx",
  "request_docs": [
    {
      "doc_token": "doccnfYZzTlvXqZIGTdAHKabcef",
      "doc_type": "docx"
    }
  ],
  "with_url": true,
  "user_id_type": "open_id"
}
```

### 参数说明

| 参数名              | 类型    | 必填 | 说明                                                                                           | 默认值    |
| ------------------- | ------- | ---- | ---------------------------------------------------------------------------------------------- | --------- |
| tenant_access_token | string  | yes  | 飞书应用租户访问令牌                                                                           | -         |
| request_docs        | array   | yes  | 文件 token 和类型列表，长度范围 1\~200。每项含 `doc_token`（string）和 `doc_type`（string）    | -         |
| with_url            | boolean | no   | 是否返回文件的访问链接                                                                         | `true`    |
| user_id_type        | string  | no   | 用户 ID 类型，可选值：`open_id`、`union_id`、`user_id`（`user_id` 需开启对应权限，仅自建应用） | `open_id` |

## 使用示例

### 示例 1：查询单个云文档的元数据

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "request_docs": [
    {
      "doc_token": "ZWs5dGFL2onOptxC9VncqltEntb",
      "doc_type": "docx"
    }
  ]
}
```

### 示例 2：批量查询多个文件的元数据

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "request_docs": [
    { "doc_token": "ZWs5dGFL2onOptxC9VncqltEntb", "doc_type": "docx" },
    { "doc_token": "QmnbbQRaXaSmcqs2DgPcfvxyn9I", "doc_type": "bitable" }
  ],
  "with_url": true
}
```

### 示例 3：查询多维表格的元数据

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "request_docs": [
    {
      "doc_token": "QmnbbQRaXaSmcqs2DgPcfvxyn9I",
      "doc_type": "bitable"
    }
  ]
}
```

### 示例 4：不返回访问链接

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "request_docs": [
    { "doc_token": "ZWs5dGFL2onOptxC9VncqltEntb", "doc_type": "docx" }
  ],
  "with_url": false
}
```

## 返回结果

### 成功

```json
{
  "code": 0,
  "msg": "获取文件元数据成功",
  "data": {
    "metas": [
      {
        "doc_token": "doccnfYZzTlvXqZIGTdAHKabcef",
        "doc_type": "docx",
        "title": "sampletitle",
        "owner_id": "ou_b13d41c02edc52ce66aaae67bf1abcef",
        "create_time": "1652066345",
        "latest_modify_user": "ou_b13d41c02edc52ce66aaae67bf1abcef",
        "latest_modify_time": "1652066345",
        "url": "https://sample.feishu.cn/docx/doccnfYZzTlvXqZIGTdAHKabcef",
        "sec_label_name": "L2-内部",
        "request_doc_info": {
          "doc_token": "doccnfYZzTlvXqZIGTdAHKabcef",
          "doc_type": "docx"
        }
      }
    ]
  }
}
```

| 字段                            | 类型   | 说明                                                     |
| ------------------------------- | ------ | -------------------------------------------------------- |
| code                            | int    | 错误码，`0` 表示成功                                     |
| msg                             | string | 错误描述                                                 |
| data.metas                      | array  | 文件元数据列表                                           |
| data.metas[].doc_token          | string | 文件 token                                               |
| data.metas[].doc_type           | string | 文件类型                                                 |
| data.metas[].title              | string | 文件标题                                                 |
| data.metas[].owner_id           | string | 所有者 ID（类型对应 `user_id_type`，需开启对应权限）     |
| data.metas[].create_time        | string | 创建时间（Unix 时间戳，秒）                              |
| data.metas[].latest_modify_user | string | 最近修改者 ID（类型对应 `user_id_type`，需开启对应权限） |
| data.metas[].latest_modify_time | string | 最近修改时间（Unix 时间戳，秒）                          |
| data.metas[].url                | string | 文件访问链接（需 `with_url=true`）                       |
| data.metas[].sec_label_name     | string | 文档密级标签名称（需开启对应权限，仅自建应用）           |
| data.metas[].request_doc_info   | object | 请求时传入的文件信息，包含 `doc_token` 和 `doc_type`     |

> **说明**：`owner_id`、`latest_modify_user`、`sec_label_name` 等敏感字段仅在应用开启对应权限后才会返回，否则响应中可能缺失这些字段。

### 失败

```json
{
  "code": -1,
  "msg": "错误信息描述",
  "data": null
}
```

## 注意事项

1. **批量限制**：`request_docs` 数组长度范围为 1\~200 个，超过 200 个会被脚本拦截
2. **doc_type 必填**：每个 `request_docs` 元素必须同时提供 `doc_token` 和 `doc_type`，脚本会校验 `doc_type` 是否为支持的取值
3. **知识库链接需先解析**：`/wiki/` 链接中的 `wiki_token` 不是文件本身的 token，必须先调用 [url-to-document-id.js](url-to-document-id.md) 解析得到 `document_id`（= doc_token）和 `obj_type`（= doc_type），再调用本接口
4. **权限要求**（至少开启一个）：
   - 查看、评论、编辑和管理云空间中所有文件
   - 查看云空间中文件元数据
5. **字段权限**（仅自建应用，如需返回则必须开启）：
   - 获取用户 user ID（`user_id_type` 为 `user_id` 时必需）
   - 获取文档密级标签名称（`sec_label_name` 字段必需）
6. **凭证身份**：
   - 使用 `tenant_access_token` 时以应用身份调用，数据范围由应用权限决定
   - 使用 `user_access_token` 时以用户身份调用，数据范围由该用户权限决定（本技能默认使用 `tenant_access_token`）
7. **时间戳**：`create_time` 和 `latest_modify_time` 为 Unix 秒级时间戳字符串

## 错误处理

| 错误码   | 错误信息                               | 解决方案                                                                                                            |
| -------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 99991663 | Invalid access token                   | 运行 `cd "$SKILL_DIR/scripts" && node get-tenant-access-token.js --parameter-file-path <参数文件绝对路径>` 刷新令牌 |
| 1069701  | User identity verification failed      | 检查 appid 是否正确                                                                                                 |
| 1069704  | Internal server error                  | 服务端错误，稍后重试；若仍报错可联系技术支持                                                                        |
| 1061004  | forbidden                              | 在浏览器中打开文件链接，将飞书企业自建应用添加为协作者并赋予「可管理」权限                                          |
| -1       | 参数文件中必须包含 tenant_access_token | 检查参数文件是否包含 `tenant_access_token` 字段                                                                     |
| -1       | 参数文件中必须包含 request_docs        | 检查参数文件是否包含 `request_docs` 数组                                                                            |
| -1       | request_docs 数组长度不能超过 200      | 拆分为多次调用                                                                                                      |
| -1       | request_docs[i] 缺少 doc_token 字段    | 检查每个元素是否包含 `doc_token`                                                                                    |
| -1       | request_docs[i] 缺少 doc_type 字段     | 检查每个元素是否包含 `doc_type`，必要时由 AI Agent 根据链接推断                                                     |
| -1       | 必须提供 --parameter-file-path 参数    | 通过 `--parameter-file-path` 传递参数文件绝对路径                                                                   |
