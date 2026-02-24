# 优化建议

本文档提供优化 Skill 文档的最佳实践和建议。

## 何时拆分内容到 references/

当 SKILL.md 出现以下情况时，建议拆分：

1. **详细技术参考** → 移到 references/REFERENCE.md
2. **表单模板** → 移到 references/FORMS.md
3. **领域特定文档** → 移到 references/domain.md
4. **超过 500 行** → 提取非核心内容到 references/

## 临时文件管理最佳实践

### 存放位置

使用系统临时目录：

- Windows: `%TEMP%` (如 `C:\Users\xxx\AppData\Local\Temp\`)
- Linux/Mac: `/tmp/`

**避免**：存放在技能目录或工作目录

### 命名规范

确保文件名唯一：

- 格式：`{skill-name}-{operation}-{timestamp}-{random}.{ext}`
- 示例：`skill-name-operation-1740374400000-a7x9k2.json`

### 自动清理

- 每次分析完成后自动清理24小时前的过期临时文件
- 支持手动清理：`python analyze.py <skill-name> --folder <path> --cleanup`

### 工具函数（Python）

- `generate_temp_filename(operation)` - 生成唯一临时文件名
- `cleanup_temp_file(file_path)` - 删除单个临时文件
- `cleanup_all_temp_files()` - 批量清理过期临时文件（24小时前的）

## 文件引用规范

使用相对路径引用：

**正确格式**：使用 Markdown 链接

- 格式：方括号内写显示文本，圆括号内写相对路径
- 示例：`[analyze.py](scripts/analyze.py)`

**避免**：使用绝对路径

- ~~参见 /absolute/path/to/reference.md~~

## 代码块格式

使用标准的 3 个反引号（```）包裹代码块。避免使用 4 个反引号造成解析问题。

## 自我检查

Skill 应该能通过自己的检查规则，建议定期用本工具检查自身质量。
