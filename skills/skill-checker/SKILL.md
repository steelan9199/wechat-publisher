---
name: skill-checker
description: 自动检测用户指定的 Skill 的功能完整性。何时使用：当用户说"检测skill"、"检查skill"、"skill测试"、"验证skill"、"skill报告"时使用。全自动扫描目标 skill 目录，执行静态结构校验 + 功能完整性分析，生成 Markdown 检测报告。
metadata:
  author: "Trae AI"
  updated: "2026-07-03 15:00:00"
  version: "1.1.0"
---

# Skill Checker — Skill 自动检测器

## 功能概述

对任意 Skill 进行两阶段全自动检测：

1. **静态结构检查** — 运行 `$CHECKER_DIR/scripts/check.js` 校验目标 skill 的文件结构、格式合法性
2. **功能完整性分析** — 对 SKILL.md 中声明的每个功能，静态分析其触发条件的清晰度、执行步骤的完整性、以及所引用资源的存在性

最终输出一份 Markdown 报告到目标 skill 目录。

## 环境说明

| 变量           | 含义                              |
| -------------- | --------------------------------- |
| `$CHECKER_DIR` | 本 skill（skill-checker）所在目录 |
| `$TARGET_DIR`  | 用户指定的被检测 skill 目录       |

- Shell 类型：跨平台通用（PowerShell / bash / zsh），命令分隔符统一使用 `;`（不使用 `&&` 或 `&`）
- 静态结构检查脚本：`$CHECKER_DIR/scripts/check.js`
- 默认 skills 根目录：因 Trae 版本和操作系统而异，常见路径如 `.trae/skills/`、`.trae-cn/skills/` 等，根据当前环境实际路径拼接
- 脚本输入输出详情参考 `$CHECKER_DIR/references/check-script.md`

## 工作流程

| 步骤  | 执行动作                                                                           |
| ----- | ---------------------------------------------------------------------------------- |
| 步骤1 | 确认 `$TARGET_DIR`                                                                 |
| 步骤2 | 运行静态结构检查脚本                                                               |
| 步骤3 | 解析检查脚本输出的功能列表，读取目标 SKILL.md                                      |
| 步骤4 | 对每个功能逐一执行完整性分析（参考 `$CHECKER_DIR/references/feature-analysis.md`） |
| 步骤5 | 汇总结果，生成 Markdown 报告（参考 `$CHECKER_DIR/references/report-template.md`）  |
| 步骤6 | 将报告写入 `$TARGET_DIR`                                                           |

## 步骤1：确认目标 skill 目录

若用户未明确指定要检测的 skill，询问用户目标 skill 的路径。路径可以是：

- skill 名（自动拼接为 `{默认 skills 根目录}/{name}`）
- 绝对路径

确认 `$TARGET_DIR` 存在且包含 `SKILL.md` 文件，否则按错误处理表中的规则处理。

## 步骤2：运行静态结构检查

执行以下命令：

```powershell
cd "$CHECKER_DIR/scripts"; node check.js "$TARGET_DIR"
```

脚本输出 JSON 格式的检测结果到 stderr，包含 `valid`、`issues`、`features`、`meta`、`checks` 等字段。

若脚本执行失败（命令报错、返回非 JSON），按错误处理表处理。

> 脚本输入参数、输出字段、功能解析逻辑的详细说明参考 `$CHECKER_DIR/references/check-script.md`。

## 步骤3：解析功能列表

从脚本输出的 `features` 数组中获取目标 skill 声明的所有功能。同时完整读取 `$TARGET_DIR/SKILL.md` 的正文内容，用于步骤4的逐功能分析。

若 `features` 数组为空，跳过步骤4，在报告中标注"无可分析功能"。

## 步骤4：功能完整性分析

对 `features` 中的每个功能，读取目标 SKILL.md 正文中该功能对应的描述段落，按四个维度进行静态分析：触发条件清晰度、执行步骤完整性、引用资源存在性、脚本可执行性。

> 分析维度、判定标准、重要规则的详细说明参考 `$CHECKER_DIR/references/feature-analysis.md`。

## 步骤5：生成报告

汇总阶段1和阶段2的所有结果，生成 Markdown 报告。

> 报告模板的完整格式参考 `$CHECKER_DIR/references/report-template.md`。

## 步骤6：写入报告

将生成的报告写入 `$TARGET_DIR`，文件名为 `{skill-name}-test-report.md`。如果同名文件已存在则直接覆盖。

写入后告知用户报告完整路径。

## 错误处理

| 场景                                   | 处理方式                                            |
| -------------------------------------- | --------------------------------------------------- |
| `$TARGET_DIR` 不存在                   | 提示用户路径无效，要求重新输入                      |
| `$TARGET_DIR` 无 SKILL.md              | 提示该目录不是有效的 skill，终止检测                |
| `$CHECKER_DIR/scripts/check.js` 不存在 | 提示 skill-checker 自身安装不完整，请重新安装       |
| `check.js` 执行失败（非零退出码）      | 检查 Node.js 是否可用（`node --version`），报告错误 |
| `check.js` 返回内容不是合法 JSON       | 输出原始 stderr 到报告，标注脚本异常                |
| 功能列表为空                           | 跳过阶段2，报告中标注"无可分析功能"                 |
| 目标 skill 的 npm 依赖未安装           | 报告建议运行 `npm install`，如有 test 命令则先安装  |
| 所有功能均分析失败                     | 报告中注明，建议检查 skill 基础配置                 |

## 使用示例

```
用户：检测 format-json 这个 skill
AI：
  1. $TARGET_DIR = {默认 skills 根目录}/format-json
  2. 运行 check.js → 获取结构检查结果 + 功能列表
  3. 读取 format-json/SKILL.md 正文，对每个功能做完整性分析
  4. （如有 scripts/package.json 且声明了 test）执行 npm test
  5. 汇总生成报告 → format-json-test-report.md
```
