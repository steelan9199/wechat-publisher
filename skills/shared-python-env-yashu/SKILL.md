---
name: shared-python-env-yashu
description: >-
  本机（Windows / 用户 Administrator）共享 Python 虚拟环境的使用手册。当需要在本机运行 Python 脚本、
  调用 sympy 等已装依赖、或用 playwright 做网页自检时，加载本技能即可拿到正确的解释器绝对路径——
  不要新建虚拟环境，不要用裸 `python` / `python3` 命令，也不要重复安装依赖。
  同时包含本机已知坑的规避方法（stdout 不回传 → 改用写文件再读），避免 agent 空等。
  触发词：共享环境, 共享依赖, 共享虚拟环境, 用哪个python, 本机python路径, uv环境, uv env,
  sympy环境, playwright环境, shared python env, shared venv, which python, uv env path,
  找不到python, python没有sympy, stdout没输出, 命令没有回显, 干等。
---

# 本机共享 Python 环境

**本技能只做一件事**：告诉你怎么在本机调用已经建好的共享虚拟环境。

---

## 一句话结论

需要跑 Python 时，**直接用下表的绝对路径**，不要用裸 `python` / `python3`，
不要 `pip install`，不要新建 venv。

**并且：输出一律重定向到文件再读**（见下方「⚠️ 头号坑」），否则你可能什么都看不到。

---

## ⚠️ 头号坑：stdout 不回传（先看这条）

### 现象

在本机用 PowerShell / Bash 工具跑 Python 时，**子进程的标准输出经常不回传给 agent**：

- 命令返回 `exit code 0`，但**一个字输出都没有**
- 或者整个工具调用**空返回**，看起来像"命令卡住了 / 没跑完"
- 长输出、含子进程（playwright 启动浏览器等）时尤其容易出现

**真实后果**：agent 以为命令没执行完，于是**干等、反复重试同一条命令**，白白浪费时间。
（本技能作者就因此空等了数分钟。）

### 关键认知

> **命令很可能已经成功执行了，只是输出没回来。**
> 判断是否真的跑完，**不要看 stdout**，而要看**副作用**：文件是否生成、端口是否监听、包是否装上。

### 对策：一律「写文件 → 读文件」

**不要**直接依赖 stdout。把输出重定向到文件，再用 `Read` 工具读该文件。

PowerShell：

```powershell
& "D:\software\uv\envs\geo\Scripts\python.exe" your_script.py *> "D:\software\workBuddyWorkspace\_out.txt"
```

Bash：

```bash
D:/software/uv/envs/geo/Scripts/python.exe your_script.py > _out.txt 2>&1
```

然后读 `_out.txt`：

```
Read  D:\software\workBuddyWorkspace\_out.txt
```

- `*>`（PowerShell）等价于 Bash 的 `> file 2>&1`，**stdout 与 stderr 都要收**，
  否则报错信息同样会丢失。
- 需要看退出码时，把它一并写进文件：`... ; "exit=$LASTEXITCODE" *>> _out.txt`
- 用完删掉临时文件；**不要**把 `_out.txt` 之类的产物留在用户目录里。
- **不要**因为一次空返回就重复跑同一条命令——先去看副作用/文件，确认真实结果。

### 需要长时间运行的进程怎么办

别在前台硬等，用后台运行参数启动，并按副作用判断就绪：

```powershell
# 例：起本地静态服务用于预览，改用 run_in_background 启动，
# 再用 curl 探活判断是否就绪，而不是靠 stdout 判断
```

**收尾纪律**：后台起的服务，用完**必须停掉**，并核对端口已释放，绝不留下占着端口的进程。


## 环境注册表

| 名称 | 解释器绝对路径 | Python 版本 | 已装的关键依赖 |
|---|---|---|---|
| `geo` | `D:\software\uv\envs\geo\Scripts\python.exe` | 3.14.7 | sympy 1.14.0、mpmath 1.3.0、playwright 1.63.0 |

配套信息：

- uv 可执行文件：`D:\software\uv\uv.exe`（v0.12.4）
- uv 的 Python 安装目录：`D:\software\uv\python`
- playwright 浏览器：`C:\Users\Administrator\AppData\Local\ms-playwright`（chromium-1243 等）

> 这些路径是本机专属。**先确认解释器文件存在**再使用；不存在时按下方「重建环境」恢复。

---

## 怎么用

### PowerShell（本机首选，pwsh 7.6.6）

```powershell
& "D:\software\uv\envs\geo\Scripts\python.exe" your_script.py
& "D:\software\uv\envs\geo\Scripts\python.exe" -c "import sympy; print(sympy.__version__)"
```

### Git Bash / 其它 shell

```bash
D:/software/uv/envs/geo/Scripts/python.exe your_script.py
```

### 先验证可用（拿到环境后建议先跑一次）

```powershell
& "D:\software\uv\envs\geo\Scripts\python.exe" -c "import sys, sympy; print(sys.version.split()[0], sympy.__version__)"
```
期望输出：`3.14.7 1.14.0`

### 查看环境里已装了什么

```powershell
& "D:\software\uv\uv.exe" pip list --python "D:\software\uv\envs\geo\Scripts\python.exe"
```

> **注意**：该 venv 内**没有 pip**（uv 默认不装），所以 `python -m pip list` 会报
> `No module named pip`——这是正常的，不是环境坏了。查包/装包一律走 `uv pip`。

---

## 装新的库（重要：先问用户）

```powershell
& "D:\software\uv\uv.exe" pip install --python "D:\software\uv\envs\geo\Scripts\python.exe" <包名>
```

规则：

1. **必须先征得用户同意再装**，不要擅自安装。
2. **一定要带 `--python <该 env 的 python.exe>`**，否则会装到别处去。
3. 装进同一个共享环境，让所有 agent 都能用；不要给单个项目另建 venv。

---

## 与 Python 版本的关系（关键）

该环境**绑定 Python 3.14.7**，二者是死绑关系：

- venv 内的 `pyvenv.cfg` 写死了创建时的 Python 版本与路径。
- **不能**用别的 Python 版本去跑这个 venv（会失效）。
- **不能**把 venv 目录拷贝给另一个 Python 版本使用。
- 换版本 = **必须重建**（见下节）。
- 纯 Python 包（如 sympy）跨小版本兼容性较好；**带 C 扩展的包**（numpy、lxml 等）
  换 Python 版本后基本必须重建环境，因为 ABI 不兼容。

## 重建环境（环境丢失 / 换机器时）

```powershell
& "D:\software\uv\uv.exe" venv D:/software/uv/envs/geo --python 3.14
& "D:\software\uv\uv.exe" pip install --python "D:\software\uv\envs\geo\Scripts\python.exe" sympy
& "D:\software\uv\uv.exe" pip install --python "D:\software\uv\envs\geo\Scripts\python.exe" playwright
```

重建后 `D:\software\uv\envs\geo\Scripts\python.exe` 路径不变，其它技能无需改动。

> `--python 3.14` 是关键：版本写错，环境就绑到了别的解释器上。

---

## 常见错误

| 现象 | 原因 | 正确做法 |
|---|---|---|
| **命令 exit 0 却没有任何输出 / 空返回** | **本机 stdout 不回传（头号坑）** | **输出重定向到文件再读；先看副作用别干等** |
| `No module named sympy` | 用了系统 `python` / 裸 `python3` | 改用上面的绝对路径 |
| `No module named pip` | uv 建的 venv 默认无 pip | 用 `uv pip list --python <路径>` |
| `Fatal error: no pyvenv.cfg` / 解释器找不到 | venv 被删或 Python 版本被卸载 | 按「重建环境」恢复 |
| 装包后别的 agent 用不到 | 没带 `--python`，装到了别处 | 装包务必带 `--python "D:\software\uv\envs\geo\Scripts\python.exe"` |
| 环境里有包但仍 import 失败 | 用了不同 Python 版本的解释器 | 核对 `sys.executable` 是否等于该路径 |

---

## 给"被口头指派"的 agent

如果你是被告知「用 `shared-python-env-yashu` 这个技能」而加载本文的，那么：

1. 从上方注册表取解释器绝对路径：`D:\software\uv\envs\geo\Scripts\python.exe`
2. 直接用它执行你的 Python 脚本，**不要**创建新环境、**不要**用裸 `python`
3. 需要额外依赖 → 先问用户，同意后用 `uv pip install --python <该路径> <包名>`
4. 不确定环境是否可用 → 先跑验证命令，期望输出 `3.14.7 1.14.0`
5. **先读「⚠️ 头号坑：stdout 不回传」**——输出写文件再读，别因为看不到回显就干等或反复重试

---

## 谁在用这个环境

| 消费方 | 用途 |
|---|---|
| `edu-solid-geometry` 技能 | 立体几何精确计算（sympy），路径已写入其 SKILL.md |
