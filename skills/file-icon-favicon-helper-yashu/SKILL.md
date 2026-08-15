---
name: file-icon-favicon-helper-yashu
description: "为本地 HTML 网页文件更换文件图标（生成自定义 .ico 并创建带图标的快捷方式）和/或在网页内添加 favicon。当用户要求改图标、换图标、加 favicon、网页图标、文件图标时使用。支持三种组合：只改文件图标、只加 favicon、两者都做。注意：Windows 下单个 .html 文件本身的图标无法单独更改，技能通过创建带自定义图标的快捷方式实现，原始文件图标保持不变。"
agent_created: true
---

# 文件图标与Favicon助手

为本地 HTML 网页文件提供两类图标能力：**文件图标**（资源管理器里显示的图标）与 **网页 favicon**（浏览器标签页图标）。两类可单独做，也可合并。

## 何时使用

当用户请求包含以下任意意图时触发本技能：
- “给这个 HTML 文件改图标 / 换图标 / 换个图标 / 改文件图标”
- “给网页加 favicon / 加网页图标 / 加网站图标”
- 同时既要文件图标又要网页 favicon

由用户措辞自动判定三种模式：
1. **只改文件图标** → 生成 .ico + 创建带图标的快捷方式
2. **只加 favicon** → 在原 HTML head 标签内插入 favicon 引用
3. **两者都做** → 以上两步合并

## 重要前置认知（必须向用户说明）

- **Windows 限制**：单个 .html 文件在资源管理器里的图标由“默认打开程序”（如 Edge）决定，按扩展名统一分配，**无法单独更改某一个 .html 文件本身的图标**。因此“改文件图标”一律通过【创建带自定义图标的快捷方式】实现；原始 .html 文件图标保持不变。这是平台限制，不是操作遗漏。
- **AI 生成额度**：用 ImageGen 生成图标会消耗约 5–10 点额度，生成前必须告知用户。
- **环境差异**：在部分环境（含本沙箱）PowerShell COM 创建 .lnk 会被安全策略拦截；此时改用 .url 快捷方式（零依赖）作为兜底。在允许 COM 的环境（如用户自己的 Windows）应优先用 .lnk。
- **图标清晰度（关键）**：.lnk 与 .url 图标清晰度不同。.lnk 会按视图大小从 .ico 正确选用对应分辨率，大图标清晰；而 .url（Internet 快捷方式）在 Windows 上只提取 .ico 里的小档再放大，**超大图标下会明显模糊**。因此“改文件图标”应优先产出 .lnk，仅在无法创建 .lnk 的环境退回 .url，且必须如实告知用户：.url 图标会模糊，想要清晰请在本机生成 .lnk。

## 工作流程

### 第 1 步：判定模式并确认目标

1. 从用户请求判断模式：文件图标 / favicon / 两者。
2. 若未给出 HTML 文件路径，向用户询问完整路径。
3. 若用户已提供图标素材（.ico / .png / 图片），记录下来，跳到“第 3 步”并跳过 AI 生成。

### 第 2 步：确定图标样式（仅当需要 AI 生成时）

- 若用户**已提供**图标图片/.ico：直接使用，无需询问。
- 否则在调用 ImageGen **之前**，先问用户一句：“想要什么风格的图标？”（例如：链接/插头、齿轮、闪电、品牌色等）。拿到描述后再生成。

### 第 3 步：准备 .ico 图标

目标：在目标 HTML **同目录**生成 原名.ico（多分辨率 16/24/32/48/64/128/256）。

- 用户给的是 .ico：直接复制到 原名.ico。
- 用户给的是 .png/.jpg 或 AI 生成得到 PNG：用 scripts/png_to_ico.py 转成多分辨率 .ico。
  - 需 Pillow：在受管 Python venv 中 pip install Pillow（或复用已装 venv）。
  - 命令示例：
    ```
    python scripts/png_to_ico.py input.png 同名.ico
    ```
- 走 AI 生成：ImageGen 工具，prompt 包含用户描述的风格 + “flat app icon, suitable as Windows file icon, transparent background”，size 1024x1024，输出到目标文件同目录。生成后再用 png_to_ico.py 转 .ico。

### 第 4 步：改文件图标（模式 1 或 3）

**优先创建 .lnk（图标清晰）；仅在当前环境无法创建 .lnk 时退回 .url（图标会模糊）。**

判断方式：先尝试用 PowerShell 创建 .lnk；若被安全策略/环境拦截，则改用 scripts/make_shortcut.py 生成 .url。

**方案 A（首选）：PowerShell 创建 .lnk（清晰）**

```
powershell -Command "$ws=New-Object -ComObject WScript.Shell; $s=$ws.CreateShortcut('目标目录\名称.lnk'); $s.TargetPath='目标.html 绝对路径'; $s.IconLocation='同名.ico 绝对路径,0'; $s.Save()"
```

- 该 .lnk 显示自定义图标，按视图大小正确选用 .ico 各档分辨率，大图标清晰。
- 双击用默认浏览器打开原 HTML。

**方案 B（兜底）：生成 .url（零依赖，但图标模糊）**

```
python scripts/make_shortcut.py 目标.html 同名.ico [快捷方式名称]
```

- 在同目录生成 名称.url（省略名称时用目标文件主名）。
- 警告：.url 在超大图标下会模糊（Windows 对 .url 只取 .ico 小档放大）。**必须如实告知用户此限制**，并给出方案 A 的本机命令让其获得清晰图标。

- **向用户说明**：原始 .html 图标不变，带新图标的是这个快捷方式；若用的是 .url，明确提示其图标不如 .lnk 清晰。

### 第 5 步：加 favicon（模式 2 或 3）

在目标 HTML 的 head 标签中、title 标签之后插入一行：

```html
link rel="icon" href="同名.ico" type="image/x-icon"
```

- 若已存在 link rel="icon" ...，替换为新路径即可。
- 这样用浏览器打开网页时，标签页/地址栏显示同一枚图标。

### 第 6 步：交付说明

向用户汇总：
- 新增/修改了哪些文件（.ico、.lnk 或 .url、修改后的 .html）。
- 原始 .html 图标受 Windows 限制未变，新图标在快捷方式上。
- 若产出的是 .url，必须明确提示：其图标在超大图标下会模糊，想要清晰请在本机用 PowerShell 生成 .lnk（给出方案 A 命令）。
- 若用了 AI 生成，提示消耗了额度。

## 脚本说明

- scripts/png_to_ico.py：PNG/JPG → 多分辨率 .ico（需 Pillow）。
- scripts/make_shortcut.py：生成带自定义图标的 .url 快捷方式（零依赖，仅作无法创建 .lnk 时的兜底；图标会模糊）。

## 注意

- 不要改动原始 .html 文件的结构（favicon 仅在 head 加一行 link）。
- .ico 与快捷方式放在目标 HTML 同目录，便于相对路径引用。
- 优先 .lnk（清晰）；.url 仅兜底且图标模糊，交付时必须如实说明。
