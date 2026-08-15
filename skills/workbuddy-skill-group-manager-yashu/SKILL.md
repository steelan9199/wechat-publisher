---
name: workbuddy-skill-group-manager-yashu
description: 技能(skill)组开关管理器（含白名单，含 WorkBuddy 内置技能）。当用户说"打开XX技能组""关闭XX技能组""只开XX组""列出技能组""当前开了哪些组""加入白名单""移出白名单""列出白名单"时启用。按预定义分组或白名单批量管理 WorkBuddy 用户级与内置技能的开启与关闭。
disable-model-invocation: false
---

# 技能(skill)组开关管理器（脚本驱动 · 含白名单）

你负责按"技能组 / 白名单"批量管理 WorkBuddy 技能的开启与关闭。
**核心原则：所有对技能文件的读写都由 NodeJS 脚本完成，你（AI）绝不要自行 Read / Edit 任何 SKILL.md，以节省 token 与算力。**

## 白名单（Always-On）

- 白名单里的技能是"任何工作都会用到"的技能，**任何开关操作都不会关闭它们**，且会被强制保持启用（`disable-model-invocation: false`）。
- 白名单记录在 `state.json` 的 `whitelist` 字段。默认已含：`elite-intent-architect-yashu`。
- 你（本管理器）自身 `workbuddy-skill-group-manager-yashu` 永远受保护，不会被关闭（脚本已内置此保护）。

## 技能目录

```nodejs
const os = require('os');
const path = require('path');
// 用户级技能根目录
const SKILLS_DIR = path.join(os.homedir(), '.workbuddy', 'skills');
// 内置技能根目录（skill-* 文件夹，内嵌一层 <版本>/SKILL.md）
const BUILTIN_DIR = path.join(os.homedir(), '.workbuddy', 'plugins', 'cache', 'workbuddy-builtin');
// =====================================================================
```

## 内置技能（Built-in）

- 内置技能文件夹以 `skill-` 开头，内嵌一层版本号目录（如 `0.1.0`），`SKILL.md` 在版本目录内。
- 脚本现已**同时扫描「用户目录」与「内置目录」**，扫描结果每条带 `scope: 用户/内置`；`open` / `close` / `only` / `whitelist` 对两者**统一生效**。
- 预建了 6 个内置分类组（开箱即用，可一键开关整类）：`设计`(6)、`多模态部署地图`(3)、`文档办公`(3)、`专家连接器推荐`(3)、`技能管理`(2)、`金融`(1)。这些组已写入 `groups.json`，你也能手动增删。
- ⚠️ 分组里写的是技能的 **`name:` 字段值**，不一定等于文件夹名。例如 `skill-skill-creator` 的 name 是 `skill-creator`，`skill-buddy-multimodal-generation` 的 name 是 `3D模型与视频特效`，`skill-library` 的 name 是 `资料库`。
- 白名单已含 `skill-creator`（即文件夹 `skill-skill-creator`），任何开关都不会关闭它。
- ⚠️ **持久性限制**：内置 `SKILL.md` 在 `cache` 目录下，WorkBuddy 更新时可能被还原，导致「已关闭」失效；届时重新执行一次开关即可。

## 环境说明

- **`$SKILL_DIR`**：本 Skill 所在的绝对目录，即 `SKILL.md` 文件所在文件夹。**⚠️ `$SKILL_DIR` 仅为文档占位符，不是环境变量**：执行命令时必须替换为实际绝对路径，否则 bash 会将其解析为空字符串，导致 `cd $SKILL_DIR/scripts` 变成 `cd /scripts` 而报错"找不到路径"

## 脚本入口（唯一执行通道）

脚本位置（绝对路径，Git Bash 用正斜杠）：

```bash
$SKILL_DIR/scripts/skill-manager.js
```

- `node` 已在 PATH。直接 `node <脚本路径> <命令> [参数] [--dry|--apply] [--json]`。
- **默认 `--dry`**：只打印计划，不改动任何文件。必须加 `--apply` 才真正执行。
- 配置文件：`groups.json`（组定义）、`state.json`（`active_groups` + `whitelist`）。脚本自动读写，你无需手动改。

## 指令与触发词

### 0. 独开技能组（最省 token）

触发："只开XX组" / "独开XX组" / "仅启用XX组" / "只打开XX组"
→ `node <脚本> only <组名> --dry` → 确认 → `node <脚本> only <组名> --apply`

### 1. 打开技能组

触发："打开XX技能组" / "开启XX组" / "启用XX组" / "打开XX"
→ `node <脚本> open <组名> --dry` → 确认 → `node <脚本> open <组名> --apply`

### 2. 关闭技能组

触发："关闭XX技能组" / "关掉XX组" / "停用XX组" / "关闭XX"
→ `node <脚本> close <组名> --dry` → 确认 → `node <脚本> close <组名> --apply`
（脚本会自动跳过"也属于其它仍开启组"的重叠技能、白名单技能、自身）

### 3. 查询

- "列出技能组" / "有哪些技能组"：`node <脚本> list`
- "当前开了哪些组" / "当前启用了什么"：`node <脚本> status`
- "扫描一下技能" / "有哪些技能"：`node <脚本> scan`
- "--json" 可让任意命令输出结构化 JSON（需要机器解析时再加）

### 4. 白名单管理（新增能力）

- "把 XX 加入白名单" / "XX 加白名单"：`node <脚本> whitelist-add <技能名> --apply`
  （同时把它强制设为启用，并写入 state.json）
- "把 XX 移出白名单" / "取消 XX 白名单"：`node <脚本> whitelist-remove <技能名> --apply`
  （只移出白名单，不改动其当前启用状态）
- "列出白名单" / "白名单有哪些"：`node <脚本> whitelist-list`

> 找不到组名时，脚本会列出可用组名并停下；把输出转述给用户即可，不要瞎猜。

## 确认环节（每次修改必须）

在真正 `--apply` 之前，先运行 `--dry` 并把脚本输出的计划（将启用 / 将关闭 / 重叠保留 / 白名单保护 / active_groups 与 whitelist 将变为）原样转述给用户，明确写"请确认后执行"。**未获确认不得加 `--apply`。**

## 完成反馈

`--apply` 执行后，把脚本末尾的"已执行"结果简要汇报：开启 N 个、关闭 M 个、重叠保留 K 个、白名单保护 P 个，并附当前 `active_groups` 与 `whitelist`。

## 你（AI）禁止做的事

- 禁止用 Read / Edit / Write 直接修改任何 SKILL.md 或 groups.json / state.json —— 一律交给脚本。
- 禁止关闭自身 `workbuddy-skill-group-manager-yashu`，也禁止关闭白名单技能（脚本已兜底，但你也不要尝试）。
