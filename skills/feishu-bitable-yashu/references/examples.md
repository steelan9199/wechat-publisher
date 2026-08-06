# 参数配置示例与最佳实践

## 参数配置文件示例

### 基础配置

```json
{
  "tenant_access_token": "t-g10422d2T3VFF5VJTxxxxxx",
  "app_token": "D7rGbT0YGaJzKRxxxxx",
  "table_id": "tblbDqK4xxxxxx"
}
```

### 新增记录配置

```json
{
  "tenant_access_token": "t-g10422d2T3VFF5VJTxxxxxx",
  "app_token": "D7rGbT0YGaJzKRxxxxx",
  "table_id": "tblbDqK4xxxxxx",
  "fields": {
    "任务名称": "完成产品需求文档",
    "负责人": "张三",
    "优先级": "高",
    "任务状态": "进行中",
    "截止日期": 1749504000000,
    "进度百分比": 75
  }
}
```

### 批量新增记录配置

```json
{
  "tenant_access_token": "t-g10422d2T3VFF5VJTxxxxxx",
  "app_token": "D7rGbT0YGaJzKRxxxxx",
  "table_id": "tblbDqK4xxxxxx",
  "records": [
    {
      "fields": {
        "任务名称": "完成产品需求文档",
        "负责人": "张三"
      }
    },
    {
      "fields": {
        "任务名称": "设计数据库架构",
        "负责人": "李四"
      }
    }
  ]
}
```

## 字段类型选择建议

| 字段类型 | 适用场景                     | 示例                                             |
| -------- | ---------------------------- | ------------------------------------------------ |
| 文本     | 任务名称、描述、备注、员工等 | 任务名称：完成产品需求文档                       |
| 数字     | 进度百分比、金额、数量等     | 进度百分比：75                                   |
| 单选     | 优先级、状态等互斥选项       | 优先级：高/中/低                                 |
| 多选     | 标签、分类等多选选项         | 标签：紧急、重要                                 |
| 日期     | 截止日期、创建时间等         | 截止日期：1749504000000（Unix时间戳,毫秒级）     |
| 复选框   | 是否完成、是否紧急等         | 是否完成：true/false                             |
| 超链接   | 相关链接、参考文档等         | {"text": "文档", "link": "https://..."}          |
| 附件     | 相关文件、图片等             | [{"file_token": "xxx", "name": "file.pdf", ...}] |

## ⚠️ 重要：字段读写格式差异

飞书 API 在**读取**和**写入**记录时，某些字段的格式要求不同：

### 文本/多行文本字段

| 操作                 | 格式       | 示例                                                     |
| -------------------- | ---------- | -------------------------------------------------------- |
| **写入** (创建/更新) | 字符串     | `"任务描述": "这是一个任务"`                             |
| **读取** (查询)      | 富文本数组 | `"任务描述": [{"text": "这是一个任务", "type": "text"}]` |

### 写入记录时的正确格式

```json
{
  "fields": {
    "文本字段": "直接使用字符串",
    "多行文本": "也是字符串格式",
    "数字字段": 100,
    "日期字段": 1749504000000,
    "复选框": true,
    "单选": "选项1",
    "多选": ["选项1", "选项2"],
    "超链接": {
      "text": "点击访问",
      "link": "https://example.com"
    },
    "附件": [{ "file_token": "DRiFbwaKsoZaLax4WKZbEGCccoe" }]
  }
}
```

### 常见错误

❌ **错误示例** - 写入时使用查询返回的格式：

```json
{
  "fields": {
    "多行文本": [{ "text": "内容", "type": "text" }]
  }
}
```

✅ **正确示例** - 写入时使用简化格式：

```json
{
  "fields": {
    "多行文本": "内容"
  }
}
```

## 性能优化建议

| 优化项             | 说明                                                              |
| ------------------ | ----------------------------------------------------------------- |
| 批量操作优先       | 使用批量操作 API（如新增多条记录、更新多条记录）减少 API 调用次数 |
| 分页查询           | 使用分页查询 API 避免一次性查询过多数据                           |
| 缓存访问凭证       | `tenant_access_token` 有效期约 2 小时，避免频繁重新获取           |
| 合理设置 page_size | 单次查询最多 500 条，根据实际需求设置合适的分页大小               |

## 临时文件管理详细流程

AI 调用本 Skill 时，所有临时参数文件均存放在 **`$SKILL_DIR/temp`** 目录（即 `$SKILL_DIR/temp/`），遵循 skill-laws-yashu 规则 #17 的要求，统一管理避免污染用户主目录和系统临时目录。

### 临时文件存放位置

| 系统     | 临时目录示例                                                     |
| -------- | ---------------------------------------------------------------- |
| 任意平台 | `$SKILL_DIR/temp/feishu-create-record-1740374400000-a7x9k2.json` |

**命名规范**：`feishu-{operation}-{timestamp}-{random}.json`

### AI 操作临时文件的完整流程

| 步骤 | 执行动作         | 说明                                                                                                                                                                                    |
| ---- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | 读取对应参考文档 | 按 JSON Schema 构造参数对象                                                                                                                                                             |
| 2    | 创建临时参数文件 | 使用 Write 工具将参数 JSON 写入 `$SKILL_DIR/temp` 目录                                                                                                                                  |
| 3    | 执行脚本         | `cd $SKILL_DIR/scripts && node record/create.js --parameter-file-path "..."`                                                                                                              |
| 4    | 清理临时参数文件 | 完成用户需求或报错终止后，运行 `cd $SKILL_DIR/scripts && node clear_temp.js` 清理 temp 目录                                                                                               |

### 关键原则

- ✅ 临时文件必须创建在 `$SKILL_DIR/temp` 目录
- ✅ 完成用户需求或报错终止后，通过 `node clear_temp.js` 清理 temp 目录
- ✅ 使用 `try...finally` 思路确保即使出错也会清理（AI 通过"完成需求或报错终止后运行 clear_temp.js"实现）
- ❌ 不要将参数文件创建在技能目录或用户工作目录

## 使用流程示例

### 场景1：创建数据表并添加记录

1. 获取访问凭证 `tenant_access_token`
2. 解析多维表格 URL 获取 `app_token`
3. 创建数据表（使用 [table/create-single.js]($SKILL_DIR/scripts/table/create-single.js)）
4. 添加记录（使用 [record/create.js]($SKILL_DIR/scripts/record/create.js) 或 [record/batch-create.js]($SKILL_DIR/scripts/record/batch-create.js)）

### 场景2：查询记录并更新

1. 获取访问凭证 `tenant_access_token`
2. 解析多维表格 URL 获取 `app_token` 和 `table_id`
3. 查询记录（使用 [record/get.js]($SKILL_DIR/scripts/record/get.js)）
4. 更新记录（使用 [record/update.js]($SKILL_DIR/scripts/record/update.js)）

### 场景3：上传附件并关联到记录

1. 获取访问凭证 `tenant_access_token`
2. 上传素材（使用 [media/upload.js]($SKILL_DIR/scripts/media/upload.js)）获取 `file_token`
3. 创建记录时在附件字段中使用 `file_token`

## 常见错误处理

| 错误场景         | 可能原因                 | 解决方案                                                                                                    |
| ---------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| 记录创建失败     | 字段类型不匹配           | 检查字段类型，确保数值类型字段传入数字，日期字段传入时间戳                                                  |
| 批量操作部分失败 | 某条记录数据格式错误     | 检查返回结果中的错误详情，修正对应记录的数据格式                                                            |
| 查询无结果       | table_id 或 view_id 错误 | 确认从 URL 解析的 ID 正确，使用 [parse_bitable_url.md]($SKILL_DIR/references/parse_bitable_url.md) 工具验证 |
| 附件上传失败     | 格式不支持或网络问题     | 确认文件格式符合要求，检查网络连接                                                                          |
| 权限错误         | 应用未添加到表格         | 按照 [authentication.md]($SKILL_DIR/references/authentication.md) 中的步骤将应用添加到多维表格              |

详细错误码及解决方案参见 [常见错误及解决方案]($SKILL_DIR/references/errors.md)。

---

## 🧪 测试时发现的问题记录

### 2026-02-24 测试记录

#### 问题1：文本字段写入格式错误

**现象**：创建记录时返回错误 `TextFieldConvFail`

```json
{
  "code": 1254060,
  "msg": "TextFieldConvFail",
  "error": {
    "message": "Invalid request parameter: 'fields.多行文本.fieldValue[map[text:...'. Correct format : the value of 'Multiline' must be a string."
  }
}
```

**原因**：将查询返回的富文本数组格式直接用于写入操作。

**错误写法**（❌）：

```json
{
  "fields": {
    "多行文本": [{ "text": "这是内容", "type": "text" }]
  }
}
```

**正确写法**（✅）：

```json
{
  "fields": {
    "多行文本": "这是内容"
  }
}
```

**解决方案**：

- **写入**记录时（创建/更新）：文本字段使用**字符串**格式
- **读取**记录时（查询）：API 返回的是**富文本数组**格式
- 在操作前先用 `field/list.js` 查看字段类型，确保数据格式匹配

#### 问题2：字段更新缺少 type 参数

**现象**：更新字段时返回错误 `field validation failed`

```json
{
  "code": 99992402,
  "msg": "field validation failed",
  "error": {
    "field_violations": [
      {
        "field": "type",
        "description": "type is required"
      }
    ]
  }
}
```

**原因**：更新字段时必须提供 `type` 参数

**解决方案**：

- 更新字段时务必包含 `type` 字段
- 正确示例 ✅：

```json
{
  "field_id": "fldxxx",
  "field_name": "新名称",
  "type": 1
}
```

#### 问题3：获取文件下载链接参数名错误

**现象**：脚本报错 `Cannot read properties of undefined (reading 'map')`

**原因**：使用了 `file_token` 而不是 `file_tokens`

**解决方案**：

- 参数名必须是 `file_tokens`（复数形式，带 s）
- `file_tokens` 必须是数组类型
- 错误示例 ❌：`"file_token": "xxx"`
- 正确示例 ✅：`"file_tokens": ["xxx"]`

#### 问题4：凭证有效期

**现象**：一段时间后 API 返回 401/403 错误

**原因**：`tenant_access_token` 有效期为 2 小时

**解决方案**：

- 定期重新获取 `tenant_access_token`
- 或在代码中实现自动刷新机制

#### 测试验证的功能清单

✅ **已验证功能**（2026-02-24）：

- [x] 获取访问凭证 (`get-tenant-access-token.js`)
- [x] 解析 URL (`parse-bitable-url.js`)
- [x] 数据表操作：列出、创建、更新、删除
- [x] 记录操作：查询、创建、更新、删除
- [x] 记录批量操作：批量创建、批量更新、批量获取、批量删除
- [x] 字段操作：列出、创建、更新、删除

**测试表格**：`https://kr0lqjlbmo.feishu.cn/wiki/To1Swkz5riWl7qklbHVca4AEnWe`

**测试后状态**：所有测试数据已清理，表格恢复原始状态（2条记录）
