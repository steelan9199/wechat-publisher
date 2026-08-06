# 查询异步任务状态

## 概述

查询飞书云空间中异步任务的状态信息。目前支持查询**删除文件夹**和**移动文件夹**的异步任务状态。删除或移动文件夹时，接口会返回异步任务 ID（task_id），可通过本脚本查询该任务的执行状态。

## 使用方式

### 命令行调用

```bash
cd "$SKILL_DIR/scripts" && node task-check.js --parameter-file-path <参数文件绝对路径>
```

### 参数文件格式

```json
{
  "tenant_access_token": "t-xxx",
  "task_id": "7669392798440754416"
}
```

### 参数说明

| 参数名              | 类型   | 必填 | 说明                                              | 默认值 |
| ------------------- | ------ | ---- | ------------------------------------------------- | ------ |
| tenant_access_token | string | yes  | 飞书应用租户访问令牌                              | -      |
| task_id             | string | yes  | 异步任务 ID，可通过删除文件夹或移动文件夹接口获取 | -      |

## 使用示例

### 示例 1：查询删除文件夹任务状态

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "task_id": "7669392798440754416"
}
```

### 示例 2：查询移动文件夹任务状态

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "task_id": "0"
}
```

## 返回结果

### 成功

```json
{
  "code": 0,
  "msg": "查询异步任务状态成功",
  "data": {
    "task_id": "7669392798440754416",
    "status": "success"
  }
}
```

| 字段    | 说明                                                                    |
| ------- | ----------------------------------------------------------------------- |
| task_id | 异步任务 ID                                                             |
| status  | 任务状态：`success`（已完成）、`failed`（失败）、`processing`（进行中） |

### 失败

```json
{
  "code": -1,
  "msg": "错误信息描述",
  "data": null
}
```

## 注意事项

1. **适用范围**：仅支持查询删除文件夹和移动文件夹的异步任务
2. **任务 ID 来源**：task_id 可通过调用 `delete-file.js`（删除文件夹）或 `move-file.js`（移动文件夹）获取
3. **自动轮询**：`delete-file.js` 和 `move-file.js` 脚本内部已自动轮询任务状态，通常无需手动调用本脚本

## 错误处理

| 错误码   | 错误信息                   | 解决方案                                                                                                            |
| -------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 99991663 | Invalid access token       | 运行 `cd "$SKILL_DIR/scripts" && node get-tenant-access-token.js --parameter-file-path <参数文件绝对路径>` 刷新令牌 |
| -1       | 参数文件中必须包含 task_id | 检查参数文件是否包含 `task_id` 字段                                                                                 |
