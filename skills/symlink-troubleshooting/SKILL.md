---
name: "symlink-troubleshooting"
description: "符号链接(Symlink)导致脚本运行失败的跨平台排查与修复指南。当任何技能运行 Node.js/Python/Shell 脚本时出现 ENOENT、realpathSync、lstat、No such file or directory、FileNotFoundError 等符号链接相关错误，立即查阅本技能文档获取根因分析和解决方案。支持 Windows/macOS/Linux。"
---

# 符号链接故障排查与修复指南（跨平台）

在 Windows、macOS、Linux 系统中，技能脚本目录可能位于符号链接（Symbolic Link / Junction）路径下。部分运行时在启动阶段会调用 `realpath` 递归解析符号链接为物理路径，当符号链接目标不可达、权限不足、或存在路径虚拟化层时，解析失败导致脚本无法启动。本文档帮助 AI 快速识别此类问题并应用对应平台+运行时的修复方案。

## 路径占位符约定

本文档使用以下占位符表示路径，AI 在实际执行时应替换为当前环境中的真实路径：

| 占位符 | 含义 | 示例 |
|---|---|---|
| `<symlink-path>` | 符号链接路径（问题路径） | `/home/user/.skills` 或 `C:\Users\user\.trae-cn` |
| `<real-path>` | 符号链接指向的真实物理路径 | `/data/ctod/skills` 或 `D:\CToD\...` |
| `<skill-dir>` | 技能脚本所在目录 | `<symlink-path>/skills/<skill-name>/scripts` |
| `<script>` | 脚本文件名 | `get-root-folder-meta.js` |
| `<params>` | 参数文件绝对路径 | `/tmp/params.json` |

---

## 各平台符号链接类型概览

| 平台 | 符号链接类型 | 创建命令 | 典型问题场景 |
|---|---|---|---|
| Windows | Symbolic Link | `New-Item -ItemType SymbolicLink` | 路径虚拟化层（如沙箱/容器）导致 `lstat` 失败 |
| Windows | Junction (目录连接) | `mklink /J` | Node.js `realpathSync` 无法穿透 Junction |
| macOS | Symbolic Link | `ln -s` | Gatekeeper Translocation 导致路径随机化 |
| macOS | Translocation 路径 | （系统自动生成） | `/private/var/folders/.../AppTranslocation/...` |
| Linux | Symbolic Link | `ln -s` | 容器挂载路径与宿主机路径不一致 |
| Linux | Bind Mount | `mount --bind` | `realpath` 解析到宿主机路径 |

---

## 诊断流程

### 第 1 步：识别错误特征

当技能脚本运行失败时，检查错误输出是否包含以下**任一**关键词：

| 关键词 | 出现位置 | 运行时 |
|---|---|---|
| `ENOENT: no such file or directory, lstat` | Node.js 崩溃栈 | Node.js |
| `realpathSync` | Node.js 崩溃栈 | Node.js |
| `toRealPath` / `Function._findPath` | Node.js 崩溃栈 | Node.js |
| `resolveMainPath` / `executeUserEntryPoint` | Node.js 崩溃栈 | Node.js |
| `Cannot find module` + 符号链接路径 | Node.js 模块加载 | Node.js |
| `FileNotFoundError` + 符号链接路径 | Python 异常 | Python |
| `No such file or directory` + 符号链接路径 | Python / Shell 异常 | Python / Bash / Zsh |
| `No such file or directory` + 路径 | Shell `realpath` 错误 | Bash / Zsh |

### 第 2 步：确认是否为符号链接问题

#### Windows（PowerShell）

```powershell
# 检查路径是否为符号链接/Junction
Get-Item '<symlink-path>' -Force | Select-Object Name, LinkType, Target | Format-List

# 检查 Test-Path 结果不一致（根节点 False 但子文件 True = 符号链接问题）
Test-Path '<symlink-path>'
Test-Path '<symlink-path>\skills\<skill-name>\scripts\<script>'

# 如果根节点 Test-Path 返回 False，但深层文件返回 True，则确认为符号链接问题
```

#### macOS / Linux（Bash / Zsh）

```bash
# 检查路径是否为符号链接
ls -la '<symlink-path>'

# 查看符号链接指向的真实路径
readlink '<symlink-path>'
readlink -f '<symlink-path>'  # 递归解析到最终物理路径

# 检查路径类型
file '<symlink-path>'

# macOS: 检查是否处于 Translocation 路径（路径中包含 AppTranslocation）
echo "$0" | grep -q "AppTranslocation" && echo "处于 Translocation 路径"
```

### 诊断结论规则

满足以下**任一**条件即可确认为符号链接问题：

| 条件 | 平台 |
|---|---|
| `Test-Path` 对符号链接根节点返回 `False`，但对深层文件返回 `True` | Windows |
| `Get-Item` 的 `LinkType` 为 `SymbolicLink` 或 `Junction` | Windows |
| `ls -la` 输出以 `l` 开头（表示符号链接） | macOS / Linux |
| `readlink` 能输出目标路径，但 `realpath` 失败或返回不一致路径 | macOS / Linux |
| `Get-Content` / `cat` 能读到文件内容，但运行时在启动阶段崩溃 | 全平台 |
| 路径中包含 `AppTranslocation` | macOS |

### 第 3 步：根据运行时选择解决方案

根据当前使用的运行时（Node.js / Python / Shell），跳转到对应章节。所有解决方案均跨平台适用，命令中的路径分隔符按当前系统调整即可。

---

## Node.js 解决方案

### 问题根因

Node.js 启动时默认调用 `fs.realpathSync()` 将主模块路径中的符号链接递归解析为最终物理路径。当符号链接目标不可达（权限、虚拟化层、容器边界）时，`realpathSync` 在 `lstat` 阶段抛出 `ENOENT`，脚本根本无法启动。

此问题在以下场景常见：
- Windows 路径虚拟化环境（沙箱、容器、Junction 链）
- macOS Translocation 路径（Gatekeeper 随机化路径）
- Linux 容器内访问宿主机符号链接

### 典型错误输出

```
Error: ENOENT: no such file or directory, lstat '<symlink-path>'
    at Object.realpathSync (node:fs:xxxx:xx)
    at toRealPath (node:internal/modules/helpers:xx:xx)
    at Function._findPath (node:internal/modules/cjs/loader:xxx:xx)
    at resolveMainPath (node:internal/modules/run_main:xx:xx)
    at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:xxx:xx) {
  errno: -2,
  code: 'ENOENT',
  syscall: 'lstat',
  path: '<symlink-path>'
}
```

> Windows 上 `errno` 为 `-4058`，macOS/Linux 上为 `-2`，均为 `ENOENT`。

### 修复方案：使用 `--preserve-symlinks` 标志

```bash
# macOS / Linux
node --preserve-symlinks-main --preserve-symlinks '<skill-dir>/<script>' --parameter-file-path '<params>'

# Windows (PowerShell)
node --preserve-symlinks-main --preserve-symlinks '<skill-dir>\<script>' --parameter-file-path '<params>'
```

### 标志说明

| 标志 | 作用 | 重要性 |
|---|---|---|
| `--preserve-symlinks-main` | 主模块（入口脚本）路径不调用 `realpathSync`，保留符号链接路径原样 | **必须** — 解决启动崩溃 |
| `--preserve-symlinks` | 所有 `require()` / `import` 的依赖模块也跳过符号链接解析 | **必须** — 解决依赖加载失败 |

> 两者缺一不可：前者管主模块，后者管依赖模块。仅用其一可能仍会报错。

### 命令对比

```bash
# 原始方式（失败）— cd 后运行相对路径
cd '<skill-dir>'
node <script> --parameter-file-path '<params>'

# 修复方式（成功）— 绝对路径 + 两个标志，cwd 设为脚本目录
node --preserve-symlinks-main --preserve-symlinks '<skill-dir>/<script>' --parameter-file-path '<params>'
```

### 注意事项

1. **脚本路径必须用绝对路径**：`--preserve-symlinks-main` 作用于主模块路径解析，相对路径可能不被正确处理
2. **cwd 仍需设为脚本目录**：脚本内部可能用相对路径读取同目录的依赖（如 `utils.js`），设置 cwd 确保模块解析正常
3. **不要尝试复制脚本到其他目录**：这会破坏技能的完整性和可维护性，`--preserve-symlinks` 是 Node.js 官方标准方案
4. **Node.js 版本兼容性**：`--preserve-symlinks` 从 Node.js 6.2.0 起支持，`--preserve-symlinks-main` 从 Node.js 10.0.0 起支持
5. **路径分隔符**：Windows 上 Node.js 同时接受 `/` 和 `\`，但建议参数文件路径统一用 `/`（部分脚本内部用正则匹配路径）

---

## Python 解决方案

### 问题根因

Python 在导入模块或执行脚本时，`sys.path` 和 `__file__` 解析可能触发符号链接解析。与 Node.js 类似，不可达的符号链接目标可能导致 `FileNotFoundError`。

### 典型错误输出

```
# macOS / Linux
FileNotFoundError: [Errno 2] No such file or directory: '<symlink-path>/...'

# Windows
FileNotFoundError: [WinError 3] The system cannot find the path specified: '<symlink-path>\\...'
```

### 修复方案

按优先级尝试以下方案：

**方案 1：使用 Python 的 `-P` 标志（Python 3.11+）**

```bash
# macOS / Linux
python3 -P '<skill-dir>/<script>' --parameter-file-path '<params>'

# Windows
python -P '<skill-dir>\<script>' --parameter-file-path '<params>'
```

`-P` 标志阻止 Python 将脚本目录自动加入 `sys.path`，减少路径解析。

**方案 2：设置环境变量绕过路径解析**

```bash
# macOS / Linux
export PYTHONSAFEPATH=1
python3 '<skill-dir>/<script>' --parameter-file-path '<params>'

# Windows (PowerShell)
$env:PYTHONSAFEPATH = "1"
python '<skill-dir>\<script>' --parameter-file-path '<params>'
```

`PYTHONSAFEPATH=1` 等效于 `-P` 标志，适用于 Python 3.11+。

**方案 3：脚本内部替换 `realpath` 为 `abspath`**

如果脚本内部使用了 `os.path.realpath()` 导致失败，可在脚本入口处替换为 `os.path.abspath()`（不解析符号链接）。但此方案需要修改脚本代码，仅在方案 1 和 2 无效时使用。

```python
# 失败 — realpath 解析符号链接失败
real_path = os.path.realpath(__file__)

# 修复 — abspath 不解析符号链接
real_path = os.path.abspath(__file__)
```

---

## Shell 解决方案

### Bash / Zsh（macOS / Linux）

#### 问题根因

Shell 脚本中使用 `readlink -f` / `realpath` 解析符号链接时，如果目标路径不可达，命令返回空或报错。此外，`cd` 到符号链接路径后 `$PWD` 可能是符号链接路径也可能是物理路径，取决于 `set -P` 是否启用。

#### 典型错误输出

```bash
realpath: '<symlink-path>': No such file or directory
# 或
readlink: '<symlink-path>': No such file or directory
```

#### 修复方案

**方案 1：避免使用 `realpath` / `readlink -f`，改用 `cd` + `pwd`**

```bash
# 失败 — realpath 解析符号链接失败
SCRIPT_DIR="$(realpath "$(dirname "$0")")"

# 修复 — 使用 cd + pwd，不解析符号链接
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
```

**方案 2：使用 `readlink` 不带 `-f`（仅解析一层）**

```bash
# 仅解析一层符号链接，不递归到最终物理路径
LINK_TARGET="$(readlink "<symlink-path>")"
```

### PowerShell（Windows）

#### 问题根因

PowerShell 本身通常能正确穿透符号链接，但在以下场景可能出问题：
- PowerShell 脚本内调用其他运行时（如 `Start-Process node`）时，路径传递可能丢失上下文
- `Resolve-Path` 在某些情况下可能无法解析符号链接根节点

#### 典型错误输出

```powershell
Resolve-Path : Cannot find path '<symlink-path>' because it does not exist.
```

#### 修复方案

**方案 1：避免使用 `Resolve-Path`，改用 `Get-Item`**

```powershell
# 失败
$realPath = Resolve-Path '<symlink-path>'

# 修复 — Get-Item 能穿透符号链接
$item = Get-Item '<symlink-path>' -Force
$realPath = $item.FullName
```

**方案 2：使用 `-PSPath` 参数绕过路径验证**

```powershell
# 直接使用符号链接路径，PowerShell 会自动处理
Get-Content -PSPath '<symlink-path>\config.json'
```

---

## 通用最佳实践

### 1. 技能脚本调用模板

当调用任何技能的脚本时，**统一使用以下模板**，避免符号链接问题：

```bash
# Node.js（全平台通用）
node --preserve-symlinks-main --preserve-symlinks '<skill-dir>/<script>' --parameter-file-path '<params>'

# Python（全平台通用，Python 3.11+）
python3 -P '<skill-dir>/<script>' --parameter-file-path '<params>'
# 或 Windows
python -P '<skill-dir>\<script>' --parameter-file-path '<params>'
```

### 2. 诊断检查清单

遇到脚本运行失败时，按以下顺序排查：

| 步骤 | 检查项 | Windows 命令 | macOS / Linux 命令 |
|---|---|---|---|
| 1 | 错误信息是否包含 `ENOENT` / `lstat` / `realpathSync` | 查看错误输出 | 查看错误输出 |
| 2 | 路径是否为符号链接 | `Get-Item '<path>' -Force \| Select-Object LinkType, Target` | `ls -la '<path>'` |
| 3 | 根节点与深层文件 Test-Path 结果是否不一致 | `Test-Path '<symlink-path>'` vs `Test-Path '<deep-file>'` | `test -d '<symlink-path>'` vs `test -f '<deep-file>'` |
| 4 | 文件内容是否可读 | `Get-Content '<file>' -TotalCount 3` | `head -3 '<file>'` |
| 5 | 符号链接指向的真实路径 | `(Get-Item '<path>' -Force).Target` | `readlink '<path>'` |

### 3. 不建议的做法

| 不建议 | 原因 | 正确做法 |
|---|---|---|
| 复制脚本到其他目录运行 | 破坏技能完整性，更新后不同步 | 使用 `--preserve-symlinks` 标志 |
| 删除或重建符号链接 | 可能破坏环境结构，影响其他功能 | 让运行时跳过符号链接解析 |
| 修改技能脚本源码绕过路径 | 脚本可能被混淆或受版本管理 | 在运行时层面解决 |
| 用 `realpath` / `Resolve-Path` 强制解析 | 在符号链接目标不可达时必然失败 | 用 `pwd` / `Get-Item` 替代 |

### 4. 错误处理流程

```
脚本运行失败
    ↓
检查错误信息是否包含 ENOENT/lstat/realpathSync/FileNotFoundError
    ├── 是 → 确认为符号链接问题 → 查阅本文档对应运行时的解决方案
    └── 否 → 查阅对应技能的错误处理文档
```

---

## 实战案例

### 案例 1：Windows + Node.js + 路径虚拟化

**环境**：Windows，技能目录位于 Junction/虚拟化路径下

**问题**：按技能文档推荐方式执行脚本：

```powershell
cd '<skill-dir>'
node <script> --parameter-file-path '<params>'
```

Node.js 崩溃：`ENOENT: no such file or directory, lstat '<symlink-path>'`

**诊断**：

- `Test-Path '<symlink-path>'` → `False`
- `Test-Path '<skill-dir>\<script>'` → `True`
- `Get-Content` 能读取脚本内容
- 结论：Node.js `realpathSync` 无法穿透符号链接根节点

**解决**：

```powershell
node --preserve-symlinks-main --preserve-symlinks '<skill-dir>\<script>' --parameter-file-path '<params>'
```

脚本成功启动并执行。

### 案例 2：macOS + Node.js + Translocation

**环境**：macOS，应用被 Gatekeeper Translocation 到临时路径

**问题**：脚本路径变为 `/private/var/folders/.../AppTranslocation/.../skills/<skill-name>/scripts/<script>`，Node.js 启动时 `realpathSync` 解析该临时路径失败。

**诊断**：

- `echo "$0" | grep "AppTranslocation"` → 匹配到 Translocation 路径
- `readlink "$0"` → 输出原始路径
- 结论：macOS Translocation 导致路径随机化，`realpathSync` 失败

**解决**：

```bash
node --preserve-symlinks-main --preserve-symlinks '<skill-dir>/<script>' --parameter-file-path '<params>'
```

### 案例 3：Linux + Python + 容器挂载路径

**环境**：Linux 容器内，技能目录通过 bind mount 挂载

**问题**：Python 脚本执行时 `os.path.realpath(__file__)` 解析到宿主机路径，该路径在容器内不存在：

```
FileNotFoundError: [Errno 2] No such file or directory: '/host/path/skills/...'
```

**诊断**：

- `readlink -f /skill-dir` → 返回宿主机路径
- `test -d /host/path/skills/...` → `False`（容器内不可达）
- 结论：`realpath` 解析到容器外路径

**解决**：

```bash
export PYTHONSAFEPATH=1
python3 '<skill-dir>/<script>' --parameter-file-path '<params>'
```

或修改脚本中 `os.path.realpath` 为 `os.path.abspath`。
