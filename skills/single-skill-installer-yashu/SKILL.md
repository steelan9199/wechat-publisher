---
name: single-skill-installer-yashu
description: 只从 GitHub 链接下载并安装单个技能文件夹。激活条件：用户消息须包含以下关键词之一:`安装GitHub技能`、`从GitHub装技能`、`装这个GitHub技能`、`下载技能文件夹`、`只装这一个技能`、`安装单个技能`。
---

# 单技能安装器 (single-skill-installer-yashu)

## 用途

用户给一个 GitHub 链接，想要只安装该链接对应的**一个技能文件夹**。本技能负责：判定 → 窄克隆下载 → 复制到目标目录 → 输出绝对路径。

## 判定规则（硬性）

1. **先探测**链接指向的文件夹下有没有 `SKILL.md`（用 `raw.githubusercontent.com` 探测，不下载文件夹内容）。
2. **有 `SKILL.md`** → 是技能文件夹 → 只下载这一个文件夹。
3. **没有 `SKILL.md`** → 不是技能文件夹 → **不下载**，向用户说明原因（退出码 1）。

## 下载方式（硬性）

- 使用 **git 窄克隆**：`git clone --filter=blob:none --no-checkout --sparse --depth 1 --branch <branch>` + `git sparse-checkout set --cone <子路径>` + `git checkout`。
- **绝不**整仓克隆后再提取。只拉取用户指定的那一个文件夹。
- 每次**只安装一个技能**。用户给了多个链接就逐个调用本脚本（每个链接一次）。
- 临时克隆缓存默认在安装完成后删除，目标目录不留 `.git` 残留。

## 默认下载位置（重要，供调用方 AI agent 阅读）

- 安装目标目录默认 = **脚本运行时的当前工作目录**（AI agent 通常应在用户的项目目录下运行）。
- 更稳妥的做法：调用方显式传 `-TargetDir`，例如用户的项目目录 `D:\empty`。
- 安装位置 = `<TargetDir>/<技能文件夹名>`，技能文件夹名取子路径最后一段（如 `identity-backup-yashu`）。

## 输出契约（必须遵守，供调用方 AI agent 阅读）

脚本成功时会输出以下两行关键信息，**调用方 AI agent 必须读取并原样向用户展示**：

```
SKILL_DIR=<安装后技能文件夹的绝对路径>
SKILL_MD=<该文件夹下 SKILL.md 的绝对路径>
```

- `SKILL_DIR` 就是"技能被下载到了哪个文件夹"的答案，必须让用户看到。
- 失败时退出码非 0，无 `SKILL_DIR` 输出，按退出码表向用户说明原因。

## 调用方法

```powershell
& "D:\software\PowerShell\7\pwsh.exe" -File "<本技能目录>\scripts\install-single-skill.ps1" `
  -Url "<用户给的链接>" `
  -TargetDir "<目标目录，缺省为当前工作目录>"
```

参数：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `-Url` | 是 | GitHub 链接：`https://github.com/<owner>/<repo>/tree/<branch>/<path>` 或 `https://github.com/<owner>/<repo>`（仓库根目录本身是技能） |
| `-TargetDir` | 否 | 下载目标目录；缺省 = 当前工作目录 |
| `-Force` | 否 | 目标已有同名文件夹时允许覆盖（默认拒绝，避免误删） |
| `-KeepCache` | 否 | 保留临时克隆缓存（默认删除） |

## 退出码

| 码 | 含义 | 给用户的说明 |
| --- | --- | --- |
| 0 | 成功 | 读取 `SKILL_DIR` 绝对路径并展示 |
| 1 | 该文件夹下没有 SKILL.md | 不是技能文件夹，未下载 |
| 2 | 目标已有同名文件夹 | 建议换目标目录或加 `-Force` |
| 10-17 | 环境/解析/网络/克隆/复制失败 | 按脚本输出的错误信息说明 |

## 环境要求

- 已安装 **git** 并加入 PATH。
- 运行解释器：**PowerShell 7（pwsh）**，优先 `D:\software\PowerShell\7\pwsh.exe`，缺失时回退 PATH 中的 `pwsh`。
- 需要能访问 `github.com`、`raw.githubusercontent.com`、`api.github.com`（仅无 tree 段时查默认分支用一次）。

## 边界与限制

- 仅支持 **GitHub 公开仓库** 的 https 链接。
- 分支名含 `/`（如 `feature/x`）的 tree URL 无法可靠解析（GitHub 网页形式有歧义），会因探测 SKILL.md 失败而安全拒绝，不会误下载。
- 链接指向的是"容器目录"（如 `.../tree/main/skills`，该层没有 SKILL.md）→ 按规则拒绝，不下载。

## 资源

- `scripts/install-single-skill.ps1`：唯一的执行脚本，全部逻辑在其中（URL 解析、SKILL.md 探测、窄克隆、复制、输出 SKILL_DIR）。
