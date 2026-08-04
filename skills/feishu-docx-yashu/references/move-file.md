# 移动文件或文件夹

## 概述

将文件或者文件夹移动到用户云空间的其他位置。移动文件夹时为异步操作，脚本会自动轮询异步任务状态直到完成。

## 使用方式

### 命令行调用

```bash
cd $SKILL_DIR/scripts; if ($?) { node move-file.js --parameter-file-path <参数文件绝对路径> }
```

### 参数文件格式

```json
{
  "tenant_access_token": "t-xxx",
  "file_token": "YkaSfwFPHl2EoVdMWI3co714n0b",
  "folder_token": "Ip7vfeMnUlzLyIdj7KJcWxt1nde",
  "type": "folder"
}
```

### 参数说明

| 参数名              | 类型   | 必填 | 说明                         | 默认值 |
| ------------------- | ------ | ---- | ---------------------------- | ------ |
| tenant_access_token | string | yes  | 飞书应用租户访问令牌         | -      |
| file_token          | string | yes  | 要移动的文件或文件夹的 token | -      |
| folder_token        | string | yes  | 目标文件夹的 token           | -      |
| type                | string | yes  | 文件类型（见下方类型列表）   | -      |

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

> ⚠️ **不支持 `shortcut` 类型**：快捷方式无法通过本接口移动。

## 使用示例

### 示例 1：移动文件夹到另一个文件夹

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "file_token": "YkaSfwFPHl2EoVdMWI3co714n0b",
  "folder_token": "Ip7vfeMnUlzLyIdj7KJcWxt1nde",
  "type": "folder"
}
```

### 示例 2：移动新版文档到文件夹

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "file_token": "BJLkdtBiKooLjUxiCN3caeHanog",
  "folder_token": "Ip7vfeMnUlzLyIdj7KJcWxt1nde",
  "type": "docx"
}
```

## 返回结果

### 成功

```json
{
  "code": 0,
  "msg": "移动成功（异步任务已完成）",
  "data": {
    "file_token": "YkaSfwFPHl2EoVdMWI3co714n0b",
    "type": "folder",
    "destination_folder_token": "Ip7vfeMnUlzLyIdj7KJcWxt1nde",
    "task_id": "0",
    "task_status": "success"
  }
}
```

| 字段                     | 说明                                                                  |
| ------------------------ | --------------------------------------------------------------------- |
| file_token               | 被移动的文件或文件夹的 token                                          |
| type                     | 文件类型                                                              |
| destination_folder_token | 目标文件夹的 token                                                    |
| task_id                  | 异步任务 ID。`"0"` 表示同步完成，非零表示异步操作                      |
| task_status              | 任务状态：`success`（已完成）。异步操作时脚本自动轮询直至完成          |

### 失败

```json
{
  "code": -1,
  "msg": "错误信息描述",
  "data": null
}
```

## 注意事项

1. **异步执行**：移动文件夹时为异步操作，脚本内部自动每隔 5 秒轮询任务状态直到完成
2. **同步执行**：移动文件（非文件夹）时通常同步完成，`task_id` 为 `"0"`
3. **type 参数**：必须与实际文件类型匹配，否则会返回 `1061003`（not found）错误
4. **目标文件夹权限**：目标文件夹需已添加飞书企业自建应用为协作者并赋予「可管理」权限，否则返回 `1062535`（destination parent no permission）

### 目标文件夹权限配置

若返回 `1062535`（destination parent no permission），需对目标文件夹执行以下操作：

1. 获取目标文件夹的链接，在浏览器中打开
2. 点击右侧的分享按钮，出现「分享文件夹」弹窗
3. 点击「邀请协作者」右侧的加号按钮，弹出选择联系人界面
4. 在输入框中输入飞书企业自建应用的名字
5. 勾选你创建的飞书企业自建应用，点击确认按钮
6. 把权限从「可阅读」改为「可管理」，再点击发送按钮

## 错误处理

| 错误码   | 错误信息                           | 解决方案                                                                                                                    |
| -------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 99991663 | Invalid access token               | 运行 `cd $SKILL_DIR/scripts; if ($?) { node get-tenant-access-token.js --parameter-file-path <参数文件绝对路径> }` 刷新令牌 |
| 1061003  | not found                          | 检查 `type` 参数是否与实际文件类型匹配，检查 `file_token` 是否正确                                                          |
| 1061004  | forbidden                          | 确认应用是否具有源文件夹的操作权限                                                                                          |
| 1062535  | destination parent no permission   | 在目标文件夹中添加飞书企业自建应用为协作者并赋予「可管理」权限（见上方「目标文件夹权限配置」）                              |
| -1       | type 参数无效                      | 检查 `type` 参数是否为支持的类型：file, docx, bitable, doc, sheet, mindnote, folder, slides                                 |
| -1       | 参数文件中必须包含 folder_token    | 检查参数文件是否包含 `folder_token` 字段（目标文件夹 token）                                                                |
