---
name: link-type-detector-yashu
description: 检测 Windows 11 文件夹是符号链接(Symbolic Link)还是目录联接(Junction)。当用户提供文件夹路径并询问是哪种软链接、区分 Junction 和 SymbolicLink、判断链接类型时使用此技能。
---

# Windows 软链接类型检测器

> 用户输入一个文件夹路径，输出该文件夹属于哪种软链接：**符号链接 (Symbolic Link)** 还是 **目录联接 (Junction)**。仅适用于 Windows 11。

## 适用场景

当用户提出以下问题时触发：

- "判断这个文件夹是哪种软链接"
- "这是 Junction 还是 Symbolic Link？"
- "检测一下这个路径的链接类型"
- "这个文件夹是符号链接吗？"
- 用户提供一个 Windows 路径并询问链接类型

## 用户输入

用户只需提供一个**文件夹绝对路径**，例如：

- `D:\CToD\Users\Administrator\AppData\Local\xxx`
- `C:\Users\Administrator\.trae-cn\skills\feishu-docx-yashu`

如果用户给出的是相对路径，需先转换为绝对路径再判断。

## 核心检测命令

使用 PowerShell 的 `Get-Item` + `LinkType` 属性作为主判定方法，配合 `fsutil reparsepoint query` 进行底层验证。**两条命令必须同时执行**，互为佐证，避免误判。

### 命令 1：PowerShell Get-Item（主判定）

```powershell
$item = Get-Item -LiteralPath "用户输入的路径" -Force -ErrorAction SilentlyContinue
if ($null -eq $item) {
    Write-Host "RESULT: 路径不存在"
} else {
    $linkType = $item.LinkType
    $target = if ($item.Target) { ($item.Target -join ';') } else { '(无)' }
    $mode = $item.Mode
    $attrs = $item.Attributes
    Write-Host "LinkType: $linkType"
    Write-Host "Target:   $target"
    Write-Host "Mode:     $mode"
    Write-Host "Attributes: $attrs"
}
```

`LinkType` 返回值含义：

| LinkType 返回值 | 含义                        |
| --------------- | --------------------------- |
| `SymbolicLink`  | 符号链接 (Symbolic Link)    |
| `Junction`      | 目录联接 (Junction)         |
| `HardLink`      | 硬链接 (Hard Link)          |
| `$null` 或空    | 不是软链接（普通文件/目录） |

### 命令 2：fsutil reparsepoint query（底层验证）

```powershell
fsutil reparsepoint query "用户输入的路径"
```

判定规则（看 `Tag Value` 字段）：

| Tag Value              | 含义                     |
| ---------------------- | ------------------------ |
| `0xA0000003`           | Junction (目录联接)      |
| `0xA000000C`           | Symbolic Link (符号链接) |
| 报错"不是一个重分析点" | 不是软链接               |
| 报错"路径不存在"       | 路径错误或不可达         |

## 综合判定规则

依据两条命令的结果综合判定：

| Get-Item LinkType | fsutil Tag Value   | 最终结论                                      |
| ----------------- | ------------------ | --------------------------------------------- |
| `SymbolicLink`    | `0xA000000C`       | **符号链接 (Symbolic Link)**                  |
| `Junction`        | `0xA0000003`       | **目录联接 (Junction)**                       |
| `SymbolicLink`    | fsutil 不可见/报错 | **符号链接**（VFS 层符号链接，NTFS 层不可见） |
| `Junction`        | fsutil 不可见/报错 | **目录联接**（少见，按 LinkType 判定）        |
| `$null` 或空      | 不是一个重分析点   | **不是软链接**（普通文件夹）                  |
| 路径不存在        | 路径不存在         | **路径不存在**                                |

> 当两个结果不一致时，**以 Get-Item LinkType 为准**，因为某些 VFS 虚拟路径下的符号链接对 fsutil 不可见。

## 输出格式

执行完两条命令后，必须按**三段式**输出，依次为：① 主判定 → ② 底层验证 → ③ 最终推论。**不得省略任何一段，也不得改变顺序。**

### 模板

```
检测路径: <用户输入的路径>

1. 主判定（PowerShell Get-Item LinkType）: <SymbolicLink / Junction / 空 / 路径不存在>
2. 底层验证（fsutil reparsepoint Tag Value）: <0xA000000C / 0xA0000003 / 不是一个重分析点 / 路径不存在>
3. 最终推论: <符号链接 / 目录联接 / 不是软链接 / 路径不存在>
```

### 输出示例

**示例 A — 符号链接：**

```
检测路径: C:\Users\Administrator\.trae-cn\skills\feishu-docx-yashu

1. 主判定（PowerShell Get-Item LinkType）: SymbolicLink
2. 底层验证（fsutil reparsepoint Tag Value）: 0xA000000C
3. 最终推论: 符号链接 (Symbolic Link)
```

**示例 B — 目录联接：**

```
检测路径: D:\CToD\Users\Admin\AppData\Local\xxx

1. 主判定（PowerShell Get-Item LinkType）: Junction
2. 底层验证（fsutil reparsepoint Tag Value）: 0xA0000003
3. 最终推论: 目录联接 (Junction)
```

**示例 C — 不是软链接：**

```
检测路径: D:\software\workBuddyWorkspace

1. 主判定（PowerShell Get-Item LinkType）: (空)
2. 底层验证（fsutil reparsepoint Tag Value）: 不是一个重分析点
3. 最终推论: 不是软链接（普通文件夹）
```

**示例 D — 主判定与底层验证不一致（VFS 路径等场景）：**

```
检测路径: C:\Users\Administrator\.trae-cn

1. 主判定（PowerShell Get-Item LinkType）: SymbolicLink
2. 底层验证（fsutil reparsepoint Tag Value）: 失败（路径不可达 / fsutil 不可见）
3. 最终推论: 符号链接 (Symbolic Link) — 以主判定为准，底层验证对该路径不可见
```

### 输出约束

- **必须按 1 → 2 → 3 的顺序输出三段**，每段一行，编号明确
- 第 1 段直接填写 `LinkType` 原始返回值（`SymbolicLink` / `Junction` / `(空)` / `路径不存在`）
- 第 2 段直接填写 `fsutil` 的 Tag Value 或报错摘要（`0xA000000C` / `0xA0000003` / `不是一个重分析点` / `路径不存在` / `失败（...）`）
- 第 3 段给出中文结论，并在与某段证据冲突时附简短原因
- **不要**额外输出 Target、Mode、Attributes 等附加信息，保持三段式简洁

## 执行流程

1. **接收路径**：从用户消息中提取要检测的文件夹路径
2. **执行命令**：并行执行上述两条 PowerShell 命令（通过 RunCommand 工具，blocking: true）
3. **解析输出**：从 Get-Item 输出中提取 `LinkType` 和 `Target`；从 fsutil 输出中提取 `Tag Value`
4. **综合判定**：按"综合判定规则"表得出结论
5. **输出结论**：按"输出格式"向用户报告结果

## 注意事项

- **路径转义**：路径中若包含单引号，PowerShell 中需双写转义（`'` → `''`）；推荐使用 `-LiteralPath` 避免通配符问题
- **路径存在性**：若 Get-Item 返回 `$null`，直接报告"路径不存在"，不再执行 fsutil
- **管理员权限**：检测命令本身**不需要**管理员权限；但若路径位于受保护目录（如 `C:\System Volume Information`），可能因无权访问而失败，此时应如实报告
- **VFS 路径**：Windows 11 上某些路径（如 `C:\Users\<用户>\.trae-cn`）可能是 VFS 虚拟路径，fsutil 会失败但 Get-Item 仍可正常返回 LinkType，此时以 LinkType 为准
- **只检测不修改**：本技能仅做读取检测，**绝不创建、修改或删除**任何链接；若用户提出创建/删除链接的需求，告知其不属于本技能范围

## 附：两种链接的快速对比（可选向用户解释）

| 维度      | Symbolic Link (符号链接)          | Junction (目录联接)                             |
| --------- | --------------------------------- | ----------------------------------------------- |
| 创建命令  | `New-Item -ItemType SymbolicLink` | `New-Item -ItemType Junction`（或 `mklink /J`） |
| 适用对象  | 文件或目录                        | 仅目录                                          |
| 跨盘符    | 支持                              | 支持（同机）                                    |
| 跨主机    | 支持（UNC 路径）                  | 不支持                                          |
| 创建权限  | 需管理员或开启开发人员模式        | 普通用户即可                                    |
| Tag Value | 0xA000000C                        | 0xA0000003                                      |
