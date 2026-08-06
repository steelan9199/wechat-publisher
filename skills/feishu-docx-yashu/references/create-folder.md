# 新建文件夹

## 概述

在用户云空间的指定文件夹中创建一个空文件夹。当 `folder_token` 参数为空字符串时，表示在根目录下创建文件夹。

**使用限制**：

- 该接口不支持并发创建，调用频率上限为 5 QPS 以及 10000 次/天。超过限制会返回 `1061045` 错误码，可通过稍后重试解决
- 云空间中根目录或文件夹的单层节点上限为 1500 个。超过此限制时返回 `1062507` 错误码，可通过新建节点到其它文件夹中解决
- 云空间中所有层级的节点总和上限为 40 万个

## 使用方式

### 命令行调用

```bash
cd "$SKILL_DIR/scripts" && node create-folder.js --parameter-file-path <参数文件绝对路径>
```

### 参数文件格式

```json
{
  "tenant_access_token": "t-xxx",
  "name": "产品优化项目",
  "folder_token": "XmlTfpUwQlH7ZTdih8gcN753nyc"
}
```

### 参数说明

| 参数名              | 类型   | 必填 | 说明                                                   | 默认值         |
| ------------------- | ------ | ---- | ------------------------------------------------------ | -------------- |
| tenant_access_token | string | yes  | 飞书应用租户访问令牌                                   | -              |
| name                | string | yes  | 新建文件夹的名称                                       | -              |
| folder_token        | string | no   | 父文件夹的 token。为空字符串时表示在根目录下创建文件夹 | `""`（根目录） |

## 使用示例

### 示例 1：在指定文件夹下创建子文件夹

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "name": "产品优化项目",
  "folder_token": "XmlTfpUwQlH7ZTdih8gcN753nyc"
}
```

### 示例 2：在根目录下创建文件夹

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "name": "新建根目录文件夹",
  "folder_token": ""
}
```

### 示例 3：不指定 folder_token（默认在根目录下创建）

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "name": "新文件夹"
}
```

## 返回结果

### 成功

```json
{
  "code": 0,
  "msg": "新建文件夹成功",
  "data": {
    "token": "YkaSfwFPHl2EoVdMWI3co714n0b",
    "url": "https://kr0lqjlbmo.feishu.cn/drive/folder/YkaSfwFPHl2EoVdMWI3co714n0b",
    "name": "产品优化项目",
    "parent_folder_token": "XmlTfpUwQlH7ZTdih8gcN753nyc"
  }
}
```

| 字段                | 说明                    |
| ------------------- | ----------------------- |
| token               | 新建的文件夹的 token    |
| url                 | 新建的文件夹的 URL 链接 |
| name                | 新建文件夹的名称        |
| parent_folder_token | 父文件夹的 token        |

### 失败

```json
{
  "code": -1,
  "msg": "错误信息描述",
  "data": null
}
```

## 注意事项

1. **频率限制**：不支持并发创建，上限为 5 QPS 和 10000 次/天
2. **节点上限**：单层节点上限 1500 个，所有层级节点总和上限 40 万个
3. **根目录创建**：`folder_token` 为空字符串或不传该参数时，在根目录下创建文件夹
4. **权限要求**：需要对父文件夹具有编辑权限

## 错误处理

| 错误码   | 错误信息                | 解决方案                                                                                                            |
| -------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 99991663 | Invalid access token    | 运行 `cd "$SKILL_DIR/scripts" && node get-tenant-access-token.js --parameter-file-path <参数文件绝对路径>` 刷新令牌 |
| 1061045  | 频率超限                | 稍后重试，接口不支持并发创建，上限为 5 QPS 和 10000 次/天                                                           |
| 1062507  | 节点超限                | 单层节点上限 1500 个，将新文件夹创建到其它文件夹中                                                                  |
| 1061004  | forbidden               | 在浏览器中打开父文件夹链接，将飞书企业自建应用添加为协作者并赋予「可管理」权限                                      |
| -1       | 参数文件中必须包含 name | 检查参数文件是否包含 `name` 字段                                                                                    |
