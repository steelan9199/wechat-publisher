---
name: skill-optimizer
description: 分析和优化其他 Skill 的 SKILL.md 文档，检查 frontmatter 格式、渐进式披露结构、文件引用完整性等问题。当用户需要[优化 skill]、[检查 skill 质量]、[review skill] 时，使用该技能。
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
python skill-optimizer/scripts/analyze.py <skill-name> --folder <skills-folder>

# 输出 JSON 报告
python skill-optimizer/scripts/analyze.py <skill-name> --folder <skills-folder> --output report.json
```

## 分析维度

### 1. Frontmatter 格式

| 检查项 | 说明 |
|--------|------|
| name | 必需，小写字母/数字/连字符，1-64 字符 |
| description | 必需，1-1024 字符，描述技能和触发条件 |
| 可选字段 | license, compatibility, metadata, allowed-tools |

### 2. 渐进式披露结构

根据 Agent Skills 的渐进式披露原则：

| 层级 | 内容 | 建议大小 |
|------|------|----------|
| Metadata | name + description | ~100 tokens |
| Instructions | SKILL.md body | < 5000 tokens (< 500 行) |
| Resources | scripts/, references/ | 按需加载 |

检查项：
- [ ] SKILL.md 是否超过 500 行
- [ ] 是否有大段内容可以移到 references/
- [ ] 是否有重复内容可以提取到独立文件

### 3. 文件引用完整性

检查 SKILL.md 中引用的文件是否存在：

| 文件夹 | 检查内容 |
|--------|----------|
| scripts/ | 引用的 .py/.sh/.js 文件是否存在 |
| references/ | 引用的 .md 文件是否存在 |
| assets/ | 引用的模板/图片是否存在 |

### 4. Token 效率

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

```markdown
# 正确
参见技术参考：references/REFERENCE.md
运行脚本：scripts/extract.py

# 避免
参见 /absolute/path/to/reference.md
```

## 资源索引

- `scripts/analyze.py` - 分析 SKILL.md 质量
- `scripts/optimize.py` - 生成优化后的文档（实验性）

## 注意事项

1. **SKILL.md body 无固定格式**：作者自由编写，不强制章节顺序
2. **保持简洁**：name + description 决定何时触发，要准确清晰
3. **渐进式披露**：大段参考内容放到 references/，按需加载
