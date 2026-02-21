---
name: skill-optimizer-yashu
description: 分析和优化其他 Skill 的 SKILL.md 文档，检查 frontmatter 格式、渐进式披露结构、文件引用完整性等问题。当用户需要[优化 skill]、[检查 skill 质量]、[review skill] 时，使用该技能。
metadata:
  author: 牙叔教程
  version: "1.0"
---

# Skill 优化器

## 功能概述

根据 [Agent Skills 规范](https://agentskills.io/specification) 分析 SKILL.md 文档的质量问题，包括：

- Frontmatter 格式检查
- 渐进式披露结构优化
- 文件引用完整性
- Token 效率

## 使用方式

```bash
# 分析指定 skill
python skill-optimizer-yashu/scripts/analyze.py <skill-name> --folder <skills-folder>

# 输出 JSON 报告
python skill-optimizer-yashu/scripts/analyze.py <skill-name> --folder <skills-folder> --output report.json
```

## 评级标准

分析结果按以下等级评定：

| 等级       | 条件                     | 说明                                |
| :--------- | :----------------------- | :---------------------------------- |
| **需修复** | 存在错误                 | 必须修复的问题，影响 skill 正常使用 |
| **良好**   | 无错误，有警告           | 有小问题需要关注，但不影响使用      |
| **优秀**   | 无错误/警告，有建议      | 有优化建议，可以进一步提升          |
| **很好**   | 无错误/警告/建议，有提示 | 有轻微提示，整体质量较高            |
| **完美**   | 无任何 issues            | 完全符合规范，无任何问题            |

## 分析维度

### 1. Frontmatter 格式

| 检查项      | 说明                                            |
| ----------- | ----------------------------------------------- |
| name        | 必需，小写字母/数字/连字符，1-64 字符           |
| description | 必需，1-1024 字符，描述技能和触发条件           |
| 可选字段    | license, compatibility, metadata, allowed-tools |

### 2. 渐进式披露结构

根据 Agent Skills 的渐进式披露原则：

| 层级         | 内容                  | 建议大小                 |
| ------------ | --------------------- | ------------------------ |
| Metadata     | name + description    | ~100 tokens              |
| Instructions | SKILL.md body         | < 5000 tokens (< 500 行) |
| Resources    | scripts/, references/ | 按需加载                 |

检查项：

- [ ] SKILL.md 是否超过 500 行
- [ ] 是否有大段内容可以移到 references/
- [ ] 是否有重复内容可以提取到独立文件

### 3. 文件引用完整性

检查 SKILL.md 中引用的文件是否存在：

| 文件夹      | 检查内容                        |
| ----------- | ------------------------------- |
| scripts/    | 引用的 .py/.sh/.js 文件是否存在 |
| references/ | 引用的 .md 文件是否存在         |
| assets/     | 引用的模板/图片是否存在         |

**引用格式规范**：

- 代码示例中引用的文件，应在正文中使用 Markdown 链接格式说明

正确格式示例：

- 运行脚本：[analyze.py](scripts/analyze.py)
- 命令：`python scripts/analyze.py <skill-name> --folder <skills-folder>`

错误格式：（仅在代码块中出现，无正文引用）

```
python scripts/analyze.py <skill-name> --folder <skills-folder>
```

### 4. 脚本代码 AI 友好性

检查 scripts/ 中的代码是否遵循 AI 友好原则：

| 检查项           | 说明                                                              |
| ---------------- | ----------------------------------------------------------------- |
| 输入方式         | 支持命令行参数、环境变量或结构化数据（JSON/YAML），避免交互式提示 |
| 输出格式         | 使用结构化格式（JSON/YAML/表格），包含明确的字段名                |
| 错误处理         | 返回标准退出码，错误信息输出到 stderr，成功结果输出到 stdout      |
| 避免自然语言解析 | 输出不包含需要 AI 解析的自然语言描述                              |
| 文件大小         | 脚本文件建议保持在 500 行以内，超过则建议拆分功能                 |

### 5. Token 效率

- 使用表格组织信息（如用户输入对照表）
- 使用列表代替长段落
- 避免重复内容

## 优化建议

### 何时拆分内容到 references/

当 SKILL.md 出现以下情况时，建议拆分：

1. **详细技术参考** → 移到 references/REFERENCE.md
2. **表单模板** → 移到 references/FORMS.md
3. **领域特定文档** → 移到 references/domain.md
4. **超过 500 行** → 提取非核心内容到 references/

### 文件引用规范

使用相对路径引用：

**正确格式**：使用 Markdown 链接

- 格式：方括号内写显示文本，圆括号内写相对路径
- 示例：参考文档链接显示为蓝色可点击文本

**避免**：使用绝对路径

- 参见 /absolute/path/to/reference.md

**文档中的示例路径处理**：

- 文档中作为示例的文件路径应使用纯文本描述，而非实际链接格式
- 避免在正文中引用不存在的示例文件
- 正确做法：用文字描述格式，如"使用方括号加圆括号的形式引用文件"
- **特别注意**：不要在反引号内使用 Markdown 链接格式（如 \`[文本](路径)\`），这仍会被识别为链接`

## 资源索引

- [scripts/analyze.py](scripts/analyze.py) - 分析 SKILL.md 质量
- [scripts/optimize.py](scripts/optimize.py) - 生成优化后的文档（实验性）

## 注意事项

1. **SKILL.md body 无固定格式**：作者自由编写，不强制章节顺序
2. **保持简洁**：name + description 决定何时触发，要准确清晰
3. **渐进式披露**：大段参考内容放到 references/，按需加载
4. **自我检查**：skill 应该能通过自己的检查规则，建议定期用本工具检查自身质量
5. **代码块格式**：使用标准的 3 个反引号（```）包裹代码块。避免使用 4 个反引号造成解析问题
