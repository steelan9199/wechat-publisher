# 移动知识空间云文档至云空间

## 概述

将知识空间（Wiki）中的节点移动至指定云空间文件夹。`folder_token` 不传或传空字符串时，节点将移动至调用身份的个人云空间根目录。

> **与「移动文件」的区别**：
>
> | 接口                        | 适用场景                           | 说明                                 |
> | --------------------------- | ---------------------------------- | ------------------------------------ |
> | move-file（云盘移动）       | 云盘内文件/文件夹之间的移动        | 仅限云盘体系内部，无法移动 Wiki 节点 |
> | move-wiki-to-docs（本接口） | 将 Wiki 知识库节点移出到云盘文件夹 | 跨体系移动：知识库 → 云盘            |

## 使用方式

### 命令行调用

```bash
cd "$SKILL_DIR/scripts" && node move-wiki-to-docs.js --parameter-file-path <参数文件绝对路径>
```

### 参数文件格式

```json
{
  "tenant_access_token": "t-xxx",
  "node_token": "wikcnKQ1k3p******8Vabce",
  "folder_token": "Ip7vfeMnUlzLyIdj7KJcWxt1nde"
}
```

### 参数说明

| 参数名              | 类型   | 必填 | 说明                                                                                                                         | 默认值   |
| ------------------- | ------ | ---- | ---------------------------------------------------------------------------------------------------------------------------- | -------- |
| tenant_access_token | string | yes  | 飞书应用租户访问令牌（或用户访问令牌）                                                                                       | -        |
| node_token          | string | yes  | 知识库节点 token（Wiki 链接中的 token，即 `https://xxx.feishu.cn/wiki/{node_token}` 中的部分）, 注意：链接中必须包含 `wiki/` | -        |
| folder_token        | string | no   | 目标云空间文件夹 token。不传或传空字符串时，移动至个人云空间根目录                                                           | 空字符串 |

## 使用示例

### 示例 1：移动 Wiki 节点到指定文件夹

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "node_token": "Lxx5w7btCiKd6ZkWBTcc3ySgnLY",
  "folder_token": "Ip7vfeMnUlzLyIdj7KJcWxt1nde"
}
```

### 示例 2：移动 Wiki 节点到个人云空间根目录

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "node_token": "Lxx5w7btCiKd6ZkWBTcc3ySgnLY"
}
```

## 返回结果

### 成功

```json
{
  "code": 0,
  "msg": "移动知识库文档至云空间成功（异步任务已完成）",
  "data": {
    "task_status": "success",
    "url": "https://kr0lqjlbmo.feishu.cn/docx/Xb4Odz6A0ofQjzx95mfcWYlKnIe"
  }
}
```

## 注意事项

1. **异步执行**：此接口为异步操作，接口受理成功后返回 `task_id`，脚本内部自动每隔 5 秒轮询 Wiki 任务状态直到完成（最多轮询 3 次，即 15 秒内）
2. **快捷方式限制**：快捷方式不支持跨容器移动，不能通过本接口移动至云空间
3. **移动后效果**：移动完成后，文档无法从知识库页面树和原知识库父节点下查看
4. **node_token 来源**：`node_token` 即 Wiki 链接 `https://{domain}.feishu.cn/wiki/{node_token}` 中的 token，可直接从链接提取，无需额外解析。 注意链接中必须包含 `wiki/`
5. **权限要求**（需同时满足以下全部条件）：
   - 调用身份具有**文档可管理权限**
   - 调用身份具有**原知识库父节点容器的移出权限**
   - 调用身份具有**目标云空间文件夹的移入权限**（目标为个人云空间根目录时，需具备对应个人云空间的移入权限）
6. **权限配置**：若返回 `131006`（permission denied），需：
   - 在知识库中将应用添加为协作者并赋予「可管理」权限
   - 在目标云空间文件夹中将应用添加为协作者并赋予「可管理」权限

### 与「移动文件」（move-file）的选择指南

| 场景                            | 使用脚本                         | 说明                      |
| ------------------------------- | -------------------------------- | ------------------------- |
| 云盘文件移动到云盘文件夹        | `move-file.js`                   | 文件在云盘体系内移动      |
| Wiki 知识库节点移动到云盘文件夹 | `move-wiki-to-docs.js`（本脚本） | 跨体系移动：知识库 → 云盘 |

**判断方法**：源链接为 `https://xxx.feishu.cn/wiki/...` → 使用本脚本；源链接为 `https://xxx.feishu.cn/docx/...`、`https://xxx.feishu.cn/mindnotes/...` 等 → 使用 `move-file.js`

## 错误处理

| 错误码   | 错误信息                      | 解决方案                                                                                                            |
| -------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 99991663 | Invalid access token          | 运行 `cd "$SKILL_DIR/scripts" && node get-tenant-access-token.js --parameter-file-path <参数文件绝对路径>` 刷新令牌 |
| 131001   | rpc fail                      | 服务报错，稍后重试                                                                                                  |
| 131002   | param err                     | 检查参数类型是否正确，如 `node_token`、`folder_token` 是否为字符串                                                  |
| 131003   | out of limit                  | 超过接口频率或业务限制，降低频率后重试                                                                              |
| 131004   | invalid user                  | 核对调用身份的账号状态与权限有效性                                                                                  |
| 131005   | not found                     | 核对 `node_token`、`folder_token` 是否正确，确认资源未被删除                                                        |
| 131006   | permission denied             | 在知识库和目标云空间文件夹中均添加应用为协作者并赋予「可管理」权限                                                  |
| 131007   | internal err                  | 服务内部错误，请勿重试，联系技术支持                                                                                |
| 131008   | already exists                | 目标位置存在同名资源，调整资源名称或更换路径后重试                                                                  |
| -1       | 参数文件中必须包含 node_token | 检查参数文件是否包含 `node_token` 字段                                                                              |
