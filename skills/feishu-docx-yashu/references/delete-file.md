# 删除文件或文件夹

## 概述

删除用户在云空间内的文件或者文件夹。文件或文件夹被删除后，会进入回收站中。删除文件夹时该接口异步执行，脚本会自动轮询异步任务状态直到完成。

## 使用限制

该接口不支持并发调用，且调用频率上限为 5 QPS，10000 次/天。否则会返回 1061045 错误码，可通过稍后重试解决。

## 使用方式

### 命令行调用

```bash
cd $SKILL_DIR/scripts; if ($?) { node delete-file.js --parameter-file-path <参数文件绝对路径> }
```

### 参数文件格式

```json
{
  "tenant_access_token": "t-xxx",
  "file_token": "YkaSfwFPHl2EoVdMWI3co714n0b",
  "type": "folder"
}
```

### 参数说明

| 参数名              | 类型   | 必填 | 说明             | 默认值 |
| ------------------- | ------ | ---- | ---------------- | ------ |
| tenant_access_token | string | yes  | 飞书应用租户访问令牌 | -      |
| file_token          | string | yes  | 要删除的文件或文件夹的 token | -      |
| type                | string | yes  | 文件类型（见下方类型列表） | -      |

#### type 参数可选值

| 类型       | 说明           |
| ---------- | -------------- |
| `file`     | 普通文件类型   |
| `docx`     | 新版文档类型   |
| `bitable`  | 多维表格类型   |
| `doc`      | 文档类型       |
| `sheet`    | 电子表格类型   |
| `mindnote` | 思维笔记类型   |
| `folder`   | 文件夹类型     |
| `slides`   | 幻灯片类型     |
| `shortcut` | 快捷方式类型   |

## 使用示例

### 示例 1：删除文件夹

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "file_token": "YkaSfwFPHl2EoVdMWI3co714n0b",
  "type": "folder"
}
```

### 示例 2：删除新版文档

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "file_token": "BJLkdtBiKooLjUxiCN3caeHanog",
  "type": "docx"
}
```

## 返回结果

### 成功

```json
{
  "code": 0,
  "msg": "删除成功（异步任务已完成）",
  "data": {
    "file_token": "YkaSfwFPHl2EoVdMWI3co714n0b",
    "type": "folder",
    "task_id": "7669392798440754416",
    "task_status": "success"
  }
}
```

| 字段          | 说明                                                                  |
| ------------- | --------------------------------------------------------------------- |
| file_token    | 被删除的文件或文件夹的 token                                          |
| type          | 文件类型                                                              |
| task_id       | 异步任务 ID。删除文件夹时返回，删除文件时为 `"0"`                      |
| task_status   | 任务状态：`success`（已完成）。脚本自动轮询直至完成                   |

### 失败

```json
{
  "code": -1,
  "msg": "错误信息描述",
  "data": null
}
```

## 注意事项

1. **回收站**：文件或文件夹被删除后会进入回收站，可在飞书云空间回收站中恢复
2. **异步执行**：删除文件夹时为异步操作，脚本内部自动每隔 5 秒轮询任务状态直到完成
3. **权限要求**：应用或用户需为文件所有者并具有父文件夹的编辑权限，或为父文件夹的所有者/拥有全部权限
4. **type 参数**：必须与实际文件类型匹配，否则会返回 `1061003`（not found）错误
5. **根目录文件夹无法删除**：当文件夹位于根目录下（即 `parent_id` 为 `"0"`，属于「我的空间」根目录下的第一层级文件夹）时，飞书企业自建应用**无法获取根目录的编辑权限**，因此删除操作必然失败并返回 `1062501`（operate node no permission）。此限制为飞书平台设计，无法通过添加协作者权限解决。如需删除根目录下的文件夹，请用户在飞书客户端中手动操作

## 错误处理

| 错误码   | 错误信息                          | 解决方案                                                                                                                    |
| -------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 99991663 | Invalid access token              | 运行 `cd $SKILL_DIR/scripts; if ($?) { node get-tenant-access-token.js --parameter-file-path <参数文件绝对路径> }` 刷新令牌 |
| 1061003  | not found                         | 检查 `type` 参数是否与实际文件类型匹配，检查 `file_token` 是否正确                                                          |
| 1061004  | forbidden                         | 确认应用或用户是否具有删除权限（文件所有者+父文件夹编辑权限，或父文件夹所有者）                                            |
| 1062501  | operate node no permission        | 文件夹位于根目录下（`parent_id` 为 `"0"`），飞书企业自建应用无法获取根目录编辑权限，删除必然失败。请用户在飞书客户端手动删除 |
| -1       | type 参数无效                     | 检查 `type` 参数是否为支持的类型：file, docx, bitable, doc, sheet, mindnote, folder, slides, shortcut                       |
| -1       | 参数文件中必须包含 file_token     | 检查参数文件是否包含 `file_token` 字段                                                                                      |
| -1       | 参数文件中必须包含 type           | 检查参数文件是否包含 `type` 字段                                                                                            |
