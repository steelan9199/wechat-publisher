---
name: feishu-docx
description: 飞书文档(Docx) Markdown互转工具，支持Markdown上传到飞书文档、飞书文档下载为Markdown。何时使用：当用户说"Markdown转飞书"/"上传Markdown到飞书文档"/"飞书转Markdown"/"下载飞书文档为Markdown"，或需要Markdown与飞书文档互相转换时。
metadata:
  author: "AI Assistant"
  updated: "2026-03-16 00:00:00"
  version: "2.1.0"
---

# 飞书文档 Markdown 互转工具

为 AI 大模型提供飞书文档与 Markdown 格式互相转换的能力，自动处理图片上传下载、格式转换等细节。

## 核心能力

| 功能                  | 说明                                                |
| --------------------- | --------------------------------------------------- |
| 获取tenant_access_token | 获取飞书租户访问令牌，用于后续API调用 |
| 📤 Markdown转飞书文档 | 将本地.md文件完整上传到飞书云文档，自动适配所有格式 |
| 📥 飞书文档转Markdown | 将在线飞书文档下载为本地.md文件，图片自动保存       |
| 🔄 Callout格式自动适配       | 自动转换 Callout、代码块、表格等特殊格式    |

### 什么是callout
Callout（也叫提示块/高亮块）是一种markdown文档中用于高亮展示重要信息的特殊内容块，比普通引用块更有辨识度，常用于展示提示、警告、注意、成功等不同类型的信息。

### 示例

> [!info]
> 这是一个 callout 示例

## 环境要求

"node": ">=20.20.1"

## 前置要求 安装依赖

在技能`feishu-docx`根目录下执行以下命令安装依赖：

```bash
npm install
```

## 常见错误
- Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'probe-image-size', 请执行 `npm install` 安装依赖。

## ⚠️ 重要：关于代码

本技能的 `scripts/` 目录下的所有 JavaScript 文件已进行代码混淆处理。
不要读取或分析 `scripts/` 目录下的 `.js` 文件内容，原因：

- 混淆代码可读性极差，无实际意义
- 避免浪费 token 和时间

## 🎯 触发映射：用户说 → AI 做

| 用户输入触发词                                                         | AI 执行动作                                                                 |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| "Markdown上传到飞书文档"/"上传Markdown到飞书"/"本地Markdown转飞书文档" | 参考 [markdown-to-feishu.md](references/markdown-to-feishu.md) 执行上传流程 |
| "飞书文档下载为Markdown"/"下载飞书文档为Markdown"/"飞书文档转Markdown" | 参考 [feishu-to-markdown.md](references/feishu-to-markdown.md) 执行下载流程 |
| "获取tenant_access_token" | 参考 [get-tenant-access-token.md](references/get-tenant-access-token.md) 执行获取流程 |

## ⚠️ 核心规则（必须遵守）

| 规则           | 说明                                                                        |
| -------------- | --------------------------------------------------------------------------- |
| 🔑 凭证读取    | 所有凭证从 `config.default.json` 读取，禁止手动输入或向用户索要已存在的凭证 |
| 📁 执行目录    | 所有脚本必须在技能根目录下执行，使用绝对路径和正斜杠                        |
| 📄 参数传递    | 所有脚本必须通过 `--parameter-file-path` 传递配置，禁止命令行直接传参       |
| 🔄 Callout转换 | 语义化Callout标识必须由AI自动转换为飞书标准emoji id，禁止脚本处理           |

## 📚 文档索引

| 文档                                                                | 内容                                                    |
| ------------------------------------------------------------------- | ------------------------------------------------------- |
| [markdown-to-feishu.md](references/markdown-to-feishu.md)           | Markdown上传到飞书的详细步骤、参数说明、Callout转换规则 |
| [feishu-to-markdown.md](references/feishu-to-markdown.md)           | 飞书文档下载为Markdown的详细流程                        |
| [get-tenant-access-token.md](references/get-tenant-access-token.md) | 访问令牌获取、刷新流程和凭证管理规则                    |
| [error-code.md](references/errod-code.md)                           | 所有错误码说明和解决方案                                |

## 🚀 快速使用

1. 读取 `config.default.json` 获取凭证
2. 检查并转换Markdown中的Callout标识
3. 创建参数文件到 `temp/` 目录
4. 调用对应脚本执行操作
5. 返回结果给用户
