# 检查规范

本文档详细说明 skill-optimizer-yashu 的各项检查标准。

## 1. Frontmatter 格式

### 必需字段

| 检查项      | 必需 | 说明                            |
| ----------- | ---- | ------------------------------- |
| name        | 是   | 小写字母/数字/连字符，1-64 字符 |
| description | 是   | 1-1024 字符，详见下方格式要求   |
| metadata    | 否   | 作者、更新时间、版本等信息      |

### description 格式要求

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

### metadata 字段规范

| 字段    | 格式要求                                | 示例                             |
| ------- | --------------------------------------- | -------------------------------- |
| author  | 字符串                                  | `author: "牙叔教程"`             |
| updated | **YYYY-MM-DD HH:MM:SS**（必须精确到秒） | `updated: "2026-02-24 14:30:00"` |
| version | 语义化版本号                            | `version: "1.0.0"`               |

## 2. 渐进式披露结构

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

## 3. 文件引用完整性

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

## 4. 文档 AI 友好性

检查 SKILL.md 主文档和 references/ 目录下的引用文档是否对 AI 友好：

**检查范围：**

- **主文档** (SKILL.md)：严格要求，权重 70%
- **引用文档** (references/*.md)：适当放宽，权重 30%

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

## 5. 使用说明完整性

检查 SKILL.md 是否包含"如何使用这个 skill"的内容：

| 检查项       | 说明                                          |
| ------------ | --------------------------------------------- |
| 使用说明章节 | 是否包含 `## 如何使用这个 Skill` 或类似的章节 |
| 内容完整性   | 使用说明是否足够详细（建议至少 5 行以上内容） |
| 示例说明     | 是否包含具体的使用示例                        |

## 6. Token 效率

- 使用表格组织信息（如用户输入对照表）
- 使用列表代替长段落
- 避免重复内容

## 7. 临时文件管理（可选）

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

function createTempParamsFile(params, operation) {
  const tempDir = os.tmpdir();
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const fileName = `skill-name-${operation}-${timestamp}-${random}.json`;
  const filePath = path.join(tempDir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(params, null, 2));
  return filePath;
}

function cleanupTempFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {
    // 忽略删除失败
  }
}
```

```python
# Python 示例
import tempfile
import os

with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
    json.dump(params, f)
    temp_path = f.name

try:
    execute_script(temp_path)
finally:
    if os.path.exists(temp_path):
        os.unlink(temp_path)
```

**临时文件存放位置：**

- Windows: `%TEMP%` (如 `C:\Users\xxx\AppData\Local\Temp\`)
- Linux/Mac: `/tmp/`

**命名规范：**

- 格式：`{skill-name}-{operation}-{timestamp}-{random}.{ext}`
- 示例：`skill-name-operation-1740374400000-a7x9k2.json`
