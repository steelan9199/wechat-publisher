# check.js 脚本说明

check.js 是 skill-checker 的静态结构检查脚本，负责校验目标 skill 的文件结构与 frontmatter 合法性，并解析功能列表。

## 用法

```powershell
cd "$CHECKER_DIR/scripts"; node check.js "$TARGET_DIR"
```

- 执行前必须先 `cd` 到 `$CHECKER_DIR/scripts` 目录
- `$TARGET_DIR` 若包含空格，外层引号已做保护

## 参数

| 参数         | 必填 | 说明                                     |
| ------------ | ---- | ---------------------------------------- |
| `$TARGET_DIR` | 是   | 被检测 skill 的目录路径（绝对或相对路径）|

## 输出

脚本将 JSON 格式的检测结果输出到 stderr（AI 可见），退出码 0 表示正常执行，1 表示参数缺失。

### JSON 输出结构

```json
{
  "valid": true,
  "issues": [],
  "features": ["功能1", "功能2"],
  "meta": {
    "name": "skill-name",
    "description": "...",
    "hasScripts": false,
    "hasReferences": false,
    "hasDeps": false,
    "hasTests": false
  },
  "checks": {
    "skillMdExists": true,
    "frontmatterValid": true,
    "nameField": true,
    "descField": true,
    "descHasTrigger": true,
    "scriptsDir": "none",
    "depsInstalled": false,
    "hasTestCmd": false
  },
  "path": "/absolute/path/to/skill",
  "timestamp": "2026-07-03T00:00:00.000Z"
}
```

### 字段说明

| 字段                 | 类型     | 说明                                                   |
| -------------------- | -------- | ------------------------------------------------------ |
| `valid`              | boolean  | 结构是否合法（issues 为空则 true）                     |
| `issues`             | string[] | 问题列表                                               |
| `features`           | string[] | 从 SKILL.md 解析出的功能列表                           |
| `meta`               | object   | skill 元数据摘要（name、description、目录状态标志）    |
| `checks`             | object   | 各项检查的详细结果                                     |
| `checks.scriptsDir`  | string   | scripts 目录状态：`none` / `empty` / `hasFiles`        |
| `path`               | string   | 目标 skill 的绝对路径                                  |
| `timestamp`          | string   | 检测时间（ISO 8601）                                   |

## 功能列表解析逻辑

parseFeatures 按以下优先级提取功能，前一模式有结果则不再触发后续模式：

1. **模式1**：从正文"当用户说/需要/遇到/想要/要求/输入/请求/问..."句式提取
2. **模式2**（模式1无结果时）：从 description 的"何时使用"中提取，按顿号/逗号/分号拆分
3. **模式3**（模式1+2均无结果时）：从 h2/h3 标题降级提取（排除"环境说明"、"执行步骤"等通用标题）

每个功能条目经过标准化清洗：去引号、去尾部标点、去"当用户"/"时"前后缀、按分隔符拆分、大小写不敏感去重。

## frontmatter 解析说明

parseFrontmatter 只解析一级 YAML 字段（`key: value` 形式），**不支持嵌套结构**（如 `metadata` 下的 `author`/`version` 等子字段会被跳过）。这是设计决策：检测只需 `name` 和 `description` 两个顶层字段，无需完整 YAML 解析器。
