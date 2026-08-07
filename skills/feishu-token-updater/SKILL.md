---
name: feishu-token-updater
description: 更新飞书技能 feishu-docx-yashu 的 tenant_access_token 字段。激活条件：用户消息包含「更新/设置飞书 token」。
metadata:
  author: "AI Assistant"
  updated: "2026-08-07 10:01:00"
  version: "2.3.1"
---

# 飞书 tenant_access_token 更新器

## 用途

只做一件事：把用户**剪贴板**里的飞书访问令牌（`tenant_access_token`）写入配置文件：

`C:\Users\Administrator\.skills-manager\skills\feishu-docx-yashu\config.default.json`

- 只改 `tenant_access_token` 的**值**，键名永远不动。
- 不碰 `appId`、`appSecret`、`member_id`、`custom` 等其它任何字段。

## 环境说明

| 项目 | 说明 |
| --- | --- |
| `$SKILL_DIR` | 当前 Skill 所在的绝对目录，即 SKILL.md 文件所在的文件夹 |
| 常驻脚本 | `$SKILL_DIR/update.js`（JWT 校验 + 配置写入） |
| 临时文件 | `$SKILL_DIR/_tmp_token.txt`（剪贴板内容中转，用后即删） |
| Node.js 版本 | `>=18` |

> **⚠️ `$SKILL_DIR` 仅为文档占位符，不是环境变量**，执行命令时必须替换为技能目录的实际绝对路径。PowerShell 命令中若不替换，`$SKILL_DIR` 会被解析为空字符串导致路径错误。

## 核心原则：Token 与脚本代码都不进上下文

token 极长（数百~数千字符）且是敏感凭证，放进聊天框纯属浪费 token 和泄露风险。因此：

- **用户禁止把 token 粘贴到聊天消息里**，只需复制到剪贴板。
- 完整 token 只允许出现在「剪贴板 → 临时文件 → Node.js 脚本内部变量」这条链路里。
- AI 与用户只接触 token 的前 ~20 字符前缀。
- 仅当剪贴板内容**未通过校验**时，额外显示其前 10 与后 10 字符（换行/制表符转为 `\n`、`\r`、`\t` 形式）及总长度 `len`，供用户确认复制的到底是不是 token。

**校验脚本 `update.js` 常驻技能目录，AI 直接 `node` 运行、不读取、不重写，脚本代码不进入对话上下文。**

## 流程

1. 用户把 token 复制到剪贴板，然后发「更新飞书 token」（不要粘贴 token 到聊天框）。
2. 执行「第二步：读取剪贴板」（token 不进上下文）。
3. 执行「第三步：运行常驻校验脚本」（脚本内检测，只输出结果与前缀）。
4. 执行「第四步：清理临时文件」。
5. 执行「第五步：回执」。

## 第一步：触发

用户消息含「更新/设置飞书 token」即触发，**不要等用户粘贴 token**，直接执行第二步。token 是否有效由第三步的代码判断。

## 第二步：读取剪贴板 → 临时文件（内容不进上下文）

用 PowerShell 把剪贴板原样写入技能目录下的临时文件（管道输出不会回显剪贴板内容；`$SKILL_DIR` 替换为实际路径）：

```powershell
Get-Clipboard -Raw | Set-Content -LiteralPath "$SKILL_DIR/_tmp_token.txt" -Encoding UTF8 -NoNewline
```

要点：

- `-Raw` 取剪贴板全文，`-NoNewline` 避免额外换行。
- 剪贴板为空时临时文件为空，属正常，交由第三步判为无效。
- 此命令输出为空，不会把 token 打到终端。

## 第三步：运行常驻校验脚本（代码不进上下文）

直接运行本技能目录下的常驻脚本 `update.js`（`$SKILL_DIR` 替换为实际路径）。脚本内含 JWT 特征校验与配置写入逻辑，AI **无需读取、无需重写**脚本内容，脚本代码不进入对话上下文：

```bash
node "$SKILL_DIR/update.js"
```

脚本行为说明（供 AI 理解输出，无需查看源码）：

- 读取第二步写入的 `_tmp_token.txt`（脚本用 `__dirname` 自动定位同目录文件），校验 JWT 特征（`eyJ` 开头、三段点分隔）并解码 payload 确认 token 类型为 `access_token`。
- 校验通过：将 token 写入配置文件的 `tenant_access_token` 字段，打印 `UPDATED old=<旧前缀> new=<新前缀>`（各 20 字符）。
- 校验失败：打印 `NO_VALID_TOKEN_IN_CLIPBOARD head=<前10字符> tail=<后10字符> len=<总长度>`，换行/制表符以 `\n`、`\r`、`\t` 形式显示；用户可据此判断复制内容是否为完整 token、是否复制错内容、或 token 是否真的无效。
- 路径用 `/`，Windows 下 Node 可直接识别，避免反斜杠转义问题。

## 第四步：清理临时文件

删除第二步产生的临时 token 文件（`$SKILL_DIR` 替换为实际路径；常驻脚本 `update.js` 不删）：

```powershell
Remove-Item -LiteralPath "$SKILL_DIR/_tmp_token.txt" -Force
```

## 第五步：回执

- 输出 `UPDATED`：告知用户已更新，只显示新 token 前 ~20 字符（如 `eyJhbGciOiJF...`）供核对。**完整 token 不要回显。**
- 输出 `NO_VALID_TOKEN_IN_CLIPBOARD`：说明剪贴板里没有符合特征的 token，并**原样展示 `head=`、`tail=`、`len=` 三个字段**（剪贴板内容前 10 / 后 10 字符与总长度），供用户确认复制内容是否为完整 token、是否复制错内容；随后引导走「兜底：发链接」。

## 兜底：发链接引导（剪贴板无有效 token 时）

把链接原样发给用户（不要自己打开、不要代填）：

`https://open.feishu.cn/api-explorer/cli_a74fda9e3ad8901c?apiName=create&project=docx&resource=document&version=v1`

并附引导：

> 打开上面的飞书 API Explorer 链接，授权/操作后从请求头复制 `tenant_access_token`（一长串字符），**复制到剪贴板即可，不要粘贴到聊天框**，然后回复「更新飞书 token」，我会自动读取剪贴板并写入配置。

## 硬性约束

- 配置文件路径固定为 `C:\Users\Administrator\.skills-manager\skills\feishu-docx-yashu\config.default.json`，不要写到其它位置。
- 只改 `tenant_access_token` 这一个字段的值；键名永不修改。
- token 属敏感凭证：完整值不回显、不落盘到日志/无关文件；临时 token 文件用后即删。
- `update.js` 为常驻脚本，AI 不得在对话中读取、重写或内联其代码，只能通过 `node` 运行。
- 用户环境为 Windows（Win 11 / PowerShell 5），命令按 PowerShell 语法编写。
