---
name: skill-optimizer-yashu
description: 分析并优化其他 Skill 的文档质量问题，包括 frontmatter 格式、渐进式披露结构、文件引用完整性、AI 友好性等检查。何时使用：当用户说"优化这个 skill"、"检查 skill 质量"、"review skill"、"skill 有问题"、"帮我看看这个 skill"、"诊断 skill"时。
metadata:
  author: 牙叔教程
  updated: "2026-02-24 00:23:55"
  version: "1.0.0"
---

# Skill 优化器

## 功能概述

根据 [Agent Skills 规范](https://agentskills.io/specification) 分析 SKILL.md 文档的质量问题，包括：

- Frontmatter 格式检查
- 渐进式披露结构优化
- 文件引用完整性
- Token 效率

## 如何使用

### 执行步骤

1. **询问参数**：向用户确认要分析的 skill 名称和 skills 文件夹路径
2. **运行分析**：执行分析脚本检查文档质量
3. **展示结果**：向用户说明评级结果和具体改进建议

### 执行命令

```bash
# 基础分析（推荐）
python skill-optimizer-yashu/scripts/analyze.py <skill-name> --folder <skills-folder>

# 输出 JSON 报告到系统临时目录
python skill-optimizer-yashu/scripts/analyze.py <skill-name> --folder <skills-folder> --output report.json

# 清理所有过期临时文件
python skill-optimizer-yashu/scripts/analyze.py <skill-name> --folder <skills-folder> --cleanup
```

### 示例

**用户请求**："帮我检查 number-adder 这个 skill 的质量"

**执行**：

```bash
python skill-optimizer-yashu/scripts/analyze.py number-adder --folder ./skills
```

**输出结果**：

```
📊 Skill 质量分析报告: number-adder
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 综合评级: 良好

📋 检查结果:
  ✅ Frontmatter 格式: 通过
  ✅ 渐进式披露结构: 通过
  ⚠️  文件引用完整性: 1 个警告
     - 引用的文件不存在: scripts/helper.py
  ✅ AI 友好性: 通过

🔧 建议优化:
  1. 修复缺失的文件引用
```

**向用户展示**：

- 评级结果：良好
- 主要问题：引用了不存在的文件 scripts/helper.py
- 建议：修复文件引用或删除该引用

### 评级标准

| 等级       | 条件                     | 说明                                |
| :--------- | :----------------------- | :---------------------------------- |
| **需修复** | 存在错误                 | 必须修复的问题，影响 skill 正常使用 |
| **良好**   | 无错误，有警告           | 有小问题需要关注，但不影响使用      |
| **优秀**   | 无错误/警告，有建议      | 有优化建议，可以进一步提升          |
| **很好**   | 无错误/警告/建议，有提示 | 有轻微提示，整体质量较高            |
| **完美**   | 无任何 issues            | 完全符合规范，无任何问题            |

### 分析维度

1. **Frontmatter 格式** - 检查 name、description、metadata 等字段
2. **渐进式披露结构** - 检查文档长度和内容组织
3. **文件引用完整性** - 检查引用的文件是否存在
4. **文档 AI 友好性** - 检查 AI 能否准确理解和执行
5. **使用说明完整性** - 检查是否有清晰的使用说明
6. **Token 效率** - 检查信息组织方式
7. **临时文件管理** - 检查临时文件处理是否规范（产生临时文件的 Skill）

详细检查标准参见 [检查规范](references/check-spec.md)。

### 错误处理

| 错误场景      | 处理方式                      |
| ------------- | ----------------------------- |
| Skill 不存在  | 提示找不到指定 skill 的文件夹 |
| 路径错误      | 提示无效的文件夹路径          |
| SKILL.md 缺失 | 标记为错误，提示缺少主文档    |

### 环境要求

- Python 3.13.11

## Resources

### 分析模块

- [analyze.py](scripts/analyze.py) - 主分析脚本
- [analyzer_frontmatter.py](scripts/analyzer_frontmatter.py) - Frontmatter 格式检查
- [analyzer_disclosure.py](scripts/analyzer_disclosure.py) - 渐进式披露结构检查
- [analyzer_references.py](scripts/analyzer_references.py) - 文件引用完整性检查
- [analyzer_ai_friendly.py](scripts/analyzer_ai_friendly.py) - 文档 AI 友好性检查
- [analyzer_token.py](scripts/analyzer_token.py) - Token 效率检查
- [analyzer_usage.py](scripts/analyzer_usage.py) - 使用说明完整性检查

### 优化工具

- [optimize.py](scripts/optimize.py) - 根据分析结果生成优化后的 SKILL.md 文档

### 参考文档

- [检查规范](references/check-spec.md) - 详细的检查标准和规范说明
- [优化建议](references/optimization-guide.md) - 优化建议和最佳实践

## 注意事项

1. **SKILL.md body 无固定格式**：作者自由编写，不强制章节顺序
2. **渐进式披露**：大段参考内容放到 references/，按需加载
3. **自我检查**：skill 应该能通过自己的检查规则，建议定期用本工具检查自身质量
