# 检测报告模板

汇总阶段1（静态结构检查）和阶段2（功能完整性分析）的所有结果，按以下模板生成 Markdown 报告。

## 报告模板

````markdown
# Skill 检测报告：{skill-name}

**检测时间**：{timestamp}
**检测器版本**：skill-checker v1.1.0
**目标 Skill**：{skill-path}

---

## 总览

| 指标     | 数值            |
| -------- | --------------- |
| 结构检查 | {通过 / 未通过} |
| 功能总数 | {n}             |
| 通过     | {pass}          |
| 警告     | {warn}          |
| 失败     | {fail}          |
| 通过率   | {pass_rate}%    |

---

## 阶段1：静态结构检查

| 检查项                   | 结果           | 说明 |
| ------------------------ | -------------- | ---- |
| SKILL.md 存在            | {通过/未通过}  |      |
| Frontmatter 合法         | {通过/未通过}  |      |
| name 字段                | {通过/未通过}  |      |
| description 字段         | {通过/未通过}  |      |
| description 含"何时使用" | {通过/未通过}  |      |
| scripts 目录             | {有文件/空/无} |      |

{structural_issues_section}

---

## 阶段2：功能完整性分析

| #   | 功能 | 触发条件 | 执行步骤 | 引用资源 | 脚本测试 | 结果 | 备注 |
| --- | ---- | -------- | -------- | -------- | -------- | ---- | ---- |

{test_results_rows}

---

## 总结与建议

{summary_and_suggestions}
````

## 模板变量说明

| 变量                       | 说明                                                         |
| -------------------------- | ------------------------------------------------------------ |
| `{skill-name}`             | 目标 skill 的名称（从 frontmatter name 字段获取）            |
| `{timestamp}`              | 检测时间，使用本地时区的可读格式                             |
| `{skill-path}`             | 目标 skill 的绝对路径                                        |
| `{structural_issues_section}` | 若存在结构问题，列出 issues 数组每项；无问题则填"无"      |
| `{test_results_rows}`      | 每个功能一行，按功能完整性分析的判定结果填写各列             |
| `{summary_and_suggestions}` | 汇总总体情况，给出针对性改进建议                           |

## 格式要求

- 报告使用纯文本标记状态（通过/警告/失败），不使用 emoji，确保跨平台兼容
- 检测器版本应与 SKILL.md frontmatter 的 `version` 字段保持一致
- 通过率计算：`pass / (pass + warn + fail) * 100`，保留一位小数
