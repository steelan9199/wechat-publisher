---
name: suffix-to-json-yashu
description: "本技能将多行后缀文本文件转换为 JSON 的 suffix 字段，将换行转义为 \n 并输出最小 JSON 对象。激活条件：用户消息须包含以下关键词之一:`后缀转JSON`、`转成suffix`、`多行后缀转JSON`、`文件转JSON suffix`。"
agent_created: true
---

# 后缀转 JSON

## 概述

把用户给的「后缀文本文件」转成可直接粘贴进配置的 JSON。文件内容整体就是后缀，
技能读取后将其中的换行转义为 `\n`、双引号与反斜杠自动转义、行首缩进原样保留，
最后输出最小的 `{"suffix": "..."}` JSON 到对话里，由用户自行复制使用。

## 工作流程

1. **接收文件路径。** 从用户消息中取得后缀文本文件的绝对或相对路径。若用户未明确给出路径，先询问路径，不要猜测。
2. **执行转换脚本。** 用 Node.js 运行本技能附带的脚本，传入文件路径：
   ```bash
   node SKILL_DIR/scripts/suffix_to_json.js "FILE_PATH"
   ```
   脚本负责确定性地读取文件、转义换行与特殊字符，并输出 `{"suffix": "..."}`。
3. **回显 JSON。** 将脚本输出的 JSON 直接展示在对话中。不要自行改写转义结果，
   也不要把 JSON 写入任何文件（除非用户后续明确要求存盘）。
4. **处理异常。** 若脚本报「找不到文件」，提示用户核对路径后重试；
   若文件为空，说明生成的 suffix 为空字符串并照常输出。

## 示例

输入文件 `suffix.txt` 内容：
```
## 写本文用到的
- 工具: WorkBuddy
- Skill
  - 本地markdown发布到公众号 https://github.com/steelan9199/wechat-publisher/tree/main/skills/wechat-publisher-yashu
  - 生成常见图表 流程图等 https://github.com/steelan9199/wechat-publisher/tree/main/skills/svg-diagram-yashu
```

运行脚本后输出：
```json
{
  "suffix": "## 写本文用到的\n- 工具: WorkBuddy\n- Skill\n  - 本地markdown发布到公众号 https://github.com/steelan9199/wechat-publisher/tree/main/skills/wechat-publisher-yashu\n  - 生成常见图表 流程图等 https://github.com/steelan9199/wechat-publisher/tree/main/skills/svg-diagram-yashu"
}
```
