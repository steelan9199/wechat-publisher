---
name: "get-skill-link"
description: "生成技能的 GitHub 链接并复制到剪贴板。当用户说『获取技能链接』并附带技能名称时调用。"
---

# Get Skill Link

根据技能名称生成 GitHub 链接，并自动复制到系统剪贴板（Windows）。

## 触发条件

当用户说"获取技能链接"并附带一个技能名称时调用此技能。

## 工作流程

1. 从用户消息中提取技能名称（"获取技能链接"后面的文本，去除反引号、空格等）
2. 构造 URL：`https://github.com/steelan9199/wechat-publisher/tree/main/skills/<技能名称>`
3. 使用 RunCommand 工具执行 PowerShell 命令，将 URL 复制到剪贴板：
   ```powershell
   Set-Clipboard -Value "https://github.com/steelan9199/wechat-publisher/tree/main/skills/<技能名称>"
   ```
4. 向用户展示该链接，并告知已复制到剪贴板

## 示例

- 用户说：获取技能链接 `feishu-docx`
  → 输出：`https://github.com/steelan9199/wechat-publisher/tree/main/skills/feishu-docx`
  → 该链接已复制到剪贴板

- 用户说：获取技能链接 `aaabbbccc`
  → 输出：`https://github.com/steelan9199/wechat-publisher/tree/main/skills/aaabbbccc`
  → 该链接已复制到剪贴板

## 注意事项

- 技能名称需从用户消息中准确提取，忽略首尾的空格、反引号等符号
- 必须通过 RunCommand 执行 `Set-Clipboard` 命令将链接写入剪贴板
- 输出链接时使用反引号包裹，方便用户识别
