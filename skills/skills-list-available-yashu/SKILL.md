---
name: skills-list-available-yashu
description: "获取系统提供的可用技能列表（available_skills）。何时使用：当用户说`有哪些技能`、`列出技能`、`查看可用技能`时使用。"
---

# list-available-skills

获取系统提供的可用技能列表

## 功能说明

直接返回系统提供的可用技能列表（available_skills）。该列表来自系统后台，包含当前可调用的所有技能。

## 使用方式

用户直接调用此技能即可获取完整的可用技能列表。

## 返回格式

技能将直接输出系统提供的 available_skills 列表，包括：

- 官方内置技能（如 TRAE-code-review、TRAE-debugger 等）
- 自定义技能（如 feishu-bitable、coze-caller-yashu 等）

## 注意事项

1. 此技能不做任何过滤或处理，直接返回系统提供的原始列表
2. 列表内容由系统后台决定，可能随版本更新而变化
3. 此技能不访问文件系统，仅返回预定义的技能列表

## 本技能调用失败的解决方案

如果直接调用 list-available-skills 失败了，提示没有这个技能。
但是错误信息中显示了可用的技能列表。就把这个列表呈现给用户。
