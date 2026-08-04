# 获取文件夹元数据

## 概述

根据文件夹 token 获取该文件夹的元数据，包括文件夹的 ID、名称、创建者 ID、最后编辑者 ID、所有者 ID、上级目录 ID 等。

## 使用方式

### 命令行调用

```bash
cd $SKILL_DIR/scripts; if ($?) { node get-folder-meta.js --parameter-file-path <参数文件绝对路径> }
```

### 参数文件格式

```json
{
  "tenant_access_token": "t-xxx",
  "folder_token": "XmlTfpUwQlH7ZTdih8gcN753nyc"
}
```

### 参数说明

| 参数名              | 类型   | 必填 | 说明             | 默认值 |
| ------------------- | ------ | ---- | ---------------- | ------ |
| tenant_access_token | string | yes  | 飞书应用租户访问令牌 | -      |
| folder_token        | string | yes  | 文件夹的 token   | -      |

## 使用示例

### 示例 1：获取文件夹元数据

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "folder_token": "XmlTfpUwQlH7ZTdih8gcN753nyc"
}
```

## 返回结果

### 成功

```json
{
  "code": 0,
  "msg": "获取文件夹元数据成功",
  "data": {
    "token": "XmlTfpUwQlH7ZTdih8gcN753nyc",
    "id": "7613107135961926837",
    "name": "Content transferred from Coze测试专用",
    "create_uid": "7021458682727022595",
    "edit_uid": "7021458682727022595",
    "own_uid": "7613107135961943221",
    "parent_id": "0"
  }
}
```

| 字段        | 说明                                                                                |
| ----------- | ----------------------------------------------------------------------------------- |
| token       | 文件夹的 token                                                                      |
| id          | 文件夹的 ID                                                                         |
| name        | 文件夹的标题                                                                        |
| create_uid  | 文件夹的创建者 ID                                                                   |
| edit_uid    | 文件夹的最后编辑者 ID                                                               |
| own_uid     | 文件夹为个人文件夹时，为所有者 ID；文件夹为共享文件夹时，为文件夹树 ID              |
| parent_id   | 文件夹的上级目录 ID。`"0"` 表示当前文件夹无上级目录（即根目录下的文件夹）           |

### 失败

```json
{
  "code": -1,
  "msg": "错误信息描述",
  "data": null
}
```

## 注意事项

1. **权限要求**：需要应用具有该文件夹的读取权限
2. **权限配置**：若返回 `1061004`（forbidden），需在浏览器中打开文件夹链接，将飞书企业自建应用添加为协作者并赋予「可管理」权限
3. **parent_id 含义**：`"0"` 表示该文件夹位于根目录下，无上级目录

## 错误处理

| 错误码   | 错误信息             | 解决方案                                                                                                                    |
| -------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 99991663 | Invalid access token | 运行 `cd $SKILL_DIR/scripts; if ($?) { node get-tenant-access-token.js --parameter-file-path <参数文件绝对路径> }` 刷新令牌 |
| 1061004  | forbidden            | 在浏览器中打开文件夹链接，点击分享按钮，将飞书企业自建应用添加为协作者并赋予「可管理」权限                                  |
| -1       | 参数文件中必须包含 folder_token | 检查参数文件是否包含 `folder_token` 字段                                                                           |
