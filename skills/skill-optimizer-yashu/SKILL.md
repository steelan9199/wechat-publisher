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

## 如何使用这个 Skill

### 执行步骤

1. **询问参数**：向用户确认要分析的 skill 名称和 skills 文件夹路径
2. **运行分析**：执行分析脚本检查文档质量
3. **展示结果**：向用户说明评级结果和具体改进建议

### 执行命令

**立即运行以下命令分析指定 skill：**

```bash
# 基础分析（推荐）
python skill-optimizer-yashu/scripts/analyze.py <skill-name> --folder <skills-folder>

# 输出 JSON 报告供后续处理
python skill-optimizer-yashu/scripts/analyze.py <skill-name> --folder <skills-folder> --output report.json
```

### 完整示例

**示例 1：分析 skill-optimizer-yashu 自身**

```bash
python skill-optimizer-yashu/scripts/analyze.py skill-optimizer-yashu --folder ./skills
```

**示例 2：分析其他 skill 并生成报告**

```bash
python skill-optimizer-yashu/scripts/analyze.py my-skill --folder ./skills --output report.json
```

### 分析工作流程

1. **解析参数**：获取 skill 名称和 skills 文件夹路径
2. **加载文档**：读取 SKILL.md 和 references/ 下的文件
3. **执行检查**：依次运行 frontmatter、渐进式披露、文件引用、AI 友好性等检查
4. **生成报告**：汇总结果，输出评级和详细问题列表
5. **展示结果**：向用户说明评级和改进建议

### 输出报告示例

分析完成后，终端会显示类似以下的报告：

```
📊 Skill 质量分析报告: my-skill
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 综合评级: 良好

📋 检查结果:
  ✅ Frontmatter 格式: 通过
  ✅ 渐进式披露结构: 通过
  ⚠️  文件引用完整性: 1 个警告
     - 引用的文件不存在: scripts/helper.py
  ✅ AI 友好性: 通过
  ✅ 使用说明完整性: 通过

🔧 建议优化:
  1. 修复缺失的文件引用
  2. 考虑将长段落拆分为列表
```

**根据评级采取相应行动：**

- **需修复**：向用户说明必须修复的问题
- **良好/优秀**：向用户说明有小问题可以优化
- **很好/完美**：告知用户 skill 质量很高

### 错误处理

| 错误场景      | 处理方式                       |
| ------------- | ------------------------------ |
| Skill 不存在  | 提示找不到指定 skill 的文件夹  |
| 路径错误      | 提示无效的文件夹路径           |
| SKILL.md 缺失 | 标记为错误，提示缺少主文档     |
| JSON 输出失败 | 提示文件写入错误，建议检查权限 |

### 环境要求

- Python 3.13.11

## 评级标准

分析结果按以下等级评定：

| 等级       | 条件                     | 说明                                |
| :--------- | :----------------------- | :---------------------------------- |
| **需修复** | 存在错误                 | 必须修复的问题，影响 skill 正常使用 |
| **良好**   | 无错误，有警告           | 有小问题需要关注，但不影响使用      |
| **优秀**   | 无错误/警告，有建议      | 有优化建议，可以进一步提升          |
| **很好**   | 无错误/警告/建议，有提示 | 有轻微提示，整体质量较高            |
| **完美**   | 无任何 issues            | 完全符合规范，无任何问题            |

##### 分析维度

| 维度                | 说明                                    | 适用场景                 |
| ------------------- | --------------------------------------- | ------------------------ |
| 1. Frontmatter 格式 | 检查 name、description、metadata 等字段 | 所有 Skill               |
| 2. 渐进式披露结构   | 检查文档长度和内容组织                  | 所有 Skill               |
| 3. 文件引用完整性   | 检查引用的文件是否存在                  | 所有 Skill               |
| 4. 文档 AI 友好性   | 检查 AI 能否准确理解和执行              | 所有 Skill               |
| 5. 使用说明完整性   | 检查是否有清晰的使用说明                | 所有 Skill               |
| 6. Token 效率       | 检查信息组织方式                        | 所有 Skill               |
| 7. 临时文件管理     | 检查临时文件处理是否规范                | **产生临时文件的 Skill** |

### 1. Frontmatter 格式

| 检查项      | 必需 | 说明                            |
| ----------- | ---- | ------------------------------- |
| name        | 是   | 小写字母/数字/连字符，1-64 字符 |
| description | 是   | 1-1024 字符，详见下方格式要求   |
| metadata    | 否   | 作者、更新时间、版本等信息      |

**description 格式要求：**

必须包含两部分内容，用 `何时使用：` 分隔：

1. **功能描述** - 这个技能是做什么的
2. **何时使用** - 用户说什么话时触发这个技能

**正确示例：**

```yaml
description: 分析并优化其他 Skill 的文档质量问题，包括 frontmatter 格式、渐进式披露结构等检查。何时使用：当用户说"优化这个 skill"、"检查 skill 质量"、"review skill"时。
```

**错误示例：**

```yaml
# ❌ 缺少"何时使用"部分
description: 分析并优化 Skill 的文档质量问题

# ❌ 使用"触发条件"而非"何时使用"
description: 分析 Skill 质量问题。触发条件：用户说优化 skill 时
```

**metadata 字段规范：**

| 字段    | 格式要求                                | 示例                             |
| ------- | --------------------------------------- | -------------------------------- |
| author  | 字符串                                  | `author: "牙叔教程"`             |
| updated | **YYYY-MM-DD HH:MM:SS**（必须精确到秒） | `updated: "2026-02-24 14:30:00"` |
| version | 语义化版本号                            | `version: "1.0.0"`               |

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

| 检查项       | 主文档要求 | 引用文档要求 |
| ------------ | ---------- | ------------ |
| 祈使句指令   | 必须有     | 建议有       |
| 具体示例     | 必须有     | 建议有       |
| 决策逻辑     | 长文档需要 | 建议有       |
| 输出格式说明 | 必须有     | 建议有       |
| 错误处理说明 | 必须有     | 建议有       |
| 长段落阈值   | 500 字符   | 800 字符     |
| 扣分权重     | 高         | 低           |

> **说明**：description 的要求参见 [Frontmatter 格式](#1-frontmatter-格式) 章节。

**评分计算：** 总体评分 = 主文档评分 × 70% + 引用文档平均分 × 30%

检查 SKILL.md 文档本身是否对 AI 友好，确保 AI 能准确理解何时触发、如何执行：

| 检查项           | 说明                                         | 重要性 |
| ---------------- | -------------------------------------------- | ------ |
| **明确的指令**   | 使用祈使句（运行、执行、调用等）而非模糊建议 | ⭐⭐⭐ |
| **具体的示例**   | 提供代码示例或用户请求示例                   | ⭐⭐⭐ |
| **决策逻辑**     | 复杂任务提供条件判断或决策树                 | ⭐⭐   |
| **输出格式**     | 明确说明 skill 应该输出什么内容              | ⭐⭐   |
| **错误处理**     | 说明异常情况和边界处理                       | ⭐⭐   |
| **避免长段落**   | 超过 500 字符的段落难以提取关键信息          | ⭐     |
| **文件引用说明** | 引用的文件需要有 Markdown 链接说明           | ⭐     |

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
- **工作流程** - 说明 skill 被触发后的执行步骤
- **注意事项** - 重要提示和限制

### 6. Token 效率

- 使用表格组织信息（如用户输入对照表）
- 使用列表代替长段落
- 避免重复内容

### 7. 临时文件管理（可选）

> **适用场景**：仅当 Skill 在执行过程中需要创建临时文件（如参数文件、缓存文件等）时才需要检查此项。

检查 Skill 是否妥善处理执行过程中产生的临时文件：

| 检查项           | 说明                                       | 重要性 |
| ---------------- | ------------------------------------------ | ------ |
| **临时文件位置** | 临时文件应存放在系统临时目录，而非技能目录 | ⭐⭐⭐ |
| **命名规范**     | 使用唯一命名（时间戳+随机数），避免冲突    | ⭐⭐   |
| **自动清理**     | 执行完成后立即删除临时文件                 | ⭐⭐⭐ |
| **异常处理**     | 即使执行失败也要尝试清理临时文件           | ⭐⭐   |

**不产生临时文件的 Skill 无需关注此项**，例如：

- 纯查询类 Skill（只读操作）
- 直接调用 API 无需中间文件的 Skill
- 使用内存传递数据的 Skill

**推荐的临时文件管理方案：**

```javascript
// Node.js 示例
const fs = require("fs");
const path = require("path");
const os = require("os");

// 创建临时参数文件（自动存放到系统临时目录）
function createTempParamsFile(params, operation) {
  const tempDir = os.tmpdir();
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const fileName = `feishu-${operation}-${timestamp}-${random}.json`;
  const filePath = path.join(tempDir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(params, null, 2));
  return filePath;
}

// 清理临时文件
function cleanupTempFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {
    // 忽略删除失败
  }
}

// 使用示例
const tempPath = createTempParamsFile(params, "operation-name");
try {
  await executeScript(tempPath);
} finally {
  cleanupTempFile(tempPath);
}
```

```python
# Python 示例
import tempfile
import os

# 创建临时文件
with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
    json.dump(params, f)
    temp_path = f.name

try:
    # 执行操作...
    execute_script(temp_path)
finally:
    # 清理临时文件
    if os.path.exists(temp_path):
        os.unlink(temp_path)
```

**临时文件存放位置：**

- Windows: `%TEMP%` (如 `C:\Users\xxx\AppData\Local\Temp\`)
- Linux/Mac: `/tmp/`

**命名规范：**

- 格式：`{skill-name}-{operation}-{timestamp}-{random}.{ext}`
- 示例：`feishu-bitable-create-record-1740374400000-a7x9k2.json`

## 优化建议

### 何时拆分内容到 references/

当 SKILL.md 出现以下情况时，建议拆分：

1. **详细技术参考** → 移到 references/REFERENCE.md
2. **表单模板** → 移到 references/FORMS.md
3. **领域特定文档** → 移到 references/domain.md
4. **超过 500 行** → 提取非核心内容到 references/

### 临时文件管理最佳实践

> **注意**：仅当 Skill 需要创建临时文件时才需要遵循以下原则。

当 Skill 需要创建临时文件时，遵循以下原则：

1. **存放位置**：使用系统临时目录
   - Windows: `%TEMP%`
   - Linux/Mac: `/tmp/`
   - **避免**：存放在技能目录或工作目录

2. **命名规范**：确保文件名唯一
   - 格式：`{skill-name}-{operation}-{timestamp}-{random}.{ext}`
   - **避免**：使用固定名称如 `params.json`

3. **自动清理**：用完即删
   - 使用 `try...finally` 确保清理代码执行
   - **避免**：依赖手动清理或系统定期清理

4. **工具函数**：封装复用
   - Node.js: 参考 `feishu-bitable/scripts/utils.js`
   - Python: 使用标准库 `tempfile` 模块

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
2. **渐进式披露**：大段参考内容放到 references/，按需加载
3. **自我检查**：skill 应该能通过自己的检查规则，建议定期用本工具检查自身质量
4. **代码块格式**：使用标准的 3 个反引号（```）包裹代码块。避免使用 4 个反引号造成解析问题

## 快速参考卡片

**触发关键词：** 优化 skill | 检查 skill 质量 | review skill | skill 有问题 | 诊断 skill

**必需参数：** skill 名称、skills 文件夹路径

**执行命令：**

```bash
python skill-optimizer-yashu/scripts/analyze.py <skill-name> --folder <skills-folder>
```

**输出：** 终端显示评级和详细问题列表
