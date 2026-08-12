---
name: move-big-folder-yashu
description: 将 C 盘大文件夹迁移到其他盘（D/E/F等），通过符号链接（Symbolic Link）保持原路径可用，释放 C 盘空间。当用户提到
  C 盘空间不足、C 盘变红、迁移大文件夹、释放 C 盘空间、软链接迁移时使用此技能。Use when user mentions C drive full,
  move large folder, free up C drive space, symlink migration.
disable-model-invocation: false
---

# C 盘大文件夹迁移助手

> 帮助用户将 C 盘中的大文件夹安全迁移到其他盘，通过**符号链接（Symbolic Link）**让所有程序照常运行，无感释放 C 盘空间并完美保留原权限。

## 核心原则

> **默认只输出指令，并推荐用户手动执行；AI 绝不主动运行任何迁移/删除命令。** 给出指令后，优先建议用户在管理员 PowerShell 中手动执行；AI 代执行仅作为例外——必须**同时满足**：①用户**显式授权**（明确说"执行"）；②用户**确认风险**（确认已关闭相关程序、已知晓迁移会删除 C 盘原文件夹、有误删系统文件风险、已自行备份）。用户授权后，**必须先按第四步 4.0 把即将执行的全部命令逐字贴出并逐项说明作用（尤其标明哪条会删除 C 盘的哪个精确路径），询问用户是否允许；用户回复"可以"后才可静默执行**（输出重定向到日志文件），避免大量日志占用上下文、浪费 token。未经"可以"确认，绝不直接执行。

## 工具通道与环境约束（重要，先读）

本技能在 AI 替你跑「检测 / 验证」时会用到系统工具。**通道优先级与护栏如下，务必遵守，避免反复重试白烧 token：**

1. **检测（盘符剩余空间、文件夹大小）一律优先用 Bash（Git Bash）：**
   - 剩余空间：`df -h /c /d`（或 `df -h` 看全部盘符）
   - 文件夹大小：`du -sh "<Git Bash 风格路径>"`（如 `du -sh "/c/Users/Administrator/AppData/Local/Programs/Apifox"`）
   - Windows 路径 `/c/...` 的对应关系：`C:\xxx` → `/c/xxx`，`D:\xxx` → `/d/xxx`。
2. **PowerShell 不预设可用/不可用，以实际执行为准：** 某些环境里 PowerShell 工具可能吞掉 stdout 或不回显，也可能正常工作。**不要假设它一定失败**，但**默认先试 Bash**；若 Bash 某次也无回显，再退 PowerShell 实测一次。
3. **护栏（防 token 浪费）：** 若某次工具调用**返回空 stdout 但退出码正常（疑似被沙箱吞输出）**，**立即换另一通道重试一次即可**；**严禁对同一通道、同一命令反复重试**。换通道后仍无输出，直接如实告知用户"无法自动探测，请手动提供盘符剩余空间与文件夹大小"，不要死循环。
4. **迁移 / 验证命令本身是 Windows 原生命令**（`robocopy` / `Remove-Item` / `New-Item`），按规范由**用户在管理员 PowerShell 手动执行**；若用户授权由 AI 代执行，**优先直接用 PowerShell 通道执行**（robocopy / Remove-Item / New-Item 在 PowerShell 中原生可用），不再通过 Bash 调用 `cmd /c`，且判定成败只看**退出码/日志文件**，不依赖工具回显。

## 前置准备：找出 C 盘中的大文件夹

推荐使用 **磁盘快速分析软件**（免费，5 秒扫描整个 C 盘）快速定位大文件夹：

- 下载地址：https://pan.quark.cn/s/a44858fa8287

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

**第 3 步：创建符号链接（把 C 盘路径无缝指向目标盘）**

```powershell
New-Item -ItemType SymbolicLink -Path "C:\Users\Administrator\AppData\Local\app_shell_cache_6383" -Target "D:\CToD\Users\Administrator\AppData\Local\app_shell_cache_6383"
```

> 创建符号链接（SymbolicLink）后，所有程序访问原来的 C 盘路径时，会自动跳转到目标盘，完全无感。

## 执行流程

当用户提供要迁移的文件夹路径后，**必须按以下流程操作**：

### 第一步：确认目标盘符（必须首先执行）

在给出任何迁移指令之前，**必须先向用户确认目标盘符**。这是最优先的操作。

**必须做的事：**

1. **询问用户目标盘符**："请问要迁移到哪个盘？（D/E/F...）"
2. **检测可用盘符**：**优先用 Bash（Git Bash）** 获取盘符剩余空间（Windows 路径 `C:\` 在 Git Bash 中写作 `/c/`）：

```bash
df -h /c /d
# 想看全部盘符可去掉参数： df -h
```

> 若 Bash 无回显，按「工具通道与环境约束」退 PowerShell 实测一次：`Get-PSDrive -PSProvider FileSystem | Select-Object Name,@{N='FreeGB';E={[math]::Round($_.Free/1GB,1)}}`。**禁止同一通道反复重试。**

3. **检测源文件夹大小**：**优先用 Bash** 获取文件夹大小（把 `C:\...` 写成 `/c/...`）：

```bash
du -sh "/c/Users/Administrator/AppData/Local/Programs/Apifox"
```

> 若 Bash 无回显，退 PowerShell 实测一次：`(Get-ChildItem -Path "源文件夹路径" -Recurse -File -EA SilentlyContinue | Measure-Object -Property Length -Sum).Sum`。

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
   - 输入法相关文件夹（如 `*WeType*`、`*Sogou*`、`*InputMethod*`、`*IME*` 等）：输入法通过 TSF 注入到几乎所有进程中，文件被大量进程锁定，极难彻底关闭，迁移后大概率因无法删除原文件而失败，不建议迁移

**示例输出格式：**

> **文件夹分析结果：**
>
> - **路径**：`C:\Users\Administrator\AppData\Local\app_shell_cache_6383`
> - **用途**：这是某应用程序的本地缓存文件夹，用于存储临时数据以加速程序加载
> - **安全等级**：🟢 安全迁移
> - **建议**：可以放心迁移，不会影响任何程序的正常使用。请确认相关软件已关闭。

### 第三步：输出迁移指令（默认不执行，推荐手动）

安全检查通过后，**将完整的三步命令展示给用户**，并**优先推荐用户手动执行**。

**输出格式要求：**

1. 提醒用户：需要以**管理员身份**运行 PowerShell；必须先彻底关闭与该文件夹相关的程序及后台任务。
2. 按顺序列出三步命令（用代码块包裹）。
3. 列出验证命令。
4. 末尾明确推荐手动执行，并仅在用户显式授权+确认风险后才可代执行。推荐话术：
   > **建议你在管理员 PowerShell 中手动执行以上命令（最安全、可控）。**
   > 如需我代执行，请先明确回复 **"执行"**，并确认以下两点：
   > ① 已彻底关闭与该文件夹相关的程序及后台任务；
   > ② 已知晓迁移会**删除 C 盘原文件夹**、命令有误可能**误删系统文件**，且已自行备份重要数据。
   > 未同时满足"授权"与"风险确认"，我一律只给命令、不执行。

### 第四步：执行前预览 + 静默执行（仅当用户显式授权且确认风险后）

**硬门槛（不满足则一律不执行）：** 必须同时满足 ①用户明确说"执行"（显式授权）；②用户已确认风险（关闭相关程序 + 知晓误删系统文件风险 + 已备份）。缺任一条件，AI 必须停止，继续只输出命令。

满足门槛后，**禁止直接执行**，必须先完成「4.0 执行前预览与二次确认」，收到用户"可以"后，才进入「4.1 静默执行」。

#### 4.0 执行前预览与二次确认（强制，消除用户焦虑）

用户看不见 AI 实际运行的命令，容易担心 AI 误删 C 盘其他文件、破坏系统。因此**执行前必须把将要运行的每一条命令完整贴出，并逐项写明作用，然后明确询问用户是否允许执行，用户回复"可以"后才可执行。在收到"可以"之前，一律不得执行任何命令。**

**强制要求：**

1. **逐条贴出全部命令**（用代码块，与即将执行的内容逐字一致，不得省略、不得用"…"代替）。
2. **逐条写明作用**，尤其要说明：
   - 哪一条是**复制/克隆**（只读取并写入新位置，不破坏任何文件）；
   - 哪一条是**删除 C 盘原文件夹**（明确标注：只删除 `C:\本次迁移的精确路径` 这一个文件夹，绝不会碰 C 盘其他任何文件或系统目录）；
   - 哪一条是**创建符号链接**（不改变任何文件内容，只新建一个"指向"）。
3. **明确标注删除命令的精确作用域**，例如："下面第 2 条命令只会删除 `C:\Users\test001` 这一个文件夹，不会删除 `C:\Windows`、`C:\Program Files` 或任何其他路径。" 用一句话直接安抚"误删焦虑"。
4. **结尾必须显式询问**："以上是我即将执行的全部命令及作用，是否允许我执行？请回复 **'可以'**，我才开始执行。" 只能等待用户明确说"可以"，不得自行推断或默认放行。
5. **预览命令必须与最终执行命令完全一致**，预览后不得临时新增、修改或扩大任何删除类命令的作用域。

**预览示例（以迁移 `C:\Users\test001` 到 D 盘为例）：**

以下是我即将执行的全部命令，共 3 条：

```powershell
# 第 1 条（仅复制，不破坏任何文件）：把 C 盘源文件夹完整克隆到 D 盘
robocopy "C:\Users\test001" "D:\CToD\Users\test001" /E /COPYALL /R:3 /W:1 /MT:8 /NP /NDL
```

> 作用：把 `C:\Users\test001` 里的所有内容**复制**一份到 `D:\CToD\Users\test001`。这是纯读取+写入新位置，不会删除或修改 C 盘上的任何文件。

```powershell
# 第 2 条（删除 C 盘原文件夹）：只删除下面这一个精确路径
Remove-Item -Path "C:\Users\test001" -Recurse -Force
```

> 作用：**仅删除 `C:\Users\test001` 这一个文件夹**，不会触及 C 盘其他任何路径（如 `C:\Windows`、`C:\Program Files` 等），更不会碰其他盘。这是迁移中唯一会改动 C 盘的步骤，作用域被严格限定在这一个路径。

```powershell
# 第 3 条（创建符号链接，不改动任何文件内容）：让原路径无缝指向 D 盘
New-Item -ItemType SymbolicLink -Path "C:\Users\test001" -Target "D:\CToD\Users\test001"
```

> 作用：在原路径 `C:\Users\test001` 处新建一个"快捷方式"（符号链接），指向 D 盘新位置。程序访问原路径时会自动跳转到 D 盘，完全无感。此步不删除、不修改任何文件内容。

**请确认：以上命令是否允许我执行？回复"可以"后我才开始执行。**

#### 4.1 静默执行

收到用户"可以"后，按**分步静默执行**模式操作。核心原则：**输出重定向到日志文件，不回显到上下文，每步仅报告成功或失败。**

**执行规则（同时遵守「工具通道与环境约束」）：**

1. **每步执行前**：用一句话提示"正在执行第 X 步：[步骤描述]..."
2. **命令执行时**：**优先直接用 PowerShell 通道执行**（robocopy / Remove-Item / New-Item 在 PowerShell 中原生可用），**避免通过 Bash 调用 `cmd /c`**——是否会被安全策略拦截以实际环境为准（部分环境会报 `Command blocked for security: Invoking cmd.exe from Bash bypasses all command validation`），故优先走 PowerShell 通道更稳妥；输出重定向到日志文件 `{目标盘符}:\CTo{目标盘符}\migration.log`，不回显。**禁止对同一通道反复重试**。执行的命令必须与 4.0 预览中贴出的命令**路径与参数完全一致**，不得临时变更或新增删除类命令。
3. **每步执行后**：仅通过**退出码 / 日志文件**判断成败，用一句话报告结果；**绝不要依赖工具 stdout 是否回显**来判定成败（沙箱可能吞输出，但命令实际已执行）。
4. **如某步失败**：报告失败原因（读取日志最后一行），停止后续步骤，询问用户如何处理

**静默执行命令示例（以目标盘符 D 为例，实际应根据用户选择的盘符替换，且必须与 4.0 预览一致）：**

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
# 第 3 步：创建 SymbolicLink（静默）
Write-Host "正在执行第 3 步：创建符号链接..."
New-Item -ItemType SymbolicLink -Path "C:\Users\Administrator\AppData\Local\app_shell_cache_6383" -Target "D:\CToD\Users\Administrator\AppData\Local\app_shell_cache_6383" -ErrorAction SilentlyContinue | Out-Null
if ($?) { Write-Host "✅ 第 3 步完成：符号链接已创建" } else { Write-Host "❌ 第 3 步失败，请检查路径是否正确" }
```

### 第五步：验证符号链接状态

三步全部成功后，运行验证命令并报告结果：

```powershell
Get-Item "C:\Users\Administrator\AppData\Local\app_shell_cache_6383" | Select-Object Name, LinkType, Target
```

> Bash 通道同样可验证（不依赖 PS 回显）：`ls -la "/c/Users/Administrator/AppData/Local/"` —— 若 `app_shell_cache_6383` 显示为指向 `D:\CToD\...` 的软链接即成功。

- **成功**：输出显示 `LinkType` 为 `SymbolicLink`，`Target` 指向目标盘正确路径（或 Bash 下 `ls -la` 显示软链接箭头）。向用户报告"迁移成功"。
- **失败**：报告问题并建议排查方向。

## 注意事项

- ⚠️ **迁移命令有删除 C 盘文件的风险**：本技能第 2 步会**删除 C 盘原文件夹**，任何路径填错或程序误判都可能**误删系统文件**，后果不可逆。因此默认**只给命令、推荐手动**，AI 绝不在未获显式授权+风险确认、且未经第四步 4.0 预览并获用户"可以"确认时执行。执行前请务必核对路径、关闭相关程序、备份重要数据。
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
- **符号链接权限要求**：创建符号链接（SymbolicLink）必须以**管理员身份**运行 PowerShell；否则第 3 步会报"拒绝访问"或"客户端没有所需的特权"。若不想每次都用管理员，可在「设置 → 隐私和安全性 → 开发者选项」中开启「开发人员模式」，开启后普通用户也能创建符号链接。
- **必须先确认目标盘符**：不能默认使用 D 盘，必须向用户询问并检测可用盘符及剩余空间。如果用户选择的盘符剩余空间不足，必须警告并建议更换。
- **工具通道护栏（防 token 浪费）**：检测 / 验证一律**优先 Bash**（`df -h`、`du -sh`、`ls -la`）；PowerShell 不预设可用/不可用，以实际执行为准。若某次工具调用**空 stdout 但退出码正常（疑似被沙箱吞输出）**，**只换通道重试一次**，**严禁对同一通道同一命令反复重试**；两次都无输出则如实请用户手动提供数据。
- **符号链接权限要求**：创建符号链接（SymbolicLink）必须以**管理员身份**运行 PowerShell（用 `New-Item -ItemType SymbolicLink`）；否则第 3 步会报"拒绝访问"。若不想每次都用管理员，可在「设置 → 隐私和安全性 → 开发者选项」中开启「开发人员模式」，开启后普通用户也能创建符号链接。

## 批量迁移

如果用户需要一次迁移多个文件夹，逐个按照三步骤执行即可。每个文件夹独立处理，互不影响。
