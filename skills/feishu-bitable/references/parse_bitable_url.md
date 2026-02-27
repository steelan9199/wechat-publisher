# 飞书多维表格 URL 解析工具使用指南

## 功能概述

从飞书多维表格 URL 中提取关键参数：`app_token`（多维表格 App 的唯一标识）、`table_id`（数据表的唯一标识）、`view_id`（视图 ID）。

## 前置条件

在开始之前，请确保你已经：

1. **获取了 tenant_access_token** → 参考 [get_tenant_access_token.md](get_tenant_access_token.md)
2. **准备好多维表格 URL** → 从飞书客户端/网页端, 复制的表格链接

## 输入参数

| 参数                    | 说明         | 示例          |
| ----------------------- | ------------ | ------------- |
| `--parameter-file-path` | 参数文件路径 | `params.json` |

### 参数文件字段

| 字段                  | 说明               | 示例                             |
| --------------------- | ------------------ | -------------------------------- |
| `tenant_access_token` | API 的访问凭证     | `t-g104223bNDxxxxxxxxx`          |
| `url`                 | 飞书多维表格的 URL | `https://xxx.feishu.cn/wiki/xxx` |

## 使用方法

### 步骤 1：准备参数文件

创建参数文件 `params.json`：

```json
{
  "tenant_access_token": "t-g104223bNDxxxxxxxxx",
  "url": "https://kr0lqjlbmo.feishu.cn/wiki/To1SwxxxxxxxxnWe?fromScene=spaceOverview&table=tblHOUxxx2MX&view=vewbWxxxHe"
}
```

### 步骤 2：执行命令

**运行以下命令**解析 URL：

```bash
node scripts/parse-bitable-url.js --parameter-file-path params.json
```

## 输出结果

**成功响应示例**：

```json
{
  "app_token": "To1SwxxxxxxxxnWe",
  "table_id": "tblHOUxxx2MX",
  "view_id": "vewbWxxxHe"
}
```

**响应字段说明**：

| 字段        | 说明                    | 用途                    |
| ----------- | ----------------------- | ----------------------- |
| `app_token` | 多维表格 App 的唯一标识 | 所有 API 调用的必需参数 |
| `table_id`  | 数据表的唯一标识        | 操作特定数据表时需要    |
| `view_id`   | 视图 ID                 | 操作特定视图时需要      |

## 参数示例

### 示例 1：Wiki 形式的表格 URL

```json
{
  "tenant_access_token": "t-g104223bNDxxxxxxxxx",
  "url": "https://kr0lqjlbmo.feishu.cn/wiki/To1SwxxxxxxxxnWe?fromScene=spaceOverview&table=tblHOUxxx2MX&view=vewbWxxxHe"
}
```

### 示例 2：Base 形式的表格 URL

```json
{
  "tenant_access_token": "t-g104223bNDDEyyyyyyyyy",
  "url": "https://kr0lqjlbmo.feishu.cn/base/DPDKbxxxxnZe?table=tblxxxxIMk03e&view=vewbxxxx6"
}
```

## 错误处理

### 常见错误及解决方案

| 错误场景     | 错误信息                                | 解决方案                                      |
| ------------ | --------------------------------------- | --------------------------------------------- |
| token 无效   | `tenant_access_token` is invalid        | 检查 token 是否过期，重新获取                 |
| URL 格式错误 | `url` is required                       | 确保 URL 参数已提供且格式正确                 |
| URL 缺少协议 | URL must start with http:// or https:// | 确保 URL 包含协议头                           |
| 解析失败     | Cannot parse table_id from URL          | URL 可能不是有效的飞书表格链接，检查 URL 来源 |

### 错误处理流程

**如果 URL 解析失败**：

1. **检查 token**：确认 `tenant_access_token` 未过期且有效
2. **验证 URL**：确保 URL 是从飞书客户端正确复制的表格链接
3. **检查参数文件**：确认参数文件格式正确，包含必需的字段
4. **查看日志**：运行脚本时查看输出的错误信息
