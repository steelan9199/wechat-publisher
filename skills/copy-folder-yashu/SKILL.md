---
name: copy-folder-yashu
description: 将一个源文件夹整体复制到目标文件夹下（结果路径为 <目标文件夹>/<源文件夹名>/）。激活条件：用户消息须包含以下关键词之一:`复制文件夹`、`拷贝文件夹`、`复制技能`、`拷贝技能`、`copy folder`、`复制到指定目录`。
agent_created: true
---

# Copy Folder Yashu

## Overview

本技能用于把一个源文件夹整体复制到目标文件夹下，结果路径为 `<目标文件夹>/<源文件夹名>/`。复制时**强制排除 `node_modules` 目录**（任意层级），因为它体积庞大，且可通过 `npm install` 重新安装，无需复制。

典型场景：把某个 skill 文件夹（如 `D:\software\workBuddyWorkspace\.workbuddy\skills\js-obfuscator-public-yashu`）复制一份到私人技能库 `D:\skill\private-skills\skills` 下，结果得到 `D:\skill\private-skills\skills\js-obfuscator-public-yashu\`。

## When To Use

当用户希望把一个文件夹原样复制到另一个目录下时触发。

常见触发语：
- "把 D:\...\js-obfuscator-public-yashu 复制到 D:\skill\private-skills\skills 下"
- "复制这个文件夹到目标目录"

## How To Use

### 1. 确认两个路径

从用户消息中识别两个必填参数：

- **源文件夹**（source）：被复制的文件夹的完整路径，例如 `D:\software\workBuddyWorkspace\.workbuddy\skills\js-obfuscator-public-yashu`
- **目标文件夹**（target）：源文件夹将被放入此目录下，例如 `D:\skill\private-skills\skills`

结果路径 = `<目标文件夹>/<源文件夹的 basename>/`。

若任一路径缺失或含糊，向用户确认后再执行；不要臆测路径。

### 2. 执行复制脚本

本技能自带脚本 `scripts/copy_folder.sh`，调用方式：

```bash
bash "<skill_dir>/scripts/copy_folder.sh" "<source_folder>" "<target_folder>" [extra_exclude_dir ...]
```

- `node_modules` 由脚本**始终排除**，无需额外指定。
- 可选的第三及以后参数为额外要排除的目录名（如 `.git`、`dist`）。
- 优先使用 Bash 工具运行该脚本（避免 PowerShell 工具 stdout 为空的已知问题）。

路径既可用反斜杠也可用正斜杠，脚本内部会统一规范化。

### 3. 实现要点（供必要时人工调用参考）

脚本核心逻辑（Windows 优先用 robocopy，非 Windows 回退到 rsync/cp）：

```bash
FOLDER_NAME="$(basename "$SRC")"
DEST="$DST_PARENT/$FOLDER_NAME"
robocopy "$SRC" "$DEST" /E /XD node_modules /NFL /NDL /NP /NJH /NJS
# robocopy 退出码 0-7 视为成功，>=8 为失败
```

若不使用脚本而直接调用 robocopy，务必：
- 目标写成 `<target>/<源basename>`，而不是直接用 target，否则会把内容铺到 target 根目录；
- 必须带 `/XD node_modules`；
- 退出码 < 8 即成功，勿误判为失败。

### 4. 验证与收尾

复制完成后：
- 列出目标目录确认 `<目标文件夹>/<源文件夹名>` 已生成：`ls "<target>"`。
- 确认 `node_modules` 未被复制：`ls "<dest>/node_modules" 2>/dev/null` 应为空。
- 若目标本就是 Node 项目/skill，提醒用户可在目标路径运行 `npm install`（或对应包管理器命令）恢复依赖。

## Notes

- 若目标中已存在同名文件夹，脚本会合并/覆盖同名文件（robocopy 默认行为），并在输出中给出 NOTE 提示。如需保留旧版本，请用户先备份或改名。
- 脚本不会删除源文件夹，仅做复制。
- 该操作涉及向用户指定目录写入文件；若目标位于个人目录或存在覆盖风险，按 WorkBuddy 安全规范先向用户确认。
