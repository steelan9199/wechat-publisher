---
name: feishu-docx-yashu
description: 飞书文档(Docx) Markdown互转工具，支持Markdown上传到飞书文档、飞书文档下载为Markdown、飞书云文档链接解析为document_id。激活条件：用户消息必须包含以下关键词之一:`Markdown转飞书`、`上传Markdown到飞书文档`、`下载飞书文档为Markdown`、`解析飞书文档链接`、`获取document_id`。
metadata:
  author: "AI Assistant"
  updated: "2026-07-06 00:00:00"
  version: "1.0.0"
---

# 飞书文档 Markdown 互转工具

## 功能概述

为 AI 大模型提供飞书文档与 Markdown 格式互相转换的能力，自动处理图片上传下载、格式转换等细节。支持文本、标题、列表、表格、图片、代码块、引用、Callout 等常见 Markdown 元素的转换。上传 Markdown 到飞书文档前，自动检查并修正 Callout 格式。同时支持从飞书云文档链接（云盘 docx 链接或知识库 wiki 链接）解析出 document_id。

## 环境说明

| 项目         | 说明                                                           |
| ------------ | -------------------------------------------------------------- |
| `$SKILL_DIR` | 当前 Skill 所在的绝对目录，即 SKILL.md 文件所在的文件夹        |
| Shell 类型   | PowerShell 5 / bash / zsh                                      |
| 脚本目录     | `$SKILL_DIR/scripts`                                           |
| 临时文件目录 | `$SKILL_DIR/temp`                                              |
| Node.js 版本 | `>=18.20.8`                                                    |
| 依赖安装     | 运行 `cd $SKILL_DIR/scripts; if ($?) { npm install }` 安装依赖 |

> **⚠️ `$SKILL_DIR` 仅为文档占位符，不是环境变量**，执行命令时必须替换为实际绝对路径。在 PowerShell 中直接写 `$SKILL_DIR` 会被当作未定义变量解析为空字符串，导致 `cd $SKILL_DIR/scripts` 变成 `cd /scripts` 而报错"找不到路径"。

本 Skill 运行命令时采用**条件执行**（前一条成功才执行下一条），跨平台规则如下：

- **bash/zsh**（Linux/macOS）：`cmd1 && cmd2`
- **PowerShell 5**（Windows）：`cmd1; if ($?) { cmd2 }`
- **禁止单 `&`**：在 bash 中 `&` 表示后台执行，语义完全不同

### ⚠️ 脚本已混淆，禁止读取源码

`$SKILL_DIR/scripts/` 目录下的所有 JavaScript 文件已进行代码混淆处理，**禁止读取或分析 `.js` 文件内容**。混淆代码可读性极差，读取纯属浪费 token 和时间。

如需了解脚本功能和用法，请查阅下方「脚本清单」和 `$SKILL_DIR/references/` 目录下的接口文档。

## 全局前置条件

| 前置条件    | 说明                                                                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 🔑 凭证文件 | 默认从 `$SKILL_DIR/config.default.json` 读取凭证，直接使用，禁止向用户索要（避免工作暂停）。仅当用户主动提供新凭证时，使用用户提供的凭证 |
| 📦 依赖安装 | 首次使用前运行 `cd $SKILL_DIR/scripts; if ($?) { npm install }` 安装依赖                                                                 |

## 全业务脚本索引清单

| 脚本                         | 功能                                    |
| ---------------------------- | --------------------------------------- |
| `markdown-to-feishu.js`      | 将本地 Markdown 文件上传到飞书云文档    |
| `feishu-to-markdown.js`      | 将飞书文档下载为本地 Markdown 文件      |
| `url-to-document-id.js`      | 从飞书云文档链接解析出 document_id      |
| `get-tenant-access-token.js` | 获取飞书租户访问令牌                    |
| `clear_temp.js`              | 清理 `$SKILL_DIR/temp` 目录下的临时文件 |

## 跨功能公共规则（必须遵守）

| 规则                | 说明                                                                                                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 📁 执行目录         | 执行任何脚本前**必须先 `cd` 到 `$SKILL_DIR/scripts` 目录**，再运行命令。禁止在不切换目录的情况下直接通过绝对路径调用脚本                                                                                                                               |
| 📄 参数传递         | 所有需要配置参数的脚本必须通过 `--parameter-file-path` 传递配置，禁止命令行直接传参                                                                                                                                                                    |
| 📄 参数文件路径     | `--parameter-file-path` 的值必须使用绝对路径和正斜杠 `/`                                                                                                                                                                                               |
| 🗑️ 临时文件存放     | 临时参数文件统一存放在 `$SKILL_DIR/temp` 目录中，不得与脚本文件混杂存放                                                                                                                                                                                |
| 🧹 临时文件清理     | 调用脚本后**必须清理** `$SKILL_DIR/temp` 目录，运行 `cd $SKILL_DIR/scripts; if ($?) { node clear_temp.js }` 完成清理。禁止使用终端命令（如 `rm`、`del`、`Remove-Item`）直接清理                                                                        |
| 📖 脚本文档强制读取 | 执行任何脚本前**必须先读取对应的参考文档**，严格按照文档中的参数格式操作，禁止凭记忆或直觉编写参数                                                                                                                                                     |
| ✍️ 参数文件写入     | 创建参数文件**必须使用 Write 工具**写入 `$SKILL_DIR/temp/` 目录，**禁止使用任何 PowerShell 文件写入命令**（`Set-Content`、`Out-File`、`>` 重定向、`[System.IO.File]::WriteAllText()` 等）。PowerShell 默认会在文件中添加 UTF-8 BOM，导致 JSON 解析失败 |

## 触发映射：用户说 → AI 做

| 用户输入触发词                                                         | AI 执行动作                                                                                 |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| "Markdown上传到飞书文档"/"上传Markdown到飞书"/"本地Markdown转飞书文档" | 先读取 [Markdown转飞书指南]($SKILL_DIR/references/markdown-to-feishu.md)，再执行上传流程    |
| "飞书文档下载为Markdown"/"下载飞书文档为Markdown"/"飞书文档转Markdown" | 先读取 [飞书转Markdown指南]($SKILL_DIR/references/feishu-to-markdown.md)，再执行下载流程    |
| "解析飞书文档链接"/"获取document_id"/"从链接提取文档ID"                | 先读取 [链接解析指南]($SKILL_DIR/references/url-to-document-id.md)，再执行解析流程          |
| "获取tenant_access_token"/"刷新令牌"                                   | 先读取 [访问令牌获取指南]($SKILL_DIR/references/get-tenant-access-token.md)，再执行获取流程 |

## 文档索引

| 文档                                                                 | 内容                                                                    |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [Markdown转飞书指南]($SKILL_DIR/references/markdown-to-feishu.md)    | Markdown 上传到飞书的详细步骤、参数说明、Callout 格式检查与自动修正规则 |
| [飞书转Markdown指南]($SKILL_DIR/references/feishu-to-markdown.md)    | 飞书文档下载为 Markdown 的详细流程                                      |
| [链接解析指南]($SKILL_DIR/references/url-to-document-id.md)          | 飞书云文档链接解析为 document_id 的详细流程                             |
| [访问令牌获取指南]($SKILL_DIR/references/get-tenant-access-token.md) | 访问令牌获取、刷新流程和凭证管理规则                                    |
| [错误码说明]($SKILL_DIR/references/error-code.md)                    | 所有错误码说明和解决方案                                                |

## 公共能力：获取访问令牌

所有飞书 API 调用都需要 `tenant_access_token`。获取方式参考 [访问令牌获取指南]($SKILL_DIR/references/get-tenant-access-token.md)。

令牌过期（错误码 99991663）时，运行 `cd $SKILL_DIR/scripts; if ($?) { node get-tenant-access-token.js --parameter-file-path <参数文件绝对路径> }` 刷新令牌，更新参数文件后重试。

## 全局错误处理

| 错误场景                                             | 处理方式                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------- |
| 依赖缺失（`Cannot find package 'probe-image-size'`） | 运行 `cd $SKILL_DIR/scripts; if ($?) { npm install }` 安装依赖      |
| 访问令牌过期（错误码 99991663）                      | 自动刷新令牌，更新参数文件后重试                                    |
| 其他错误码                                           | 查阅 [错误码说明]($SKILL_DIR/references/error-code.md) 匹配解决方案 |

## 标准执行流程

| 步骤 | 执行动作             | 命令/操作                                                                                      |
| ---- | -------------------- | ---------------------------------------------------------------------------------------------- |
| 1    | 读取凭证文件         | 读取 `$SKILL_DIR/config.default.json` 获取 `appId`、`appSecret`、`tenant_access_token`         |
| 2    | 读取参考文档（强制） | 读取对应功能的 `$SKILL_DIR/references/*.md`，严格按照参数格式操作                              |
| 3    | 创建参数文件         | 按参考文档要求，将 JSON 参数文件写入 `$SKILL_DIR/temp/` 目录                                   |
| 4    | 执行脚本             | `cd $SKILL_DIR/scripts; if ($?) { node <脚本名>.js --parameter-file-path <参数文件绝对路径> }` |
| 5    | 处理结果             | 成功：返回结果数据给用户；失败：根据错误码匹配解决方案并重试                                   |
| 6    | 清理临时文件         | `cd $SKILL_DIR/scripts; if ($?) { node clear_temp.js }`                                        |
