---
name: github-release-xunlei-download
description: 下载 GitHub 仓库 Release 的附件（APK/ZIP/EXE 等）到本地。流程为：取 release assets → 交给迅雷（MCP）下载 → 从迅雷本地任务库 TaskDb.dat 反查文件落地目录 → 校验文件大小 → 按需移动到指定文件夹。激活条件：用户消息须包含以下关键词之一：`迅雷下载 GitHub`、`用迅雷下载`、`下载 GitHub release`、`下载 release 附件`、`下载 GitHub 附件`、`迅雷下载 release`。
disable-model-invocation: false
---

# GitHub Release 附件 · 迅雷下载与落地定位

把 GitHub Release 的 assets 用迅雷拖到本地，并**准确定位文件下到了哪个文件夹**，最后校验大小、按需搬运。

## 关键事实（别踩坑）

1. **迅雷 MCP 不支持指定下载目录**。`xunlei_download_create` 只有 `target` / `urls` / `names`，`xunlei_download_operate` 只有 `running`/`pause`/`delete`。「下载到指定文件夹」只能**下载完再移动**。
2. **MCP 不返回保存路径**。`xunlei_download_list` 只有 name / file_size / status / progress，没有 path。**严禁全盘扫描文件名去找**——慢且不可靠。正确做法：读迅雷本地 sqlite 任务库 `TaskDb.dat` 的 `TaskBase.SavePath` 字段（本 Skill 的 `scripts/locate_assets.py` 已封装）。
3. `TaskBase.Name` 字段尾部带 `\x00`，匹配前必须 strip，否则查不到。

## 工作流

### 第 1 步：解析输入

识别以下三类输入（用户给哪种走哪种）：

| 输入形态 | 处理 |
|---|---|
| 仓库链接 / `owner/repo` | 默认取 **latest release** |
| 仓库 + 版本（如 `v6.6.0`） | 用 `get_release_by_tag` 取指定 release；用户没给版本就是 latest |
| 直接的 asset 下载直链 | 跳过仓库查询，直接进第 3 步 |

同时提取两个可选参数：
- **关键词**：用户指定了要哪些（如 `arm64`、`win-x64`）。文件名不区分大小写，多关键词**任一命中**即下载。
- **目标文件夹**：用户指定「下到 D:\apps」→ 记下来，第 6 步移动过去（迅雷本身无法直接下到那里）。

> 用户没给关键词 → 下载该 release 的**全部 assets**。

### 第 2 步：列出 assets 并让用户过目（有关键词时可略）

用 GitHub MCP 取 release（`get_latest_release` / `get_release_by_tag`），把 assets 整理成表格给用户：文件名、大小（换算 MB）、下载数。标注哪些会被下载、哪些被过滤掉。

### 第 3 步：校验链接 + 建任务

1. `xunlei_download_check_urls` 校验全部直链（无效链接直接告知用户，不下发）。
2. `xunlei_download_list_device` 取 `target`（**严禁编造**；无设备则告知「迅雷未运行」并停止）。
3. `xunlei_download_create` 一次性下发全部链接（单次只调一次）。

### 第 4 步：等完成

轮询 `xunlei_download_list`，「等待中 / 进行中」都算未完成。建议间隔 15 秒，超时 30 分钟。全部 `完成` 后进入第 5 步。

### 第 5 步：定位落地目录（核心）

调用脚本（`python` 用托管版绝对路径）：

```bash
"C:/Users/Administrator/.workbuddy/binaries/python/versions/3.13.12/python.exe" \
  "<SKILL_DIR>/scripts/locate_assets.py" \
  --db "D:\\software\\XunLei\\Thunder\\Profiles\\TaskDb.dat" \
  --assets "<assets.json>" \
  --json "<report.json>"
```

`assets.json` 格式：`[{"name":"a.apk","size":139193973}, ...]`（size 取自 GitHub API 的 `size` 字段）。

`--db` 可省略，脚本会按候选列表探测（见下）。**探测不到就停止任务**，不要瞎找 —— 见「失败兜底」。

脚本输出：每个文件的 `save_dir` / `current_path` / `expected_size` / `actual_size` / `size_ok`，以及汇总 `save_dirs`（本次涉及的落地目录集合）。

### 第 6 步：校验 + 移动

- **校验只比文件字节数**（不做 sha256，快且够用）。不符的标红列出，不中断其他文件。
- 用户指定了目标文件夹 → 加 `--dest "D:\\apps"` 让脚本搬运；同名冲突自动加 `(1)`。
- **校验不通过的文件不移动**，单独汇报。

### 第 7 步：汇报

用表格列出：文件名、大小、原落地路径、（移动后的）最终路径、状态。末尾给出目录清单，方便用户直接打开。

## 迅雷任务库路径

默认值（本机已验证）：

```
D:\software\XunLei\Thunder\Profiles\TaskDb.dat
```

脚本内置的候选探测顺序：

```
D:\software\XunLei\Thunder\Profiles\TaskDb.dat
D:\software\Thunder\Thunder\Profiles\TaskDb.dat
C:\Program Files (x86)\Thunder Network\Thunder\Profiles\TaskDb.dat
C:\Program Files\Thunder Network\Thunder\Profiles\TaskDb.dat
C:\Users\<USERNAME>\AppData\Roaming\Thunder\Profiles\TaskDb.dat
```

找到后写入脚本同级的 `taskdb_path.txt` 缓存，下次直接用。**用户若提供了明确路径，优先用用户的。**

## 失败兜底：找不到任务库 / 查不到 SavePath

**立刻停止任务**，不要自行全盘搜索。用下面话术引导用户：

> 没定位到迅雷的下载目录，请在迅雷里确认一下：
> 1. 打开迅雷 → 下载列表 → 在刚下载的文件上**右击 → 打开文件夹**，把地址栏路径告诉我；
> 2. 或者：迅雷设置 → 下载设置 → 查看**默认下载目录**。
>
> 你把路径发我，我接着做校验和搬运。

拿到用户给的路径后，把它作为 `--dest` 的源目录（或直接在该目录下校验），继续第 6 步。

## 注意事项

- 读 `TaskDb.dat` 前**先复制一份到临时文件**再连 sqlite，避免数据库锁；用完删除临时文件。
- 迅雷任务库里 `SavePath` 是**目录**（末尾带 `\`），不是完整文件路径。
- 一次下发任务时不要分多次调 `xunlei_download_create`。
- 汇报路径用 Windows 反斜杠原样输出。
