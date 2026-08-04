# 获取我的空间（根文件夹）元数据

## 概述

获取用户"我的空间"（根文件夹）的元数据，包括根文件夹的 **token**、**ID** 和 **文件夹所有者的 ID**。

根文件夹是飞书云空间中最顶层的文件夹，所有个人云文档都存放在根文件夹或其子文件夹下。获取根文件夹的 token 后，可用于调用其他文件夹相关 API（如获取文件清单、新建文件夹等）。

## 使用方式

### 命令行调用

```bash
cd $SKILL_DIR/scripts; if ($?) { node get-root-folder-meta.js --parameter-file-path <参数文件绝对路径> }
```

### 参数文件格式

```json
{
  "tenant_access_token": "t-xxx"
}
```

### 参数说明

| 参数名              | 类型   | 必填 | 说明                 | 默认值 |
| ------------------- | ------ | ---- | -------------------- | ------ |
| tenant_access_token | string | yes  | 飞书应用租户访问令牌 | -      |

## 使用示例

### 示例 1：获取我的空间根文件夹元数据

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD"
}
```

## 返回结果

### 成功

```json
{
  "code": 0,
  "msg": "获取我的空间（根文件夹）元数据成功",
  "data": {
    "token": "nodbcbHUdOsS613xVzTzFEabcef",
    "id": "7110173013420512356",
    "user_id": "7103496998321312356"
  }
}
```

| 字段    | 说明                          |
| ------- | ----------------------------- |
| token   | 根文件夹的 token              |
| id      | 根文件夹的 ID                 |
| user_id | 根文件夹所有者的 ID           |

### 失败

```json
{
  "code": -1,
  "msg": "错误信息描述",
  "data": null
}
```

## 注意事项

1. **权限要求**：需要应用具有 `drive:drive`（查看、评论、编辑和管理云空间中所有文件）或 `drive:drive:readonly`（查看云空间中文件元数据）权限，开启任一权限即可
2. **根文件夹 token 的用途**：获取到的 `token` 即为根文件夹的 token，可作为 `folder_token` 传给 `get-files`（获取文件清单）、`create-folder`（新建文件夹）等接口，操作根目录下的文件
3. **token 与 ID 的区别**：`token` 用于 API 调用中标识文件夹（如 `folder_token` 参数），`id` 是文件夹的内部数字标识

## 错误处理

| 错误码   | 错误信息             | 解决方案                                                                                                                    |
| -------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 99991663 | Invalid access token | 运行 `cd $SKILL_DIR/scripts; if ($?) { node get-tenant-access-token.js --parameter-file-path <参数文件绝对路径> }` 刷新令牌 |
| 91201    | FAILED               | 处理失败，请稍后重试或联系飞书技术支持                                                                                      |
| 91204    | FORBIDDEN            | 当前应用或用户没有权限，请为应用开启 `drive:drive` 或 `drive:drive:readonly` 权限                                          |
| -1       | 参数文件中必须包含 tenant_access_token | 检查参数文件是否包含 `tenant_access_token` 字段                                                                    |
