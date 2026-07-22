---
name: skill-failed-cleanup-yashu
description: "本技能用于清理 skills-manager 在技能安装失败后残留的文件夹。激活条件：用户消息须包含以下关键词之一:`技能安装失败`、`skill安装失败`、`清理残留文件夹`、`清理安装失败`、`skill残留`。"
---

# 失败技能清理

本技能用于绕过 skills-manager 软件的一个 Bug：技能安装失败后会残留文件夹，导致无法重新安装。由于该软件作者尚未修复此问题，本技能手动删除残留文件夹。

## 触发条件

当用户表示**技能安装失败**（技能安装失败 / skill安装失败 / 安装失败）且需要清理残留文件夹时，触发此技能。

不要对常规安装帮助、成功安装或无关的文件删除操作触发此技能。

## 功能说明

1. 确定目标技能名称（见下方提取方式）。
2. 检查 `C:\Users\Administrator\.skills-manager\skills\<skill-name>` 是否存在。
3. 如果存在，删除整个文件夹。
4. 如果不存在，告知用户未发现残留文件夹。

## 确定技能名称

有两种方式识别技能名称。始终按以下顺序尝试：

### 方式一：用户明确提供名称

如果用户直接给出了技能名称，直接使用即可。

示例：

- 用户："feishu-docx 安装失败了，帮我清理一下" → 技能名称 = `feishu-docx`

### 方式二：从 URL 中提取

如果用户提供了包含 `/skills/<name>` 的 GitHub/仓库链接，从 URL 中提取技能名称。

提取规则：

1. 在 URL 路径中找到 `/skills/` 片段。
2. 取 `/skills/` 之后的**最后一个路径段**。
3. 去除尾部的斜杠、查询字符串（`?...`）或片段标识符（`#...`）。

示例：

- `https://github.com/steelan9199/wechat-publisher/tree/main/skills/feishu-docx` → `feishu-docx`
- `https://github.com/user/repo/tree/main/skills/my-skill/` → `my-skill`
- `https://github.com/user/repo/tree/main/skills/my-skill?tab=readme` → `my-skill`

如果 URL 中不包含 `/skills/`，请用户直接提供技能名称。

## 执行步骤

按顺序执行以下步骤。尽可能使用专用文件工具（Glob、Read、DeleteFile）而非 shell 命令。

1. **解析技能名称**：使用上述方式一或方式二。如果两种方式都无法获得名称，则向用户询问。
2. **确认目标路径**：删除前与用户确认：
   - 目标路径：`C:\Users\Administrator\.skills-manager\skills\<skill-name>`
3. **检查是否存在**：使用 `LS` 或 `Glob` 检查 `C:\Users\Administrator\.skills-manager\skills` 目录下是否存在目标文件夹。
4. **删除文件夹**（如果存在）：
   - 优先使用 `DeleteFile` 工具。注意：`DeleteFile` 接受绝对路径列表。要删除文件夹及其内容，先使用 `LS` 列出其内容，删除每个子文件/子文件夹，再删除文件夹本身。如果 `DeleteFile` 无法删除非空目录，则通过 `RunCommand` 执行 PowerShell 命令：
     - `Remove-Item -Recurse -Force "C:\Users\Administrator\.skills-manager\skills\<skill-name>"`
5. **验证删除**：再次列出父目录内容，确认文件夹已被删除。
6. **报告结果**：
   - 成功时：告知用户已删除哪个文件夹，现在可以重新安装。
   - 文件夹不存在时：告知用户未发现残留文件夹。

## 注意事项

- 只删除 `C:\Users\Administrator\.skills-manager\skills\` 下的文件夹。绝不删除此路径之外的任何内容。
- 删除前务必与用户确认解析出的技能名称和完整目标路径。
- 本技能只清理**安装失败**残留的文件夹。除非用户明确要求，否则不要用于当前正常运行的技能文件夹。

## 其他说明

如果删掉指定的技能文件夹后还无法重新安装，则提示用户删掉指定 AI 软件的 skills 文件夹，比如 Trae CN 的 skills 文件夹（如 `C:\Users\Administrator\.trae-cn\skills`），技能应该就可以正常安装了。

技能正常安装后，提醒用户使用 `move-big-folder` 技能，把 C 盘的大文件使用软链接迁移到 D 盘的 skills 文件夹。
