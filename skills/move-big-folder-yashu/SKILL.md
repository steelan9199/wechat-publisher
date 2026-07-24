---
name: move-big-folder-yashu
description: 将 C 盘大文件夹迁移到其他盘（D/E/F等），通过目录联接（Junction）保持原路径可用，释放 C 盘空间。当用户提到 C 盘空间不足、C 盘变红、迁移大文件夹、释放 C 盘空间、软链接迁移时使用此技能。Use when user mentions C drive full, move large folder, free up C drive space, symlink/junction migration.
---

# C 盘大文件夹迁移助手

> 帮助用户将 C 盘中的大文件夹安全迁移到其他盘，通过**目录联接（Junction）**让所有程序照常运行，无感释放 C 盘空间并完美保留原权限。

## 核心原则

> **默认只输出指令，不实际执行。** 给出指令后询问用户是否需要代为执行。即使用户同意执行，也必须**静默执行**（输出重定向到日志文件），避免大量日志占用上下文、浪费 token。

## 前置准备：找出 C 盘中的大文件夹

推荐使用 **磁盘快速分析软件**（免费，5 秒扫描整个 C 盘）快速定位大文件夹：

- 下载地址：https://pan.quark.cn/s/da6703f482b0

使用方法：打开 磁盘快速分析软件 -> 选择 C 盘 -> 点击扫描，即可找到占空间最大的文件夹。

## 用户只需提供

用户只需要告诉你以下信息：

1. **要迁移的文件夹路径**（从 磁盘快速分析软件 中找到的大文件夹）

> **目标盘符由 AI 主动询问用户**，不能默认假设。因为每台电脑的硬盘配置不同，用户可能想迁移到 D 盘、E 盘、F 盘或其他盘。

示例：用户说"把 `C:\Users\Administrator\AppData\Local\app_shell_cache_6383` 迁移一下"
AI 应回应："请问要迁移到哪个盘？（D/E/F...）"

## 迁移规则

### 路径映射规则

目标路径 = `{目标盘符}:\CTo{目标盘符}\` + 原 C 盘路径（去掉 `C:\`）

| 原路径                             | 目标盘符 | 目标路径                                |
| ---------------------------------- | -------- | --------------------------------------- |
| `C:\Users\Admin\AppData\Local\xxx` | D        | `D:\CToD\Users\Admin\AppData\Local\xxx` |
| `C:\ProgramData\SomeApp`           | E        | `E:\CToE\ProgramData\SomeApp`           |
| `C:\Users\Admin\.cache\pip`        | D        | `D:\CToD\Users\Admin\.cache\pip`        |

### 迁移三步骤

以迁移 `C:\Users\Administrator\AppData\Local\app_shell_cache_6383` 到 D 盘为例：

**第 1 步：使用 robocopy 完美克隆文件夹到目标盘（含权限）**

```powershell
robocopy "C:\Users\Administrator\AppData\Local\app_shell_cache_6383" "D:\CToD\Users\Administrator\AppData\Local\app_shell_cache_6383" /E /COPYALL /R:3 /W:1 /MT:8 /NP /NDL
```

> 参数说明：`/E` 包含所有子目录(含空目录)，`/COPYALL` 完美克隆所有数据、属性和NTFS权限，`/R:3` 遇到占用文件重试3次，`/W:1` 每次重试间隔1秒，`/MT:8` 开启8线程极速复制，`/NP` 不显示复制进度（减少日志），`/NDL` 不输出目录列表（减少日志）。（注：robocopy 会自动创建目标路径，无需手动新建）

**第 2 步：删除 C 盘原文件夹**

```powershell
Remove-Item -Path "C:\Users\Administrator\AppData\Local\app_shell_cache_6383" -Recurse -Force
```

> 注意：如果此步骤报错提示"文件正被使用"，说明相关软件未关闭。请彻底关闭软件后重试此命令。

**第 3 步：创建目录联接（把 C 盘路径无缝指向目标盘）**

```powershell
New-Item -ItemType Junction -Path "C:\Users\Administrator\AppData\Local\app_shell_cache_6383" -Target "D:\CToD\Users\Administrator\AppData\Local\app_shell_cache_6383"
```

> 创建联接（Junction）后，所有程序访问原来的 C 盘路径时，会自动跳转到目标盘，完全无感。

## 执行流程

当用户提供要迁移的文件夹路径后，**必须按以下流程操作**：

### 第一步：确认目标盘符（必须首先执行）

在给出任何迁移指令之前，**必须先向用户确认目标盘符**。这是最优先的操作。

**必须做的事：**

1. **询问用户目标盘符**："请问要迁移到哪个盘？（D/E/F...）"
2. **检测可用盘符**：运行以下命令获取所有可用盘符及剩余空间：

```powershell
Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{N='Used(GB)';E={[math]::Round($_.Used/1GB,1)}}, @{N='Free(GB)';E={[math]::Round($_.Free/1GB,1)}} | Format-Table -AutoSize
```

3. **检测源文件夹大小**：运行以下命令获取要迁移的文件夹大小：

```powershell
$size = (Get-ChildItem -Path "源文件夹路径" -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum; Write-Host "文件夹大小: $([math]::Round($size/1GB,2)) GB"
```

4. **向用户展示信息**，格式如下：

> **目标盘符确认：**
>
> - **待迁移文件夹大小**：12.5 GB
> - **当前可用盘符及剩余空间**：
>
> | 盘符 | 已用(GB) | 剩余(GB) |
> | ---- | -------- | -------- |
> | C    | 120.3    | 52.7     |
> | D    | 80.1     | 150.2    |
> | E    | 200.0    | 300.5    |
>
> - **目标盘符剩余空间不足时**：如果用户选择的盘符剩余空间小于源文件夹大小，**必须警告用户**并建议更换盘符。

**示例：**

> **目标盘符确认：**
>
> - 待迁移文件夹大小：**12.5 GB**
>
> | 盘符 | 已用(GB) | 剩余(GB) |
> | ---- | -------- | -------- |
> | D    | 80.1     | 150.2    |
> | E    | 200.0    | 300.5    |
>
> 请问要迁移到哪个盘？（D/E/F...）

5. **用户确认盘符后**，才进入第二步。

**注意事项：**

- 如果用户在最初的消息中已经明确指定了目标盘符（如"迁移到 E 盘"），则无需再次询问，但仍需检测盘符是否存在、剩余空间是否足够，并向用户展示确认信息。
- 如果用户选择的盘符剩余空间不足，**必须停止并建议用户更换盘符**，不能继续执行。

### 第二步：安全检查（必须执行）

在用户确认目标盘符后，**必须先分析该文件夹**，并向用户展示以下信息：

1. **文件夹用途说明**：根据路径和文件夹名称，判断该文件夹属于什么程序/功能，用通俗易懂的语言告诉用户这个文件夹是干什么的
2. **安全等级评估**：给出以下三种等级之一：
   - **安全迁移**：纯缓存/临时文件/应用数据，迁移后不会影响系统运行
   - **谨慎迁移**：部分独立软件数据，可能影响某些程序，建议彻底关闭相关程序及后台服务后再迁移
   - **禁止迁移**：系统关键文件夹/组件库，迁移后极大概率导致系统崩溃或无法启动
3. **禁止迁移的文件夹**（直接拒绝，不允许继续）：
   - `C:\Windows` 及其所有子目录
   - `C:\Program Files\Windows*` 及系统自带组件
   - `C:\Program Files (x86)\Common Files` 系统公共组件库（强行迁移会蓝屏或报错）
   - `C:\ProgramData\Package Cache` 安装包缓存（强行迁移会导致软件无法卸载/更新）
   - `C:\ProgramData\Microsoft\Windows` 系统配置
   - `C:\Users\{用户名}\NTUSER.DAT` 等注册表文件
   - `C:\Boot`、`C:\Recovery`、`C:\System Volume Information`
   - 任何与 Windows 启动/引导相关的文件夹

**示例输出格式：**

> **文件夹分析结果：**
>
> - **路径**：`C:\Users\Administrator\AppData\Local\app_shell_cache_6383`
> - **用途**：这是某应用程序的本地缓存文件夹，用于存储临时数据以加速程序加载
> - **安全等级**：🟢 安全迁移
> - **建议**：可以放心迁移，不会影响任何程序的正常使用。请确认相关软件已关闭。

### 第三步：输出迁移指令（默认不执行）

安全检查通过后，**将完整的三步命令展示给用户**，并在末尾询问是否需要代为执行。

**输出格式要求：**

1. 提醒用户：需要以**管理员身份**运行 PowerShell；必须先彻底关闭与该文件夹相关的程序及后台任务。
2. 按顺序列出三步命令（用代码块包裹）。
3. 列出验证命令。
4. 末尾询问：**"是否需要我执行以上指令？回复'执行'我将分步静默执行（日志写入文件，不回显）。"**

### 第四步：静默执行（仅在用户明确同意后）

用户明确同意执行后，按**分步静默执行**模式操作。核心原则：**输出重定向到日志文件，不回显到上下文，每步仅报告成功或失败。**

**执行规则：**

1. **每步执行前**：用一句话提示"正在执行第 X 步：[步骤描述]..."
2. **命令执行时**：将输出重定向到日志文件 `{目标盘符}:\CTo{目标盘符}\migration.log`，不回显
3. **每步执行后**：仅通过 `$?` 或退出码判断成败，用一句话报告结果
4. **如某步失败**：报告失败原因（读取日志最后一行），停止后续步骤，询问用户如何处理

**静默执行命令示例（以目标盘符 D 为例，实际应根据用户选择的盘符替换）：**

```powershell
# 第 1 步：robocopy（静默，日志写入文件）
Write-Host "正在执行第 1 步：克隆文件夹到 D 盘..."
robocopy "C:\Users\Administrator\AppData\Local\app_shell_cache_6383" "D:\CToD\Users\Administrator\AppData\Local\app_shell_cache_6383" /E /COPYALL /R:3 /W:1 /MT:8 /NP /NDL /NJH /NJS | Out-File "D:\CToD\migration.log" -Append
# robocopy 退出码 0-7 为成功，8+ 为失败
if ($LASTEXITCODE -lt 8) { Write-Host "✅ 第 1 步完成：文件夹已克隆" } else { Write-Host "❌ 第 1 步失败，退出码 $LASTEXITCODE，请查看 D:\CToD\migration.log" }
```

```powershell
# 第 2 步：删除原文件夹（静默）
Write-Host "正在执行第 2 步：删除 C 盘原文件夹..."
Remove-Item -Path "C:\Users\Administrator\AppData\Local\app_shell_cache_6383" -Recurse -Force -ErrorAction SilentlyContinue
if ($?) { Write-Host "✅ 第 2 步完成：原文件夹已删除" } else { Write-Host "❌ 第 2 步失败，可能文件被占用，请关闭相关程序后重试" }
```

```powershell
# 第 3 步：创建 Junction（静默）
Write-Host "正在执行第 3 步：创建目录联接..."
New-Item -ItemType Junction -Path "C:\Users\Administrator\AppData\Local\app_shell_cache_6383" -Target "D:\CToD\Users\Administrator\AppData\Local\app_shell_cache_6383" -ErrorAction SilentlyContinue | Out-Null
if ($?) { Write-Host "✅ 第 3 步完成：目录联接已创建" } else { Write-Host "❌ 第 3 步失败，请检查路径是否正确" }
```

### 第五步：验证联接状态

三步全部成功后，运行验证命令并报告结果：

```powershell
Get-Item "C:\Users\Administrator\AppData\Local\app_shell_cache_6383" | Select-Object Name, LinkType, Target
```

- **成功**：输出显示 `LinkType` 为 `Junction`，`Target` 指向目标盘正确路径。向用户报告"迁移成功"。
- **失败**：报告问题并建议排查方向。

## 注意事项

- **禁止迁移**：系统核心组件、公共库（如 `Common Files`）、安装缓存（如 `Package Cache`）。
  - C:\Program Files (x86)\Common Files 系统公共组件库（强行迁移会蓝屏或报错）
  - C:\ProgramData\Package Cache 安装包缓存（强行迁移会导致软件无法卸载/更新）
- **可以安全迁移**的常见大文件夹：
  - 各种应用缓存（AppData\Local 下的特定软件缓存）
  - npm/pip/maven 等包管理器缓存
  - 微信/QQ/钉钉 等聊天记录和多媒体文件
  - 游戏客户端数据
- 纯系统临时垃圾（如 `AppData\Local\Temp`）**不建议迁移**，应建议用户直接清理。
- 迁移前确保目标盘有**足够的剩余空间**。
- **必须先确认目标盘符**：不能默认使用 D 盘，必须向用户询问并检测可用盘符及剩余空间。如果用户选择的盘符剩余空间不足，必须警告并建议更换。

## 批量迁移

如果用户需要一次迁移多个文件夹，逐个按照三步骤执行即可。每个文件夹独立处理，互不影响。
