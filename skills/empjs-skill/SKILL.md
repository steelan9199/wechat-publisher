---
name: empjs-skill
description: |
  通过自然语言调用 @empjs/skill CLI 工具来管理 AI Agent 技能。
  当用户需要：
  1. 安装/添加技能包（install/add）
  2. 列出已安装技能（list/ls）
  3. 删除/卸载技能（remove/rm/uninstall）
  4. 查看支持的 AI Agent 平台（agents/list-agents）
  5. 使用 eskill 命令管理技能时
  使用此 skill。
---

# @empjs/skill 自然语言调用

## 概述

将用户的自然语言请求转换为 `eskill` CLI 命令并执行。

`@empjs/skill` 是一个企业级 AI Agent 技能分发中心，支持跨 18+ 平台管理、分发并追踪技能链路。
官网链接: https://skill.empjs.dev/#usage

## 核心命令映射

### 1. 安装技能

**用户意图关键词**: 安装、添加、引入、使用某个技能

**对应命令**:
```bash
eskill install <skill>
eskill add <skill>
```

**参数说明**:
- `-a, --agent <name>`: 指定特定 Agent（如 claude、cursor、windsurf 等）
- `-l, --link`: 使用链接模式（本地开发时使用）
- `-f, --force`: 强制安装

**示例转换**:
- "安装 wechat-publisher 技能" → `eskill install wechat-publisher`
- "从 GitHub 安装技能" → `eskill install https://github.com/...`
- "给 Cursor 安装技能" → `eskill install <skill> -a cursor`

### 2. 列出技能

**用户意图关键词**: 列出、查看、显示所有技能、已安装的技能

**对应命令**:
```bash
eskill list
eskill ls
```

### 3. 删除技能

**用户意图关键词**: 删除、移除、卸载某个技能

**对应命令**:
```bash
eskill remove <skill>
eskill rm <skill>
eskill uninstall <skill>
```

### 4. 查看支持的 Agent 平台

**用户意图关键词**: 支持哪些 Agent、平台列表、agents

**对应命令**:
```bash
eskill agents
eskill list-agents
```

## 工作流程

1. **解析用户意图**: 识别用户想要执行的操作类型（安装/列出/删除/查看）
2. **提取关键信息**: 技能名称、Agent 名称、特殊选项等
3. **构建命令**: 根据提取的信息构建完整的 `eskill` 命令
4. **执行命令**: 使用 Bash 工具执行命令
5. **返回结果**: 将命令输出返回给用户

## 支持的 AI Agent 平台

- AMP、Antigravity、Claude Code、ClawdBot、Cline、Codex、Cursor、Droid
- Gemini、GitHub Copilot、Goose、Kilo、Kiro CLI、OpenCode、Roo、Trae
- Windsurf、Qoder、Continue 等

## 示例用法

| 自然语言请求 | 执行的命令 |
|------------|-----------|
| "帮我安装 wechat-publisher 技能" | `eskill install wechat-publisher` |
| "列出所有已安装的技能" | `eskill list` |
| "删除 skill-creator" | `eskill remove skill-creator` |
| "查看支持哪些 Agent" | `eskill agents` |
| "给 Cursor 安装这个技能" | `eskill install <skill> -a cursor` |
| "用链接模式安装本地技能" | `eskill install ./my-skill -l` |

## 注意事项

- 技能名称可以是 NPM 包名、Git URL 或本地路径
- 安装前建议先执行 `eskill list` 查看是否已存在同名技能
- 使用 `-f, --force` 参数可以强制重新安装已有技能
