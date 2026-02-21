---
name: skill-creator
description: 创建符合 Agent Skills 规范的新 skill。当用户需要创建 skill、初始化 skill 目录结构、生成 SKILL.md 文件、打包或验证 skill 时使用此 skill。
metadata:
  author: 牙叔教程
  version: "1.0"
---

# Skill Creator

## 何时使用此 skill

当用户需要：
- 创建一个新的 Agent Skill
- 初始化 skill 目录结构
- 生成符合规范的 SKILL.md 文件
- 了解 Agent Skills 规范要求
- 打包 skill 为 .skill 文件
- 验证 skill 是否符合规范

## 核心原则

### 简洁至上 (Concise is Key)

上下文窗口是公共资源。Skill 与系统提示词、对话历史、其他 Skill 的元数据以及用户请求共享上下文窗口。

**默认假设：AI 已经很聪明了。** 只添加 AI 没有的信息。质疑每一条信息："AI 真的需要这个解释吗？" "这段文字值得它的 token 成本吗？"

优先使用简洁的例子而非冗长的解释。

### 设置适当的自由度

根据任务的脆弱性和可变性匹配合适的详细程度：

| 自由度 | 适用场景 | 形式 |
|--------|----------|------|
| **高自由度** | 多种方法都有效、决策依赖上下文、启发式指导方法 | 基于文本的指令 |
| **中自由度** | 存在首选模式、允许一定变化、配置影响行为 | 伪代码或带参数的脚本 |
| **低自由度** | 操作脆弱且容易出错、一致性至关重要、必须遵循特定序列 | 特定脚本、少量参数 |

## Agent Skills 规范要点

### 目录结构

```
skill-name/
├── SKILL.md          # 必需：包含元数据和指令
├── scripts/          # 可选：可执行代码
├── references/       # 可选：参考文档
└── assets/           # 可选：模板、资源
```

**不应包含的文件：** README.md、INSTALLATION_GUIDE.md、CHANGELOG.md 等辅助文档。

### SKILL.md 格式

**必需的前置元数据：**
```yaml
---
name: skill-name
description: 描述此 skill 的功能和使用时机
---
```

**可选字段：** `license`、`compatibility`、`metadata`、`allowed-tools`

### name 字段规则
- 1-64 字符，只能包含小写字母、数字和连字符
- 不能以连字符开头或结尾，不能包含连续连字符 `--`
- 必须与父目录名匹配

### description 字段规则
- 1-1024 字符，**必须包含功能和使用时机/触发条件**
- **所有"何时使用"信息都应放在 description 中** - 不要放在正文

好的示例：
```yaml
description: 全面的文档创建、编辑和分析，支持修订跟踪、评论、格式保留和文本提取。当 AI 需要处理专业文档（.docx 文件）时使用：(1) 创建新文档，(2) 修改或编辑内容，(3) 处理修订跟踪，(4) 添加评论
```

## 渐进式披露设计

Skills 使用三级加载系统高效管理上下文：

1. **元数据**（name + description）- 始终在上下文中（约100词）
2. **SKILL.md 正文** - skill 触发时加载（建议 < 5000 词，< 500 行）
3. **捆绑资源** - AI 按需加载

**关键原则：** 当 skill 支持多种变体、框架或选项时，只在 SKILL.md 中保留核心工作流程和选择指导。将变体特定的细节移到单独的参考文件中。

### 渐进式披露模式

**模式 1：高级指南 + 参考**
```markdown
## 快速开始
[核心代码示例]

## 高级功能
- **表单填写**：参见 [FORMS.md](references/FORMS.md) 完整指南
- **API 参考**：参见 [REFERENCE.md](references/REFERENCE.md)
```

**模式 2：按领域组织**
```
skill-name/
├── SKILL.md (概览和导航)
└── references/
    ├── finance.md
    ├── sales.md
    └── product.md
```

**重要指南：**
- 避免深层嵌套引用，保持引用文件在 SKILL.md 的一级子目录内
- 避免重复：信息应该只在 SKILL.md 或参考文件中存在，不要两者都有

## SKILL.md 结构模式

选择最适合 skill 目的的结构：

| 模式 | 适用场景 | 结构 |
|------|----------|------|
| **基于工作流程** | 顺序流程 | `## 概览` → `## 工作流程决策树` → `## 步骤 1`... |
| **基于任务** | 工具集合 | `## 概览` → `## 快速开始` → `## 任务类别 1`... |
| **参考/指南** | 标准或规范 | `## 概览` → `## 指南` → `## 规范` |
| **基于能力** | 集成系统 | `## 概览` → `## 核心能力` → `### 1. 功能`... |

模式可以混合搭配。

## Skill 创建流程

按顺序执行以下步骤：

### 步骤 1：用具体例子理解 Skill
通过以下问题理解具体使用示例：
- "这个 skill 应该支持什么功能？"
- "你能给出一些这个 skill 如何使用的例子吗？"
- "用户会说什么来触发这个 skill？"

### 步骤 2：规划可复用的 Skill 内容
分析每个例子，识别哪些脚本、参考和资产在重复执行时会有帮助。

### 步骤 3：初始化 Skill
运行 `init_skill.py` 脚本生成模板：
```bash
python scripts/init_skill.py <skill-name> --path <output-directory>
```

### 步骤 4：编辑 Skill
从步骤 2 识别的可复用资源开始实现。

**编写指南：** 始终使用祈使/不定式形式。前置元数据只包含 `name` 和 `description`。

添加的脚本必须通过实际运行测试。删除任何不需要的示例文件和目录。

### 步骤 5：打包 Skill
开发完成后，打包为可分发的 .skill 文件：
```bash
python scripts/package_skill.py <path/to/skill-folder> [output-directory]
```

打包脚本会先验证 skill，如果验证失败会报告错误并退出。

### 步骤 6：迭代
测试 skill 后，根据使用反馈改进 SKILL.md 或捆绑资源。

## 工作流程模式

详细的工作流程模式参见 [references/workflows.md](references/workflows.md)。

### 顺序工作流程
对于复杂任务，将操作分解为清晰的顺序步骤：
```markdown
1. 分析表单（运行 analyze_form.py）
2. 创建字段映射（编辑 fields.json）
3. 验证映射（运行 validate_fields.py）
4. 填写表单（运行 fill_form.py）
```

### 条件工作流程
对于有分支逻辑的任务：
```markdown
1. 确定修改类型：
   **创建新内容？** → 遵循"创建工作流程"
   **编辑现有内容？** → 遵循"编辑工作流程"
```

## 输出模式

详细的输出模式参见 [references/output-patterns.md](references/output-patterns.md)。

### 模板模式
为输出格式提供模板：
```markdown
## 报告结构
始终使用此确切模板结构：
# [分析标题]
## 执行摘要
[关键发现]
## 建议
1. [建议1]
```

### 示例模式
对于输出质量依赖示例的 skill，提供输入/输出对。

## 捆绑资源

### scripts/
可执行代码（Python/Bash/等）用于需要确定性可靠性或重复重写的任务。
- **何时包含**：相同的代码被重复重写或需要确定性可靠性时
- **好处**：Token 高效、确定性、可以在不加载到上下文的情况下执行

### references/
文档和参考材料，旨在根据需要加载到上下文中。
- **何时包含**：AI 工作时应该参考的详细文档
- **好处**：保持 SKILL.md 精简，只在需要时加载
- **最佳实践**：如果文件很大（>10k 词），在 SKILL.md 中包含 grep 搜索模式

### assets/
不打算加载到上下文中，而是在 AI 产生的输出中使用的文件。
- **何时包含**：skill 需要在最终输出中使用的文件（模板、图片等）
- **好处**：将输出资源与文档分离

## 实用脚本

| 脚本 | 用途 | 命令 |
|------|------|------|
| init_skill.py | 初始化新 skill | `python scripts/init_skill.py <skill-name> --path <output-dir>` |
| package_skill.py | 打包 skill | `python scripts/package_skill.py <skill-folder> [output-dir]` |
| quick_validate.py | 快速验证 | `python scripts/quick_validate.py <skill-directory>` |

## 创建示例

**用户需求：** "创建一个处理 PDF 的 skill"

**执行步骤：**

1. **理解需求**：询问具体使用场景（提取文本、填写表单、合并等）

2. **规划内容**：确定需要哪些脚本和参考文档

3. **初始化**：
```bash
python scripts/init_skill.py pdf-processor --path ./skills
```

4. **编辑 SKILL.md**：填写模板中的 TODO 项，添加具体指令

5. **打包**：
```bash
python scripts/package_skill.py ./skills/pdf-processor
```
