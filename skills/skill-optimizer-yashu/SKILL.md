---
name: skill-optimizer-yashu
description: 分析和优化其他 Skill 的 SKILL.md 主文档和 references/ 引用文档，检查 frontmatter 格式、渐进式披露结构、文件引用完整性、文档 AI 友好性等问题。当用户需要[优化 skill]、[检查 skill 质量]、[review skill] 时，使用该技能。需要用户提供 skill 名称和 skills 文件夹路径。
metadata:
  author: 牙叔教程
  updated: "2026-02-23"
---

# Skill 优化器

## 功能概述

根据 [Agent Skills 规范](https://agentskills.io/specification) 分析 SKILL.md 文档的质量问题，包括：

- Frontmatter 格式检查
- 渐进式披露结构优化
- 文件引用完整性
- Token 效率

## 如何使用这个 Skill

### 使用方式

运行分析脚本，指定要检查的 skill 名称和 skills 文件夹路径：

```bash
# 分析指定 skill
python skill-optimizer-yashu/scripts/analyze.py <skill-name> --folder <skills-folder>

# 输出 JSON 报告
python skill-optimizer-yashu/scripts/analyze.py <skill-name> --folder <skills-folder> --output report.json
```

### 完整示例

```bash
# 示例：分析 skill-optimizer-yashu 自身
python skill-optimizer-yashu/scripts/analyze.py skill-optimizer-yashu --folder ./skills

# 示例：分析其他 skill 并输出 JSON 报告
python skill-optimizer-yashu/scripts/analyze.py my-skill --folder ./skills --output report.json
```

### 工作流程

1. **解析参数**：获取 skill 名称和文件夹路径
2. **加载文档**：读取 SKILL.md 和 references/ 下的文件
3. **执行检查**：依次运行 frontmatter、渐进式披露、文件引用、AI 友好性等检查
4. **生成报告**：汇总结果，输出评级和详细问题列表

### 错误处理

| 错误场景      | 处理方式                       |
| ------------- | ------------------------------ |
| Skill 不存在  | 提示找不到指定 skill 的文件夹  |
| 路径错误      | 提示无效的文件夹路径           |
| SKILL.md 缺失 | 标记为错误，提示缺少主文档     |
| JSON 输出失败 | 提示文件写入错误，建议检查权限 |

### 环境要求

- Python 3.8+

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

### 4. 文档 AI 友好性

检查 SKILL.md 主文档和 references/ 目录下的引用文档是否对 AI 友好：

**检查范围：**

- **主文档** (SKILL.md)：严格要求，权重 70%
- **引用文档** (references/\*.md)：适当放宽，权重 30%

**差异化标准：**

| 检查项       | 主文档要求   | 引用文档要求 |
| ------------ | ------------ | ------------ |
| description  | 必须清晰明确 | 无要求       |
| 祈使句指令   | 必须有       | 建议有       |
| 具体示例     | 必须有       | 建议有       |
| 决策逻辑     | 长文档需要   | 建议有       |
| 输出格式说明 | 必须有       | 建议有       |
| 错误处理说明 | 必须有       | 建议有       |
| 长段落阈值   | 500 字符     | 800 字符     |
| 扣分权重     | 高           | 低           |

**评分计算：** 总体评分 = 主文档评分 × 70% + 引用文档平均分 × 30%

检查 SKILL.md 文档本身是否对 AI 友好，确保 AI 能准确理解何时触发、如何执行：

| 检查项                 | 说明                                         | 重要性 |
| ---------------------- | -------------------------------------------- | ------ |
| **清晰的 description** | AI 需要知道何时触发此 skill                  | ⭐⭐⭐ |
| **明确的指令**         | 使用祈使句（运行、执行、调用等）而非模糊建议 | ⭐⭐⭐ |
| **具体的示例**         | 提供代码示例或用户请求示例                   | ⭐⭐⭐ |
| **决策逻辑**           | 复杂任务提供条件判断或决策树                 | ⭐⭐   |
| **输出格式**           | 明确说明 skill 应该输出什么内容              | ⭐⭐   |
| **错误处理**           | 说明异常情况和边界处理                       | ⭐⭐   |
| **避免长段落**         | 超过 500 字符的段落难以提取关键信息          | ⭐     |
| **文件引用说明**       | 引用的文件需要有 Markdown 链接说明           | ⭐     |

**文档 AI 友好性评分标准：**

| 评分   | 等级   | 说明                      |
| ------ | ------ | ------------------------- |
| 90-100 | 优秀   | AI 能够准确理解和执行     |
| 75-89  | 良好   | 基本可用，有改进空间      |
| 60-74  | 一般   | AI 可能产生歧义，需要优化 |
| < 60   | 需改进 | AI 难以理解，必须优化     |

### 5. 使用说明完整性

检查 SKILL.md 是否包含"如何使用这个 skill"的内容：

| 检查项       | 说明                                          |
| ------------ | --------------------------------------------- |
| 使用说明章节 | 是否包含 `## 如何使用这个 Skill` 或类似的章节 |
| 内容完整性   | 使用说明是否足够详细（建议至少 5 行以上内容） |
| 示例说明     | 是否包含具体的使用示例                        |

**建议的使用说明结构：**

- **功能概述** - 描述 skill 的核心功能和适用场景
- **使用方式** - 列出用户触发 skill 的示例方式
- **工作流程** - 说明 skill 被触发后的执行步骤
- **注意事项** - 重要提示和限制

### 6. Token 效率

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

### 分析模块

| 文件                                                       | 功能                       |
| ---------------------------------------------------------- | -------------------------- |
| [analyze.py](scripts/analyze.py)                           | 主分析脚本，协调各检查模块 |
| [analyzer_frontmatter.py](scripts/analyzer_frontmatter.py) | Frontmatter 格式检查       |
| [analyzer_disclosure.py](scripts/analyzer_disclosure.py)   | 渐进式披露结构检查         |
| [analyzer_references.py](scripts/analyzer_references.py)   | 文件引用完整性检查         |
| [analyzer_token.py](scripts/analyzer_token.py)             | Token 效率检查             |
| [analyzer_usage.py](scripts/analyzer_usage.py)             | 使用说明完整性检查         |
| [analyzer_ai_friendly.py](scripts/analyzer_ai_friendly.py) | 文档 AI 友好性检查         |

### 优化模块

| 文件                               | 功能                       |
| ---------------------------------- | -------------------------- |
| [optimize.py](scripts/optimize.py) | 生成优化后的文档（实验性） |

## 注意事项

1. **SKILL.md body 无固定格式**：作者自由编写，不强制章节顺序
2. **保持简洁**：name + description 决定何时触发，要准确清晰
3. **渐进式披露**：大段参考内容放到 references/，按需加载
4. **自我检查**：skill 应该能通过自己的检查规则，建议定期用本工具检查自身质量
5. **代码块格式**：使用标准的 3 个反引号（```）包裹代码块。避免使用 4 个反引号造成解析问题
