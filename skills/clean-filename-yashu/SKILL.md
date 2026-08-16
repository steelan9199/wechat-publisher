---
name: clean-filename-yashu
description: 清理并规范化文件名中的标点符号，生成 Windows 安全可用的干净文件名。激活条件：用户消息须包含以下关键词之一:`文件名报错`、`文件名错误`、`文件名特殊字符`、`规范化文件名`。
disable-model-invocation: false
---

# 文件名标点符号清理（clean-filename）

## 作用
把字符串里的 ASCII 标点规整为对应中文标点、无对应中文的 ASCII 符号直接删除，输出可直接当 Windows 文件名用的干净串（并自动写入剪贴板）。

## 触发条件
用户提到以下任一关键词即**立即执行**，不要反问、不要确认：
- `文件名报错` / `文件名错误` / `文件名特殊字符` / `规范化文件名`
- 类似"文件名里有引号/问号导致存不了、报错"的表述

## 执行（唯一通道）
用 managed node 绝对路径直跑，脏名走 heredoc（天然兼容引号、`?`、`*`、`<`、`>` 等特殊字符，无需 shell 转义）：

```bash
C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2\node.exe "C:\Users\Administrator\.workbuddy\skills\clean-filename-yashu\clean_filename.js" <<'EOF'
这里填待清洗的文件名（可含任意特殊字符）
EOF
```

把用户给出的脏文件名替换进 heredoc 体内即可，其余一律照抄。

## 交付
只把脚本输出的 **`清洗后:`** 那一行展示给用户（剪贴板已自动复制，顺带提一句"已复制到剪贴板"即可）。
不复述原理、不贴完整脚本、不额外解释。

## 禁令（避免拖慢，违反即算失误）
- 禁止 `Read` 脚本源码（`clean_filename.js`）
- 禁止先去翻业务文件 / 文档
- 禁止使用 `AskUserQuestion` 反问
- **触发即跑，跑完即展示**
