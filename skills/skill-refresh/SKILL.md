---
name: skill-refresh
description: 刷新技能。当用户需要刷新技能时使用此技能
---

# 刷新技能

多个文件夹下都有技能

```
{
  "skill_folders": [
    "D:/software/skills/skills",
    "D:/script/work-sop/49-1-我使用的skills/skills"
  ]
}
```

## 刷新技能的操作步骤

分别切换到`skill_folders`这个数组包含的几个文件夹中, 执行代码

```PowerShell
eskill install . --link
```

## 交互式 CLI 自动化输入经验

### 问题场景

某些 CLI 工具（如 `eskill`）采用交互式界面，需要用户通过键盘输入进行选择（如按 `A` 全选、按空格选择、按回车确认）。在自动化脚本或 AI 辅助操作时需要模拟这些输入。

### 解决方案

#### 方法：使用管道传递输入

```bash
# 语法：使用括号组合多个 echo，通过管道传递给命令
(echo A && echo.) | 命令
```

#### 原理说明

| 组件     | 作用                                 |
| -------- | ------------------------------------ |
| `echo A` | 输出字符 `A`（对应全选操作）         |
| `&&`     | 连接多个命令                         |
| `echo.`  | 输出空行（模拟回车键确认）           |
| `()`     | 将多个命令组合成一个子 shell         |
| `\|`     | 管道，将组合命令的输出传递给目标命令 |

#### 实际案例

```bash
# 刷新技能 - 自动全选并确认安装
cd "D:/software/skills/skills" && (echo A && echo.) | eskill install . --link --global
```

**交互流程模拟：**

1. 第一个提示"请选择要安装的技能" → 输入 `A`（全选）
2. 第二个提示"您希望安装到哪里？" → 输入回车（确认默认选项）

### 扩展技巧

#### 1. 多步输入

```bash
# 如果有多个需要确认的步骤
(echo A && echo. && echo Y && echo.) | 命令
```

#### 2. 使用 printf（更精确控制）

```bash
# 使用 \n 明确指定换行
printf "A\n" | 命令
```

#### 3. 使用 yes 命令（适用于重复确认）

```bash
# yes 命令持续输出 y，配合 head 限制次数
yes "" | head -2 | 命令
```

> ⚠️ 注意：此方法适用于简单的 [Y/n] 确认，不适用于需要特定按键（如 A、空格）的交互

### 注意事项

1. **观察交互步骤**：先手动运行一次命令，记录每个步骤需要的输入
2. **匹配输入数量**：确保 `echo` 的数量与交互步骤数量一致
3. **空行表示回车**：`echo.` 输出空行，模拟直接按回车确认默认选项
4. **错误处理**：某些交互式工具可能检测非 TTY 环境，此时可能需要使用 `expect` 等专门工具

### 更复杂的场景

对于复杂的交互式程序，建议使用 `expect`（Linux）或 PowerShell 的 `Start-Process`（Windows）：

```powershell
# PowerShell 示例
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "eskill"
$psi.Arguments = "install . --link --global"
$psi.RedirectStandardInput = $true
$psi.UseShellExecute = $false
$process = [System.Diagnostics.Process]::Start($psi)
$process.StandardInput.WriteLine("A")
$process.StandardInput.WriteLine("")
$process.WaitForExit()
```
