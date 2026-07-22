# 上传文件 API

## 接口信息

- **接口地址**: `POST https://api.coze.cn/v1/files/upload`
- **权限点**: `Account.uploadFile` / `Connector.uploadFile`
- **功能**: 将本地文件上传到扣子平台，获取 file_id 供后续在对话中使用

## 使用场景

- 在消息中发送文件（图片、文档、音频、视频等）给智能体
- 上传文件供工作流使用
- 需要先上传文件才能在多模态内容中引用

## 支持的文件格式

| 类型   | 支持的格式                                               |
| ------ | -------------------------------------------------------- |
| 文档   | DOC, DOCX, XLS, XLSX, PPT, PPTX, PDF, Numbers, CSV       |
| 图片   | JPG, JPEG, PNG, GIF, WEBP, HEIC, HEIF, BMP, PCD, TIFF    |
| 音频   | WAV, MP3, FLAC, M4A, AAC, OGG, WMA, MIDI                 |
| 视频   | MP4, AVI, MOV, 3GP, 3GPP, FLV, WEBM, WMV, RMVB, M4V, MKV |
| 文本   | CPP, PY, JAVA, C                                         |
| 压缩包 | RAR, ZIP, 7Z, GZ, GZIP, BZ2                              |

## 使用限制

- **文件大小**: 最大 512 MB（实际可用大小取决于智能体的模型版本）
- **上传方式**: 必须使用 `multipart/form-data` 方式
- **有效期**: 普通上传有效期 3 个月；若作为扣子头像则永久有效
- **使用范围**: 仅限本账号查看或使用

## 调用脚本

> ⚠️ **重要**：参数文件路径必须使用**绝对路径**，且临时文件必须放在 `$SKILL_DIR/temp` 目录下！

```bash
cd $SKILL_DIR/scripts; node upload_file.js <文件绝对路径>
```

> ⚠️ **必须先 cd 到 scripts 目录！** 例如：
>
> ```bash
> cd $SKILL_DIR/scripts; node upload_file.js $SKILL_DIR/temp/photo.jpg
> ```

### 参数说明

| 参数         | 必需 | 说明                                                         |
| ------------ | ---- | ------------------------------------------------------------ |
| 文件绝对路径 | 是   | 要上传的文件的**绝对路径**（如 `$SKILL_DIR/temp/photo.jpg`） |

> ⚠️ **注意**：不要使用相对路径（如 `./images/photo.jpg` 或 `images/photo.jpg`），因为脚本从 `$SKILL_DIR/scripts` 目录执行，相对路径会基于该目录解析，可能导致文件找不到。

### 示例

```bash
# 使用绝对路径上传图片文件
cd $SKILL_DIR/scripts; node upload_file.js $SKILL_DIR/temp/photo.jpg

# 使用绝对路径上传 PDF 文档
cd $SKILL_DIR/scripts; node upload_file.js $SKILL_DIR/temp/report.pdf
```

### 输出格式

成功后会返回 JSON 格式的结果：

```json
{
  "file_id": "737xxxxx",
  "file_name": "photo.jpg",
  "file_size": 1024000
}
```

## 在对话中使用上传的文件

获取 `file_id` 后，可以在发送消息时通过 `files` 参数引用该文件：

1. 先调用 `upload_file.js` 获取 `file_id`
2. 将 `file_id` 配合 `send_message.js` 使用

具体用法可参考 [$SKILL_DIR/references/bot/sendMessage.md]($SKILL_DIR/references/bot/sendMessage.md) 中的多文件上传示例。

## 注意事项

1. 上传的文件有效期为 3 个月，到期后文件将被自动删除
2. 无法直接下载已上传的文件，只能通过 `file_id` 在对话中引用
