# 如何使用 create-symlink 技能

## 基本使用方法

当你需要创建软链接时，可以使用以下任意一种表达方式：

### 1. 直接请求创建软链接

```
帮我创建一个软链接
创建符号链接
建立软链接
```

### 2. 指定具体需求

```
在 D:\test 目录下创建软链接指向 C:\source
创建一个目录软链接
创建文件软链接
```

### 3. 描述使用场景

```
我想在不同位置共享同一个目录
需要创建快捷方式但保持原始路径引用
想要跨目录访问文件而不复制
```

## 完整示例对话

### 示例 1：Windows 创建目录软链接

**用户说：** "帮我创建一个软链接，把 C:\tools 目录链接到 D:\shared\tools"

**系统会自动：**

1. 识别这是创建软链接的请求
2. 检测当前系统为 Windows
3. 提供正确的 PowerShell 命令：

```powershell
New-Item -ItemType SymbolicLink -Path "D:\shared\tools" -Target "C:\tools"
```

### 示例 2：macOS 创建目录软链接

**用户说：** "帮我在 macOS 上创建一个软链接，把 ~/Documents/work 链接到 ~/Desktop/work"

**系统会自动：**

1. 识别这是创建软链接的请求
2. 检测当前系统为 macOS
3. 提供正确的 bash 命令：

```bash
ln -s ~/Documents/work ~/Desktop/work
```

### 示例 3：Linux 创建文件软链接

**用户说：** "在 Linux 上创建配置文件软链接"

**系统会自动：**

1. 识别这是创建软链接的请求
2. 检测当前系统为 Linux
3. 提供相应的命令模板：

```bash
ln -s /path/to/source/config.json /path/to/destination/config.json
```

### 示例 4：创建文件软链接

**用户说：** "我想把配置文件链接到桌面"

**系统会：**

1. 应用技能并询问具体路径
2. 根据检测到的操作系统提供相应的命令模板

**Windows:**
```powershell
New-Item -ItemType SymbolicLink -Path "C:\Users\username\Desktop\config.json" -Target "D:\MyConfigs\main-config.json"
```

**macOS:**
```bash
ln -s ~/.config/app/settings.json ~/Desktop/settings.json
```

**Linux:**
```bash
ln -s /etc/myapp/config.json ~/Desktop/config.json
```

## 各平台命令对比

| 操作 | Windows (PowerShell) | Windows (CMD) | macOS / Linux |
|------|---------------------|---------------|---------------|
| 创建目录软链接 | `New-Item -ItemType SymbolicLink -Path "目标" -Target "源"` | `mklink /D "目标" "源"` | `ln -s "源" "目标"` |
| 创建文件软链接 | `New-Item -ItemType SymbolicLink -Path "目标" -Target "源"` | `mklink "目标" "源"` | `ln -s "源" "目标"` |
| 创建硬链接 | - | `mklink /H "目标" "源"` | `ln "源" "目标"` |
| 删除软链接 | `Remove-Item "链接路径"` | `rmdir "链接路径"` | `rm "链接路径"` 或 `unlink "链接路径"` |

## 验证链接是否成功

### Windows
```powershell
# 查看链接详情
Get-ChildItem "链接路径"

# 查看是否为符号链接
(Get-Item "链接路径").Attributes
```

### macOS / Linux
```bash
# 查看链接详情
ls -la "链接路径"

# 验证链接指向
readlink "链接路径"

# 查看链接和源文件
ls -la "链接路径" "源路径"
```

## 注意事项提醒

系统会在适当时候提醒你：

### 权限要求
- **Windows**: 创建软链接通常需要管理员权限（开启开发者模式可免除）
- **macOS / Linux**: 普通用户可以创建软链接，但可能需要 sudo 权限才能链接到某些系统目录

### 路径格式
- **Windows**: 使用完整路径，如 `C:\Users\name\folder` 或 `"C:\Users\name\folder"`
- **macOS / Linux**: 使用完整路径，如 `/home/user/folder` 或 `~/folder`
- 避免使用相对路径，特别是在脚本中

### 目标存在
- 源路径必须存在才能创建软链接
- 目标路径不能已存在（文件或目录）

### 删除警告
- **Windows**: 删除软链接时不要使用 `-Recurse` 参数，否则会删除源文件
- **macOS / Linux**: 删除软链接时不要使用 `-r` 参数，否则会删除源文件

## 常见使用场景

### 场景 1：迁移大文件夹并创建软链接

**Windows:**
```powershell
# 1. 移动文件夹
Move-Item "C:\LargeFolder" "D:\LargeFolder"

# 2. 创建软链接
New-Item -ItemType SymbolicLink -Path "C:\LargeFolder" -Target "D:\LargeFolder"
```

**macOS / Linux:**
```bash
# 1. 移动文件夹
mv /path/to/large/folder /new/location/folder

# 2. 创建软链接
ln -s /new/location/folder /path/to/large/folder
```

### 场景 2：统一管理配置文件

**Windows:**
```powershell
New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\.gitconfig" -Target "D:\Configs\.gitconfig"
```

**macOS / Linux:**
```bash
ln -s ~/dotfiles/.gitconfig ~/.gitconfig
```

### 场景 3：开发环境链接依赖

**Windows:**
```powershell
New-Item -ItemType SymbolicLink -Path "C:\project\node_modules" -Target "D:\shared\node_modules"
```

**macOS / Linux:**
```bash
ln -s /shared/node_modules ./project/node_modules
```
