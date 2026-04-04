---
name: move-big-folder
description: 将 C 盘大文件夹迁移到其他盘（D/E/F等），通过目录联接（Junction）保持原路径可用，释放 C 盘空间。当用户提到 C 盘空间不足、C 盘变红、迁移大文件夹、释放 C 盘空间、软链接迁移时使用此技能。Use when user mentions C drive full, move large folder, free up C drive space, symlink/junction migration.
---

# C 盘大文件夹迁移助手

> 帮助用户将 C 盘中的大文件夹安全迁移到其他盘，通过**目录联接（Junction）**让所有程序照常运行，无感释放 C 盘空间并完美保留原权限。

## 前置准备：找出 C 盘中的大文件夹

推荐使用 **磁盘快速分析软件**（免费，5 秒扫描整个 C 盘）快速定位大文件夹：

- 下载地址：https://pan.quark.cn/s/f79bdadb9716

使用方法：打开 磁盘快速分析软件 → 选择 C 盘 → 点击扫描，即可找到占空间最大的文件夹。

## 用户只需提供

用户只需要告诉你以下信息：

1. **要迁移的文件夹路径**（从 磁盘快速分析软件 中找到的大文件夹）
2. **目标盘符**（默认 D 盘，也可以是 E、F 等其他盘）

示例：用户说"把 `C:\Users\Administrator\AppData\Local\app_shell_cache_6383` 迁移到 D 盘"

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
robocopy "C:\Users\Administrator\AppData\Local\app_shell_cache_6383" "D:\CToD\Users\Administrator\AppData\Local\app_shell_cache_6383" /E /COPYALL /R:3 /W:1 /MT:8
```

> 参数说明：`/E` 包含所有子目录(含空目录)，`/COPYALL` 完美克隆所有数据、属性和NTFS权限，`/R:3` 遇到占用文件重试3次，`/W:1` 每次重试间隔1秒，`/MT:8` 开启8线程极速复制。（注：robocopy 会自动创建目标路径，无需手动新建）

**第 2 步：删除 C 盘原文件夹**

```powershell
Remove-Item -Path "C:\Users\Administrator\AppData\Local\app_shell_cache_6383" -Recurse -Force
```

> 注意：如果此步骤报错提示“文件正被使用”，说明相关软件未关闭。请彻底关闭软件后重试此命令。

**第 3 步：创建目录联接（把 C 盘路径无缝指向目标盘）**

```powershell
New-Item -ItemType Junction -Path "C:\Users\Administrator\AppData\Local\app_shell_cache_6383" -Target "D:\CToD\Users\Administrator\AppData\Local\app_shell_cache_6383"
```

> 创建联接（Junction）后，所有程序访问原来的 C 盘路径时，会自动跳转到目标盘，完全无感。

## 执行流程

当用户提供要迁移的文件夹路径后，**必须按以下流程操作**：

### 第一步：安全检查（必须执行）

在执行任何迁移操作之前，**必须先分析该文件夹**，并向用户展示以下信息：

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
>
> 是否确认迁移？

### 第二步：用户二次确认

安全检查通过后，**必须等待用户明确确认**后才能执行迁移。将完整的三步命令展示给用户，让用户确认后再逐步执行。

### 第三步：执行迁移

确认后，按迁移三步骤依次执行：

1. **提醒用户**：
   - 需要以**管理员身份**运行 PowerShell。
   - 必须先彻底关闭与该文件夹相关的程序及后台任务。
   - 迁移大文件夹可能需要一些时间，请耐心等待。
2. **逐步执行**：按三步骤依次执行，每步执行后确认结果。
3. **验证结果**：最后检查目录联接是否创建成功。

## 验证联接状态

迁移完成后，运行以下命令验证：

```powershell
Get-Item "C:\Users\Administrator\AppData\Local\app_shell_cache_6383" | Select-Object Name, LinkType, Target
```

输出应显示 `LinkType` 为 `Junction`，`Target` 指向目标盘的正确路径。

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

## 批量迁移

如果用户需要一次迁移多个文件夹，逐个按照三步骤执行即可。每个文件夹独立处理，互不影响。
