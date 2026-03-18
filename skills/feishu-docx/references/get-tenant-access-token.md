# get-tenant-access-token 文档

## 概述

此脚本用于获取飞书应用的租户访问令牌（tenant_access_token）。
tenant_access_token 是应用访问飞书开放平台 API 的凭证，用于代表应用本身进行 API 调用。

## 前置条件

在开始之前，请确保你已经：

1. **创建企业自建应用**：在[飞书开放平台](https://open.feishu.cn/app)创建应用
2. **配置应用凭证**：将应用的 `App ID` 和 `App Secret` 填写到 `config.default.json` 文件中
3. **启用权限**：确保应用已开通 `创建及编辑新版文档` 权限

## 凭证读取优先级

1. **第一优先级**：自动从技能目录下的 `config.default.json` 文件读取已配置的 `appId` 和 `appSecret`
2. **第二优先级**：如果配置文件无有效凭证，再向用户获取 `appId` 和 `appSecret`

⚠️ **AI自动操作规范**：执行前必须先运行 `Read` 工具读取 `config.default.json` 文件，优先使用其中已配置的凭证，禁止直接向用户索要已存在的凭证！

## 主要函数

### getTenantAccessToken(params)

获取飞书租户访问令牌。

**参数:**

- `appId` (string, 必填): 飞书开放平台的企业自建应用的 App ID
- `appSecret` (string, 必填): 飞书开放平台企业自建应用的 App Secret
- `secretKeyConfigFilePath` (string, 必填): 用于保存appId和appSecret, 以及tenant_access_token的配置文件的绝对路径(绝对路径分隔符使用正斜杆"/")，就是技能`feishu-docx`文件夹里面的 `config.default.json` 文件的绝对路径

**返回值:**

飞书 API 响应结果，包含租户访问令牌。

## 命令行使用方式

**⚠️ 路径规范**：`--parameter-file-path` 必须使用绝对路径和正斜杠 `/`

- ✅ **正确示例**：`--parameter-file-path D:/script/work-sop/temp/temp-params.json`
- ❌ **错误示例**：`--parameter-file-path temp-params.json`（相对路径）
- ❌ **错误示例**：`--parameter-file-path D:\script\temp-params.json`（反斜杠）

```bash
node get-tenant-access-token.js --parameter-file-path <json文件绝对路径>
```

参数文件 JSON 格式示例:

```json
{
  "appId": "cli_a1xxxxxxxx",
  "appSecret": "abcdefgxxxxxxxxxxxxxx",
  "secretKeyConfigFilePath": "/path/to/config.default.json"
}
```

⚠️ **自动生成参数文件规范**：

1. 必须先运行 `Read` 工具读取 `config.default.json` 文件
2. 参数文件必须包含 **3个必填字段**：`appId`、`appSecret`、`secretKeyConfigFilePath`，缺一不可
3. 直接从读取结果中复制 `appId` 和 `appSecret` 到参数文件
4. `secretKeyConfigFilePath` 必须填写 `config.default.json` 文件的绝对路径（使用正斜杠分隔符）
5. 禁止手动拼写或要求用户提供已存在于配置文件中的凭证

## 输出格式

成功时输出飞书 API 的 JSON 响应结果：

```json
{
  "code": 0,
  "msg": "success",
  "tenant_access_token": "t-g104abcdexxxxxxxxxxx",
  "expire": 7200
}
```

失败时输出错误信息：

```json
{
  "code": 10013,
  "msg": "invalid app_id",
  "error": {
    "log_id": "20260228193340D70586B76252C5EA7035",
    "helps": [
      {
        "description": "app_id 无效，请检查 app_id 是否正确"
      }
    ]
  }
}
```

## 说明

- `tenant_access_token`: 租户访问令牌，用于调用飞书开放平台的其他 API
- `expire`: 令牌有效期，单位为秒，默认有效期为 7200 秒（2 小时）
- 建议在令牌过期前提前刷新，避免因令牌失效导致 API 调用失败

## 常见错误及解决方案

| 错误现象                                                                              | 错误原因                                                                        | 解决方案                                                                                                       |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 执行令牌刷新脚本时返回 `必须提供 --parameter-file-path 参数`                          | 未按照脚本规范通过参数文件传递参数，直接执行脚本缺少必要配置                    | 必须通过 `--parameter-file-path` 参数传递包含完整配置的JSON参数文件，禁止直接运行脚本                          |
| 执行令牌刷新脚本时返回 `参数文件中必须包含 secretKeyConfigFilePath`                   | 参数文件缺少 `secretKeyConfigFilePath` 必填字段，脚本无法将新令牌回写到配置文件 | 在参数文件中添加 `secretKeyConfigFilePath` 字段，值为 `config.default.json` 文件的绝对路径（使用正斜杠分隔符） |
| 调用其他飞书API时返回错误码 `99991663`，提示 `Invalid access token for authorization` | 配置文件中存储的`tenant_access_token`已过期（飞书令牌默认有效期为2小时）        | 立即调用本脚本刷新令牌，获取新的`tenant_access_token`后重试API调用                                             |
