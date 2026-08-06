# 飞书多维表格获取访问凭证 (tenant_access_token) API 使用指南

## 功能概述

`tenant_access_token` 是调用飞书多维表格 API 的必需凭证，有效期为 2 小时。本指南说明如何获取该凭证。

## 前置条件

在开始之前，请确保你已经：

1. **创建企业自建应用**：在[飞书开放平台](https://open.feishu.cn/app)创建应用
2. **获取应用凭证**：记录应用的 `App ID` 和 `App Secret`
3. **启用权限**：确保应用已开通 `bitable:app` 权限

## 输入参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `--parameter-file-path` | 参数文件路径 | `params.json` |

### 参数文件字段

| 字段 | 说明 | 示例 |
|------|------|------|
| `appId` | 飞书开放平台的企业自建应用的 App ID | `cli_xxx` |
| `appSecret` | 飞书开放平台企业自建应用的 App Secret | `xxx...` |

## 获取凭证的方法

**运行以下命令**获取 `tenant_access_token`：

```bash
cd $SKILL_DIR/scripts && node get-tenant-access-token.js --parameter-file-path params.json
```

**参数文件示例**（`params.json`）：

```json
{
  "appId": "cli_xxx",
  "appSecret": "xxx"
}
```

## 输出结果

**成功响应示例**：

```json
{
  "code": 0,
  "msg": "ok",
  "tenant_access_token": "t-g104223bNDxxxxxxxxx",
  "expire": 7200
}
```

**响应字段说明**：

| 字段                  | 说明                                    |
| --------------------- | --------------------------------------- |
| `tenant_access_token` | 访问凭证，需在后续 API 调用中使用       |
| `expire`              | 凭证有效期（秒），默认 7200 秒（2小时） |

## 错误处理

### 常见错误及解决方案

| 错误码     | 错误信息                        | 解决方案                                           |
| ---------- | ------------------------------- | -------------------------------------------------- |
| `99991663` | app_id or app_secret is invalid | 检查 App ID 和 App Secret 是否正确，注意区分大小写 |
| `99991661` | app is not visible to user      | 确认应用已发布并可见，检查应用状态是否为「已启用」 |
| `99991664` | app has no permission           | 在飞书开放平台为应用开通 `bitable:app` 权限        |
| `-1`       | network error                   | 检查网络连接，或稍后重试                           |

### 错误处理流程

**如果获取凭证失败**：

1. **检查日志**：查看脚本输出的错误信息和错误码
2. **验证凭证**：确认 App ID 和 App Secret 与飞书开放平台一致
3. **检查权限**：在飞书开放平台 → 应用详情 → 权限管理，确认已开通必要权限
4. **重试操作**：修正问题后重新运行获取凭证命令

**如果凭证过期**：

- 凭证有效期为 2 小时，过期后需要重新获取
- 建议在自动化流程中实现凭证自动刷新机制

## 下一步操作

获取到 `tenant_access_token` 后，你可以：

1. **解析多维表格 URL** → 参考 [parse_bitable_url.md]($SKILL_DIR/references/parse_bitable_url.md) 提取 `app_token` 和 `table_id`
2. **执行数据操作** → 使用 `tenant_access_token` 调用数据表、记录、字段相关 API

## 相关文档

- [认证与凭证管理指南]($SKILL_DIR/references/authentication.md) - 完整的凭证管理流程说明
- [解析飞书 URL 工具]($SKILL_DIR/references/parse_bitable_url.md) - 从 URL 提取表格信息的工具
- [常见错误及解决方案]($SKILL_DIR/references/errors.md) - API 调用错误排查指南
