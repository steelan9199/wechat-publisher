---
name: copy-folder
description: 复制文件夹到目标位置，自动跳过所有 node_modules 目录。何时使用：当用户要求复制文件夹、拷贝目录、备份文件夹时使用，特别适用于复制包含 npm 依赖的项目文件夹。
---

# Copy Folder — 文件夹复制器

## 功能概述

将源文件夹复制到目标文件夹**内部**，自动排除所有层级的 `node_modules` 目录。

### 复制规则

- 源文件夹（含文件夹本身）会被完整复制到目标文件夹**内部**
- 例如：源 = `D:\src\js-obfuscator`，目标 = `D:\dst\skills`
  - 结果：`D:\dst\skills\js-obfuscator\...`（包含 js-obfuscator 文件夹本身）
- **自动排除**所有名为 `node_modules` 的文件夹（无论在哪一层级，无论是否在子文件夹中）
- 其他所有文件和文件夹正常复制

## 使用方法

### 参数说明

| 参数       | 说明                       |
| ---------- | -------------------------- |
| 源文件夹   | 要复制的文件夹完整路径     |
| 目标文件夹 | 复制到的目标文件夹路径     |

### 执行命令（Windows PowerShell）

使用 Windows 内置的 `robocopy` 命令，将用户提供的路径替换到下方命令中：

```powershell
$source = "<源文件夹路径>"
$target = "<目标文件夹路径>"
$folderName = Split-Path $source -Leaf
$destination = Join-Path $target $folderName
robocopy $source $destination /E /XD node_modules
```

**参数说明：**

- `/E` — 复制所有子目录（包括空目录）
- `/XD node_modules` — 排除所有名为 `node_modules` 的目录（任意层级都会被排除）

### 执行前检查

1. 确认源文件夹存在
2. 目标文件夹不存在时 `robocopy` 会自动创建，无需手动处理

### 退出码判断

`robocopy` 的退出码 **≤ 7** 均为成功：

| 退出码 | 含义           |
| ------ | -------------- |
| 0      | 无文件需要复制 |
| 1      | 文件已成功复制 |
| 2-7    | 其他成功状态   |
| ≥ 8    | 发生错误       |

## 示例

用户说："把 `D:\code-test\.trae\skills\js-obfuscator` 复制到 `D:\software\skills\.trae\skills`"

执行：

```powershell
$source = "D:\code-test\.trae\skills\js-obfuscator"
$target = "D:\software\skills\.trae\skills"
$folderName = Split-Path $source -Leaf
$destination = Join-Path $target $folderName
robocopy $source $destination /E /XD node_modules
```

结果：`js-obfuscator` 文件夹（不含任何 `node_modules`）被复制到 `D:\software\skills\.trae\skills\js-obfuscator\`

## 注意事项

- `node_modules` 排除是大小写不敏感的（Windows 特性），`Node_Modules`、`NODE_MODULES` 等都会被排除
- 如果目标路径已存在同名文件夹，`robocopy` 会进行增量合并（不会删除目标中已有的额外文件）
- 本技能仅适用于 Windows 环境（依赖 `robocopy`）
