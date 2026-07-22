# 飞书文档下载为 Markdown

> ⚠️ **强制规则**：执行脚本前必须先阅读本文档，严格按照参数名和格式编写参数文件，禁止凭记忆编写参数。

## 概述

将飞书文档下载为本地 Markdown 文件，支持下载文档中的图片到同一文件夹。

## 使用方式

### 命令行调用

```bash
cd $SKILL_DIR/scripts; if ($?) { node feishu-to-markdown.js --parameter-file-path <参数文件绝对路径> }
```

### 参数文件格式

```json
{
  "tenant_access_token": "t-xxx",
  "document_id": "doxcnePuYufKa49ISjhD8Iabcef",
  "output_dir": "D:/output",
  "download_images": true
}
```

### 参数说明

| 参数名              | 类型    | 必填 | 说明                 | 默认值                      |
| ------------------- | ------- | ---- | -------------------- | --------------------------- |
| tenant_access_token | string  | yes  | 飞书应用租户访问令牌 | -                           |
| document_id         | string  | yes  | 飞书文档 ID          | -                           |
| output_dir          | string  | no   | 输出目录路径         | `$SKILL_DIR/飞书云文档下载` |
| download_images     | boolean | no   | 是否下载图片         | true                        |

#### output_dir 参数补充说明

- 如果不提供该参数，默认输出目录为 `$SKILL_DIR/飞书云文档下载`
- 会自动在输出目录下创建**以文档标题命名的子文件夹**，所有下载内容都保存在该子文件夹中
- 如果相同标题的文件夹已存在，会自动在标题后添加时间戳后缀（格式：`标题_YYYY_MM_DD_HH_mm_ss`）避免覆盖

## 使用示例

### 示例 1：下载文档并包含图片

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "document_id": "doxcnePuYufKa49ISjhD8Iabcef",
  "output_dir": "D:/output/my-article",
  "download_images": true
}
```

### 示例 2：仅下载 Markdown，不下载图片

```json
{
  "tenant_access_token": "t-g10433muWKY3PPJG4QHT3EUYO2BBFJF52SAMWXWD",
  "document_id": "doxcnePuYufKa49ISjhD8Iabcef",
  "output_dir": "D:/output/my-article",
  "download_images": false
}
```

## 输出结构

下载完成后，输出目录结构如下：

```
$SKILL_DIR/飞书云文档下载/
└── 文章标题/
    ├── 文章标题.md
    ├── image_0.png
    ├── image_1.png
    └── image_2.png
```

## 返回结果

```json
{
  "code": 0,
  "msg": "飞书文档下载成功",
  "data": {
    "document_id": "doxcnePuYufKa49ISjhD8Iabcef",
    "document_title": "文章标题",
    "markdown_file_path": "$SKILL_DIR/飞书云文档下载/文章标题/文章标题.md",
    "blocks_count": 25,
    "images_downloaded": 3
  }
}
```

## 注意事项

1. **输出目录**：如果输出目录不存在，会自动创建
2. **图片命名**：图片按顺序命名为 `image_0.png`, `image_1.png`, ...
3. **图片格式**：下载的图片统一为 PNG 格式
4. **权限要求**：需要读取文档权限

## 错误处理

### 常见错误

| 错误码  | 错误信息               | 解决方案                     |
| ------- | ---------------------- | ---------------------------- |
| -1      | 参数文件中必须包含 xxx | 检查参数文件是否包含必需字段 |
| 10003   | invalid parameter      | 检查参数格式是否正确         |
| 1770002 | not found              | 检查 document_id 是否正确    |
| 1770032 | forbidden              | 检查应用是否有文档访问权限   |
