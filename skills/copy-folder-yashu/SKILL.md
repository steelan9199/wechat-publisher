---
name: copy-folder-yashu
description: 将一个源文件夹整体复制到目标文件夹下（结果路径为 <目标文件夹>/<源文件夹名>/）。激活条件：用户消息须包含以下关键词之一:`复制文件夹`、`拷贝文件夹`、`copy folder`、`复制到指定目录`。
agent_created: true
---

# Copy Folder Yashu

## Overview

本技能用于把一个源文件夹整体复制到目标文件夹下，结果路径为 `<目标文件夹>/<源文件夹名>/`。复制时根据技能目录下的 **`.copyignore` 文件**来排除指定的文件或文件夹，**`node_modules` 始终强制排除**。

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

本技能自带脚本 `scripts/copy_folder.js`，调用方式：

```bash
node "<skill_dir>/scripts/copy_folder.js" "<source_folder>" "<target_folder>"
```

#### 黑名单来源

1. **内置强制排除**：`node_modules`（始终排除，无需额外配置）
2. **`.copyignore` 文件**：技能根目录下的 `.copyignore`，每行一个名称

#### .copyignore 文件格式

- 位于技能根目录：`<skill_dir>/.copyignore`
- 每行一个要忽略的**文件或文件夹名称**（不是路径）
- 任意层级命中同名条目即整棵跳过，**大小写不敏感**
- 以 `#` 开头的行为注释，空行忽略
- `node_modules` 由脚本始终排除，不需要写在文件里

示例：

```
# 版本控制
.git
.svn

# 构建产物
dist
build

# 敏感文件
.env
secret.txt
```

### 3. 实现要点（供必要时人工调用参考）

脚本核心逻辑（纯 Node，无外部依赖）：

```js
// 读取 .copyignore
const fileBlacklist = loadCopyIgnore(path.join(SKILL_DIR, '.copyignore'));

// 合并：内置 + 文件
const blacklist = new Set(
  [...ALWAYS_EXCLUDED, ...fileBlacklist]
    .map(n => n.toLowerCase())
);

fs.cpSync(SRC, DEST, {
  recursive: true,
  preserveTimestamps: true,
  filter: (from) =>
    from === SRC /* 源根目录始终放行 */ || !blacklist.has(path.basename(from).toLowerCase()),
});
```

要点：
- 目标写成 `<target>/<源basename>`，而不是直接用 target，否则会把内容铺到 target 根目录；
- 源路径先经 `fs.realpathSync` 解析为真实目录——`fs.cpSync` 对根符号链接会试图在目标处**重建链接**（而非复制内容），撞上已存在目录即报 `EEXIST`；
- 黑名单命中目录时其整个子树都不会复制；源目录本身恰好叫黑名单名（如复制一个名为 node_modules 的目录）也必须放行根目录；
- cpSync 默认行为即"目标存在则合并/覆盖同名文件"（`force: true`），不会删除目标中多出来的旧文件（如需镜像式完全一致，先手动删除目标文件夹再复制）；
- 退出码：0 成功、2 用法错误、1 复制失败。

### 4. 验证与收尾

复制完成后：
- 列出目标目录确认 `<目标文件夹>/<源文件夹名>` 已生成：`ls "<target>"`。
- 确认 `node_modules` 未被复制：`ls "<dest>/node_modules" 2>/dev/null` 应为空。

## Notes

- 若目标中已存在同名文件夹，脚本会合并/覆盖同名文件，并在输出中给出 NOTE 提示。如需保留旧版本，请用户先备份或改名。
- 脚本不会删除源文件夹，仅做复制。
- 该操作涉及向用户指定目录写入文件；若目标位于个人目录或存在覆盖风险，按 WorkBuddy 安全规范先向用户确认。
- 要修改黑名单，直接编辑技能目录下的 `.copyignore` 文件即可，无需改脚本。
