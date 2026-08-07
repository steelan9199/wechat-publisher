# 获取文件夹 token

## 概述

获取飞书云空间中文件夹的 token（folder_token）。文件夹是飞书云空间中用于管理文件和其它文件夹的容器，每个文件夹都有唯一的 token 作为标识。在不同接口中，其参数命名可能不同，包括 `token`、`folder_token`、`folderToken` 等，但本质上都是同一个概念。

获取方式：用户提供了文件夹的 URL，URL 包含 `/drive/folder/`，从文件夹链接提取 token。

### 文件夹链接格式

| 链接类型     | URL 格式                                                 | 说明                        |
| ------------ | -------------------------------------------------------- | --------------------------- |
| 云空间文件夹 | `https://{domain}.feishu.cn/drive/folder/{folder_token}` | token 直接从 URL 路径中提取 |

示例：

- `https://kr0lqjlbmo.feishu.cn/drive/folder/XmlTfpUwQlH7ZTdih8gcN753nyc?from=space_personal_folder` 的 token 为 `XmlTfpUwQlH7ZTdih8gcN753nyc`
- `https://kr0lqjlbmo.feishu.cn/drive/folder/Ip7vfeMnUlzLyIdj7KJcWxt1nde` 的 token 为 `Ip7vfeMnUlzLyIdj7KJcWxt1nde`

## 从链接提取 token

AI Agent 在思考过程中直接使用以下正则匹配 URL 即可：

```
/\/drive\/folder\/([a-zA-Z0-9]+)/
```

### 提取示例

| 输入 URL                                                                                           | 提取出的 token                |
| -------------------------------------------------------------------------------------------------- | ----------------------------- |
| `https://kr0lqjlbmo.feishu.cn/drive/folder/XmlTfpUwQlH7ZTdih8gcN753nyc`                            | `XmlTfpUwQlH7ZTdih8gcN753nyc` |
| `https://kr0lqjlbmo.feishu.cn/drive/folder/XmlTfpUwQlH7ZTdih8gcN753nyc?from=space_personal_folder` | `XmlTfpUwQlH7ZTdih8gcN753nyc` |
| `https://kr0lqjlbmo.feishu.cn/drive/folder/Ip7vfeMnUlzLyIdj7KJcWxt1nde#heading=h1`                 | `Ip7vfeMnUlzLyIdj7KJcWxt1nde` |

### 注意事项

- 仅支持 `/drive/folder/{token}` 格式的链接，会自动忽略 URL 中的查询参数（`?` 后内容）和锚点（`#` 后内容）
- token 仅由字母和数字组成，正则中 `[a-zA-Z0-9]+` 已涵盖全部合法字符
- 若 URL 不匹配该格式，应判定为非法链接，提示用户提供正确的飞书云空间文件夹链接

### 返回结果

返回如下信息：

```json
"folder_token": "XmlTfpUwQlH7ZTdih8gcN753nyc",
```
