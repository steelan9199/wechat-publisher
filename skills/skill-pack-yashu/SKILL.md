---
name: skill-pack-yashu
description: 把指定技能打包成 .skill 归档文件（实质 zip）。激活条件：用户消息须包含以下关键词之一:`打包技能`、`技能打包`、`pack skill`、`压缩技能`、`打包成skill`。
metadata:
  author: "牙叔教程"
  updated: "2026-08-01 12:00:00"
  version: "1.2.0"
---

# 打包技能为 .skill 归档

## 功能概述

本 Skill 用于把单个技能目录打包成 `.skill` 归档文件（实质为 zip 格式，任何解压软件均可打开），便于分发、归档与迁移。采用"硬编码必打包项 + 每技能 `.pack-include.json` 覆写（白名单 + 黑名单）+ 硬黑名单兜底"三层机制，确保私密文件（license-key、备份、临时文件、已有 .skill 包等）绝不打入归档。

适用场景：把开发完成的技能打包归档；把技能分发给其他环境；备份技能当前版本。每次只打包一个技能，不支持批量。

打包产物直接输出到技能目录本身，命名为 `<技能名>.skill`，同技能多次打包会覆盖旧包。打包时自动在包内生成 `manifest.json`（文件清单 + 每个文件 SHA256 + 大小），便于完整性校验，**不污染技能目录**。

## 环境说明

- 操作系统：Windows/Linux/macOS
- Node.js：>= 18.20.8
- Shell：PowerShell 5 / bash / zsh
- 依赖：需先在 `$SKILL_DIR/scripts` 下执行 `npm install` 安装 `archiver`
- 本 Skill 运行命令时采用**条件执行**（前一条成功才执行下一条），跨平台规则如下：
  - bash/zsh：`cmd1 && cmd2`
  - PowerShell 5：`cmd1; if ($?) { cmd2 }`（PowerShell 5 不支持 `&&`）
  - 禁止单 `&`
- `$SKILL_DIR` 仅为文档占位符，不是环境变量，执行命令时必须替换为本 Skill 的实际绝对路径

### 路径与配置

| 配置项         | 位置                                                   | 说明                                         |
| -------------- | ------------------------------------------------------ | -------------------------------------------- |
| 默认技能目录   | `$SKILL_DIR/scripts/config.json` 的 `defaultSkillsDir` | 传入"技能名"时的查找目录（传绝对路径时不用） |
| 压缩级别       | `$SKILL_DIR/scripts/config.json` 的 `compressionLevel` | zlib 压缩级别 0-9，默认 6                    |
| 硬黑名单       | `$SKILL_DIR/scripts/config.json` 的 `hardBlacklist`    | 任意层级命中即排除的条目                     |
| 必打包项       | 脚本内硬编码                                           | `SKILL.md` + `scripts/` + `references/`      |
| 每技能额外覆写 | 技能目录下的 `.pack-include.json` 文件                 | 声明额外打包（白名单）与排除（黑名单）条目   |

AI 执行脚本前必须将 `$SKILL_DIR` 替换为实际绝对路径，再 `cd` 到 `$SKILL_DIR/scripts` 运行命令。配置字段详细说明见 [打包流程与配置参考]($SKILL_DIR/references/pack-api.md)。

## 三层过滤机制

| 层级                   | 作用                                           | 配置位置                                          |
| ---------------------- | ---------------------------------------------- | ------------------------------------------------- |
| 第一层：硬编码必打包项 | 标准技能结构默认打包                           | 脚本内硬编码（`SKILL.md`/`scripts`/`references`） |
| 第二层：每技能覆写     | 单个技能声明额外打包（白名单）与排除（黑名单） | 技能目录下的 `.pack-include.json` 文件            |
| 第三层：硬黑名单       | 任意层级命中即排除，防御性兜底                 | `config.json` 的 `hardBlacklist`                  |

**判定顺序**：技能黑名单（`.pack-include.json` 的 `blacklist`）> 技能白名单（`.pack-include.json` 的 `whitelist`，覆盖硬黑名单与必打包项）> 硬黑名单 > 必打包项。即技能级配置最高优先，先按技能黑名单排除，再按技能白名单放行（可覆盖硬黑名单与必打包项限制），再按硬黑名单排除，最后判断是否在必打包项中。`node_modules` 在任意层级都排除（它可能出现在 `scripts/` 等必打包文件夹内部，体积巨大）。`*.skill` 在任意层级排除，防止把已有包打进去（自打包防御）。

**`.pack-include.json` whitelist 与 blacklist**：

- `whitelist`：数组，声明额外要打包的**顶层条目名**（仅顶层生效）。
- `blacklist`：数组，声明要排除的条目，**任意层级生效**，支持纯名称（任意层级匹配）与相对路径（精确匹配，`*` 不跨目录）。可排除必打包项内的子文件/子目录，如 `scripts/draft.md`。

**为什么必打包项硬编码**：标准技能结构固定（SKILL.md + scripts + references），硬编码可避免用户遗漏维护白名单。额外条目通过 `.pack-include.json` 声明，关注点分离。

## 执行步骤

| 步骤 | 执行动作 | 具体命令/操作                                                                                                                                                                                            |
| ---- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | 确认依赖 | 检查 `$SKILL_DIR/scripts/node_modules` 是否存在；不存在则 `npm install`                                                                                                                                  |
| 2    | 确认配置 | 读取 `$SKILL_DIR/scripts/config.json`，确认 `defaultSkillsDir` 指向正确                                                                                                                                  |
| 3    | 执行打包 | 运行 `cd $SKILL_DIR/scripts; if ($?) { node pack.js <技能路径或技能名> }`                                                                                                                                |
| 4    | 展示报告 | **必须把脚本输出的"已打包/已跳过"完整树形报告原样贴到聊天窗口**（含 ASCII 文件树、产物大小、结果行），不得改写为表格或摘要；再检查跳过项是否有误伤的合法文件                                             |
| 5    | 补救误伤 | 若有合法文件被跳过（原因"不在白名单"），在该技能目录下创建 `.pack-include.json` 用 `whitelist` 字段登记额外条目，重新打包；若需主动排除某文件/目录，在 `blacklist` 字段中加条目（如 `scripts/draft.md`） |

### 参数说明

```
node pack.js <技能路径或技能名>     # 打包单个技能
node pack.js                        # 不带参数时打印用法并列出可用技能
```

支持两种入参形式：

- **绝对路径**（推荐）：如 `d:/skill/private-skills/.trae/skills/coze-low-code-caller-yashu`
- **技能名**：如 `coze-low-code-caller-yashu`，将从 `defaultSkillsDir` 查找

## 输出格式

> ⚠️ **【强制要求】打包完成后，AI 必须把脚本输出的完整树形报告原样展示在聊天窗口**，包括 "== 技能 ==" 标题行、源目录、打包产物路径、"已打包"文件树（含 `manifest.json [自动生成]`）、"已跳过"清单（每项含原因）、产物大小、结果行。**禁止改写为表格、摘要或其他形式**，必须保留 ASCII 文件树原貌。

脚本对每个技能输出结构化报告：

```
== 技能: coze-low-code-caller-yashu ==
源目录: d:/skill/private-skills/.trae/skills/coze-low-code-caller-yashu
打包产物: d:/skill/private-skills/.trae/skills/coze-low-code-caller-yashu/coze-low-code-caller-yashu.skill

已打包 (11 项 + 1 自动生成):
coze-low-code-caller-yashu/
├── SKILL.md
├── manifest.json  [自动生成]
├── references/
│   └── bot-api.md
└── scripts/
    ├── check_status.js
    └── pack.js

已跳过 (5):
  - scripts-backup            [原因: 硬黑名单]
  - license-key.txt           [原因: 硬黑名单]
  - 测试用例.md               [原因: 不在白名单]
  - temp                      [原因: 不在白名单]
  - coze-low-code-caller-yashu.skill  [原因: 硬黑名单(任意层级)]

产物大小: 45678 字节
结果: 成功
```

`.pack-include.json` 文件格式与完整示例见 [打包流程与配置参考]($SKILL_DIR/references/pack-api.md)。

## 全业务脚本索引清单

| 脚本                         | 功能                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `$SKILL_DIR/scripts/pack.js` | 按必打包项+覆写+硬黑名单规则把技能打包成 `.skill`，输出已打包/已跳过清单，包内含 manifest.json |

## 跨功能公共规则

- 执行脚本前必须 `cd` 到 `$SKILL_DIR/scripts` 目录
- 脚本通过 `console.error` 输出日志（stderr），便于 stdout 留给结构化数据
- 打包产物 `<技能名>.skill` 直接输出到技能目录本身；若已存在则直接覆盖（保持单一最新版）
- `.pack-include.json` 文件本身不会被打入包（在硬黑名单中）
- `config.json`（含用户私有配置）不在必打包项中，不会被打包
- `manifest.json` 在包内自动生成，不输出到技能目录；技能目录中若存在旧 `manifest.json` 也会被硬黑名单排除

## 错误处理

| 错误场景            | 错误表现                       | 处理方式                                                             |
| ------------------- | ------------------------------ | -------------------------------------------------------------------- |
| config.json 不存在  | 脚本报错找不到配置             | 从 `config.default.json` 复制一份为 `config.json`，按需调整          |
| node_modules 未安装 | 脚本报错找不到 `archiver` 模块 | 在 `$SKILL_DIR/scripts` 下执行 `npm install`                         |
| 技能目录不存在      | 脚本报错找不到目录             | 检查路径拼写；不带参数运行脚本可列出 `defaultSkillsDir` 下的可用技能 |
| 不是有效技能目录    | 脚本报错缺少 SKILL.md          | 确认传入的目录确实是技能目录（必须有 `SKILL.md`）                    |
| 合法文件被误跳过    | 报告中显示"不在白名单"         | 在该技能目录下创建 `.pack-include.json` 登记该条目，重新打包         |
| 写入打包文件失败    | 脚本报错权限不足或文件被占用   | 关闭占用该 `.skill` 文件的程序（如解压软件、编辑器），重新打包       |
