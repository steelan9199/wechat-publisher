---
name: wechat-skill-toggle-yashu
description: "开启或关闭公众号相关技能。当用户说『打开公众号技能』或『关闭公众号技能』时调用。"
---

# 公众号技能开关

本技能用于控制公众号相关技能的启用与禁用，通过修改 Trae 配置文件 `C:\Users\Administrator\.trae-cn\skill-config.json` 中的 `disabledSkills` 字段来实现。

## 受控的技能列表

以下 4 个技能属于"公众号技能"组：

- `wechat-title-optimizer-yashu`
- `wechat-content-optimizer-yashu`
- `wechat-publisher-yashu`
- `generate-cover-prompt-yashu`

## 触发条件

- 当用户说 **"打开公众号技能"**（或类似表达如"启用公众号技能"、"开启公众号技能"）时，执行**开启操作**。
- 当用户说 **"关闭公众号技能"**（或类似表达如"禁用公众号技能"、"停用公众号技能"）时，执行**关闭操作**。

## 配置文件路径

```
C:\Users\Administrator\.trae-cn\skill-config.json
```

该文件结构如下：

```json
{
  "disabledSkills": [
    "skill-name-1",
    "skill-name-2"
  ],
  "builtinSkillStatus": {},
  "managedSkills": {},
  "deletedSkills": []
}
```

## 开启操作（打开公众号技能）

从 `disabledSkills` 数组中**移除**以下 4 个技能名称：

- `wechat-title-optimizer-yashu`
- `wechat-content-optimizer-yashu`
- `wechat-publisher-yashu`
- `generate-cover-prompt-yashu`

操作步骤：
1. 使用 Read 工具读取 `C:\Users\Administrator\.trae-cn\skill-config.json`。
2. 解析 JSON，从 `disabledSkills` 数组中移除上述 4 个技能名称（如果存在的话）。
3. 保持数组中其他技能名称不变，保持文件中其他字段不变。
4. 使用 Write 工具将修改后的 JSON 写回原文件（保持 2 空格缩进格式）。
5. 向用户报告操作结果，列出当前 `disabledSkills` 的最终状态。

## 关闭操作（关闭公众号技能）

向 `disabledSkills` 数组中**添加**以下 4 个技能名称（如果尚未存在的话）：

- `wechat-title-optimizer-yashu`
- `wechat-content-optimizer-yashu`
- `wechat-publisher-yashu`
- `generate-cover-prompt-yashu`

操作步骤：
1. 使用 Read 工具读取 `C:\Users\Administrator\.trae-cn\skill-config.json`。
2. 解析 JSON，检查上述 4 个技能名称是否已在 `disabledSkills` 数组中。
3. 将不存在的技能名称添加到 `disabledSkills` 数组末尾。
4. 保持数组中其他技能名称不变，保持文件中其他字段不变。
5. 使用 Write 工具将修改后的 JSON 写回原文件（保持 2 空格缩进格式）。
6. 向用户报告操作结果，列出当前 `disabledSkills` 的最终状态。

## 注意事项

- 仅修改 `disabledSkills` 字段，**不要修改** `builtinSkillStatus`、`managedSkills`、`deletedSkills` 等其他字段。
- 添加时做去重检查，避免数组中出现重复的技能名称。
- 移除时只移除指定的 4 个技能名称，不影响其他技能。
- 写回文件时保持 JSON 格式：2 空格缩进，UTF-8 编码，末尾保留换行符。
- 操作完成后，简要告知用户当前公众号技能是"已开启"还是"已关闭"状态。
