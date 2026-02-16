# 🔄 软链接创建技能快速参考

## 📋 触发关键词

说这些话就能激活技能：

- "创建软链接"
- "建立符号链接"
- "创建 symlink"
- "链接目录"
- "创建快捷方式"
- "符号链接"

## 🖥️ 平台检测

AI 通过以下方式判断当前系统：

1. **分析路径格式**：
   - Windows: `C:\Users\...` 或 `D:\...`
   - macOS: `/Users/username/...` 或 `~/...`
   - Linux: `/home/username/...` 或 `~/...`

2. **环境变量**（如可用）：`process.platform`
   - **Windows**: `win32`
   - **macOS**: `darwin`
   - **Linux**: `linux`

3. **直接询问用户**：当无法确定时询问

## ⚡ 快速使用模板

### 创建目录软链接

**Windows:**
```powershell
New-Item -ItemType SymbolicLink -Path "目标路径" -Target "源路径"
```

**macOS / Linux:**
```bash
ln -s "源路径" "目标路径"
```

### 创建文件软链接

**Windows:**
```powershell
New-Item -ItemType SymbolicLink -Path "目标文件路径" -Target "源文件路径"
```

**macOS / Linux:**
```bash
ln -s "源文件路径" "目标文件路径"
```

## 🎯 各平台典型使用场景

### Windows 场景

| 场景         | 示例表达                             |
| ------------ | ------------------------------------ |
| 共享工具目录 | "把 C:\tools 链接到 D:\shared\tools" |
| 统一配置管理 | "创建配置文件的软链接"               |
| 开发环境设置 | "链接项目依赖目录"                   |
| 快捷访问     | "把常用目录链接到桌面"               |

### macOS 场景

| 场景         | 示例表达                             |
| ------------ | ------------------------------------ |
| 共享工作目录 | "把 ~/Documents/work 链接到 ~/Desktop" |
| 配置管理     | "创建 ~/.config 的软链接"            |
| 开发环境     | "链接 /usr/local/bin 中的工具"       |
| 快捷访问     | "把常用文件夹放到桌面"               |

### Linux 场景

| 场景         | 示例表达                             |
| ------------ | ------------------------------------ |
| 网站配置     | "链接 nginx 站点配置"                |
| 系统服务     | "创建 systemd 服务链接"              |
| 共享库       | "链接共享库文件"                     |
| 配置管理     | "统一管理 dotfiles"                  |

## 🛠️ 各平台命令速查表

| 操作 | Windows (PowerShell) | macOS / Linux |
|------|---------------------|---------------|
| **目录软链接** | `New-Item -ItemType SymbolicLink -Path "目标" -Target "源"` | `ln -s "源" "目标"` |
| **文件软链接** | `New-Item -ItemType SymbolicLink -Path "目标" -Target "源"` | `ln -s "源" "目标"` |
| **硬链接** | `mklink /H "目标" "源"` (CMD) | `ln "源" "目标"` |
| **验证链接** | `Get-ChildItem "链接路径"` | `ls -la "链接路径"` |
| **查看指向** | `(Get-Item "链接路径").Target` | `readlink "链接路径"` |
| **删除链接** | `Remove-Item "链接路径"` | `rm "链接路径"` 或 `unlink "链接路径"` |

## ⚠️ 重要提醒

### 权限要求
- **Windows**: 需要管理员权限（开发者模式可免除）
- **macOS / Linux**: 普通用户可创建，但系统目录可能需要 sudo

### 路径格式
- **Windows**: `C:\Users\name\folder` 或使用双引号包裹
- **macOS / Linux**: `/home/user/folder` 或 `~/folder`

### 删除警告
- **Windows**: 不要加 `-Recurse` 参数，会删除源文件！
- **macOS / Linux**: 不要加 `-r` 参数，会删除源文件！

## 📖 详细文档

- [USAGE.md](USAGE.md) - 完整使用指南
- [SKILL.md](SKILL.md) - 技能技术细节
