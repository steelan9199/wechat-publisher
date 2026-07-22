# check.js 脚本说明

check.js 是 skill-tester 的静态结构检查脚本，负责校验目标 skill 的文件结构与 frontmatter 合法性。

**功能清单不由本脚本解析**，由主 AI 在阶段 0 读取 `$TARGET_SKILL_DIR/SKILL.md` 后自行分析（详见 [SKILL.md 阶段0小节](../SKILL.md)）。

## 用法

```powershell
cd "$SKILL_DIR/scripts"; node check.js "$TARGET_SKILL_DIR"
```

- 执行前必须先 `cd` 到 `$SKILL_DIR/scripts` 目录
- `$TARGET_SKILL_DIR` 若包含空格，外层引号已做保护

## 参数

| 参数                | 必填 | 说明                                      |
| ------------------- | ---- | ----------------------------------------- |
| `$TARGET_SKILL_DIR` | 是   | 被检测 skill 的目录路径（绝对或相对路径） |

## 输出

脚本将 JSON 格式的检测结果输出到 stderr（AI 可见），退出码 0 表示正常执行，1 表示参数缺失。

### JSON 输出结构

```json
{
  "valid": true,
  "issues": [],
  "meta": {
    "name": "skill-name",
    "description": "...",
    "hasScripts": false,
    "hasReferences": false,
    "hasDeps": false
  },
  "checks": {
    "skillMdExists": true,
    "frontmatterValid": true,
    "nameField": true,
    "descField": true,
    "descHasActivation": true,
    "descHasKeywords": true,
    "scriptsDir": "none",
    "depsInstalled": false
  },
  "path": "/absolute/path/to/skill",
  "timestamp": "2026-07-03T00:00:00.000Z"
}
```

### 字段说明

| 字段                | 类型     | 说明                                                |
| ------------------- | -------- | --------------------------------------------------- |
| `valid`             | boolean  | 结构是否合法（issues 为空则 true）                  |
| `issues`            | string[] | 问题列表                                            |
| `meta`              | object   | skill 元数据摘要（name、description、目录状态标志） |
| `checks`            | object   | 各项检查的详细结果                                  |
| `checks.scriptsDir` | string   | scripts 目录状态：`none` / `empty` / `hasFiles`     |
| `path`              | string   | 目标 skill 的绝对路径                               |
| `timestamp`         | string   | 检测时间（ISO 8601）                                |

> **注意**：早期版本曾输出 `features` 数组，现已移除。功能清单请参考主 AI 在阶段 0 的分析结果。

## description 检查规则

check.js 对 description 字段做**静态机械检查**（正则匹配），规则依据 [skill-description-optimizer-yashu](../../skill-description-optimizer-yashu/SKILL.md)。语义级质量评估（如关键词是否动作导向、是否含价值宣传）由主 AI 在阶段 0 分析时完成，不在本脚本范围内。

### 检查项

| 检查字段            | 检查内容                                         | 判定方式                                 |
| ------------------- | ------------------------------------------------ | ---------------------------------------- |
| `descField`         | description 字段存在且非空                       | frontmatter 解析后字段存在且 trim 后非空 |
| `descHasActivation` | description 包含"激活条件"声明（结构性引导文本） | 正则 `/激活条件\s*[：:]/` 命中           |
| `descHasKeywords`   | description 包含关键词清单（反引号包裹，>=3 个） | 正则匹配反引号片段，命中数 >= 3          |

### 推荐的 description 结构

依据 skill-description-optimizer-yashu，description 推荐结构顺序为：**功能概述 -> 激活条件声明 -> 关键词清单**。

```
{功能概述一句话}。激活条件：用户消息须包含以下关键词之一:`X`、`Y`、`Z`。
```

示例（来自 skill-description-optimizer-yashu）：

```
本技能专门优化技能的 description 元属性。激活条件：用户消息须包含以下关键词之一:`优化 description`、`优化技能描述`、`重写 description`、`改 description`、`诊断 description 问题`、`修复技能不激活`。
```

### 常见失败原因

| 失败场景                                           | 触发的 issue                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| description 缺失或为空                             | `SKILL.md frontmatter 缺少 description 字段`                                                      |
| description 未声明激活条件（如旧版"何时使用"写法） | `description 未包含"激活条件"声明（推荐句式：激活条件：用户消息须包含以下关键词之一:`X`、`Y`。）` |
| description 关键词不足 3 个或无反引号包裹          | `description 关键词清单不足：找到 N 个反引号关键词，推荐 3-6 个动作导向短语`                      |

> **注意**：旧版本检查 description 是否包含"何时使用"字样，该规则已废弃。当前规则检查"激活条件"声明，与 skill-description-optimizer-yashu 的推荐句式对齐。

## frontmatter 解析说明

parseFrontmatter 只解析一级 YAML 字段（`key: value` 形式），**不支持嵌套结构**（如 `metadata` 下的 `author`/`version` 等子字段会被跳过）。这是设计决策：检测只需 `name` 和 `description` 两个顶层字段，无需完整 YAML 解析器。
