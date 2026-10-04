---
name: windows-font-finder-yashu
description: 查找 Windows 上已安装的字体。列出系统全部字体，或按关键字中英文过滤，输出字体文件名、注册表显示名、CSS family 名与完整路径。当用户问"我电脑上有哪些字体""装了什么字体""有没有 XX 字体""这个字体叫什么名字""配图/海报/PPT 该用什么字体"，或需要确认某个字体是否已安装（尤其确认霞鹜文楷、阿里巴巴普惠体等开源字体能否使用）时使用。也用于排查字体渲染问题：字体没生效、font-family 写了不生效、字体乱码。
disable-model-invocation: false
---

# Windows 字体查找

用脚本列出 Windows 已安装字体，并给出**可直接写进 CSS 的 family 名**。

## 一、快速开始

脚本位置：`scripts/list_fonts.py`（纯标准库，无需 pip 安装）

```bash
# 查某个字体是否装了（推荐中英文都能用）
python scripts/list_fonts.py --kw "霞鹜"

# 列出全部字体
python scripts/list_fonts.py

# 输出 JSON，给程序消费
python scripts/list_fonts.py --json

# 跳过 TTF 内部解析，速度快 3-5 倍
python scripts/list_fonts.py --kw "霞鹜" --no-parse
```

**结果一律写入文件**（默认当前目录 `fonts_report.txt`），
然后用 Read 工具读那个文件。**不要只依赖 stdout 回显**。

Windows 解释器路径（本机）：
`D:\software\uv\python\cpython-3.14.7-windows-x86_64-none\python.exe`
（其他机器用 `python` 即可；有虚拟环境时见 `shared-python-env-yashu` 技能）

## 二、每条字体给出什么

```
[用户级] LXGWWenKaiGB-Regular.ttf
    注册表名: 霞鹜文楷 GB Regular (TrueType)     ← Windows 设置里显示的名字
    family  : LXGW WenKai GB  (Regular)          ← CSS font-family 要用这个
    路径    : C:\Users\Administrator\AppData\Local\Microsoft\Windows\Fonts\...
```

三个名字用途完全不同，**别混用**：

| 字段 | 用途 |
|---|---|
| 文件名 | 肉眼识别、去重、按文件查找 |
| 注册表名 | Windows 设置/字体面板里显示的名字，**中文** |
| family | **写 CSS `font-family` 用这个**，浏览器只认它 |

## 三、三个必踩的坑（都已实测确认）

### 坑 1：注册表键名是中文，英文名在值里

注册表 `Fonts` 项的**键名是中文**（如 `霞鹜文楷 GB Light`），
英文名 `LXGW` 只出现在**值**（文件路径 `LXGWWenKaiGB-Light.ttf`）里。

所以下面这种写法**一条都搜不到**，会误判成"字体没装"：

```powershell
#错！键名里没有 LXGW，永远零命中
(Get-ItemProperty $r).PSObject.Properties | Where-Object { $_.Name -like "*LXGW*" }
```

正确做法：**键名和值一起匹配**，且中文关键字要一起搜：

```powershell
Where-Object { $_.Name -match "霞鹜|楷|WenKai|Kai" -or $_.Value -match "LXGW" }
```

本技能脚本已按正确方式实现，**直接用脚本，别手写这条命令**。

### 坑 2：用户级字体不在 `C:\Windows\Fonts`

多数人装的开源字体（霞鹜文楷、阿里巴巴普惠体等）装在**用户目录**：

```
C:\Users\<用户名>\AppData\Local\Microsoft\Windows\Fonts
```

**只扫 `C:\Windows\Fonts` 会漏掉全部用户级字体**，
表现为"明明装了却说没装"。用户名为 `Administrator`（本机）。

### 坑 3：PowerShell 工具 stdout 可能不回显

本机 PowerShell 工具常只返回 exit code 而不返回输出内容，
且中文 Windows 下 PowerShell 输出多为 **GBK 编码**——
Python 用 `text=True` 会抛 `UnicodeDecodeError`。

对策（脚本已处理）：
- 用 `capture_output=True` 收**字节**，再按 `gb18030 → utf-8` 顺序手动解码
- 结果**写文件**再用 Read 读
- 从 Bash 调 `powershell.exe` 会被安全策略拦截，必须用 PowerShell 工具

## 四、查开源字体是否可商用（配图/商用场景必看）

微软雅黑等系统字体是**商业授权**，商用有风险。优先用开源字体：

| 字体 | 授权 | 可商用 | CSS family |
|---|---|---|---|
| **霞鹜文楷** LXGW WenKai GB | SIL OFL 1.1 | ✅ | `LXGW WenKai GB` |
| 霞鹜文楷等宽 | SIL OFL 1.1 | ✅ | `LXGW WenKai Mono GB` |
| 阿里巴巴普惠体 | 免费商用 | ✅ | `Alibaba PuHuiTi` |
| 思源黑体 / Noto Sans SC | SIL OFL 1.1 | ✅ | `Noto Sans SC` / `Source Han Sans SC` |
| 微软雅黑 | Monotype 商业授权 | ⚠️ 有风险 | `Microsoft YaHei` |

给文章配图、做海报 PPT 时，**默认用霞鹜文楷**（见 `wechat-illustration-yashu` 技能）。

## 五、输出规模参考

本机实测：全量 **561** 个字体条目。其中约 359 条"注册表名缺失"属正常——
那是从目录扫到但未在注册表登记的字体（`yyb.ttf`、系统内置 TTC 等），
不影响已正规注册字体的查询结果。

## 六、脚本参数速查

| 参数 | 作用 |
|---|---|
| `--kw "关键字"` | 过滤，匹配 文件名/注册表名/family/路径，中英文通吃，大小写不敏感 |
| `--out 路径` | 指定输出文件 |
| `--json` | JSON 格式输出（字段：`registry_name` `file` `path` `scope` `family` `subfamily`） |
| `--no-parse` | 跳过 TTF name 表解析，速度快，但无 family 字段 |

## 七、交付要求

回答用户"有哪些字体"时，**必须给出具体 family 名**，不能只列文件名——
用户真正需要的是能直接粘进 CSS 的那串字符。查不到就明确说没装，
不要把"没查到"说成"装了"。
