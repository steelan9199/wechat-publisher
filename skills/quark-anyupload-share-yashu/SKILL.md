---
name: quark-anyupload-share-yashu
description: 夸克网盘「任意上传」专用技能。当用户消息中出现关键词「任意上传」并提供一个本地文件的绝对路径时，把该文件上传到夸克网盘固定目录 ComfyUI牙叔整合包2025/任意上传，然后创建永久有效（expired-type=1）、无提取码（url-type=1）的公开分享链接并返回给用户。覆盖「任意上传 加一个绝对路径」「任意上传这个文件」「把这个文件任意上传到夸克」等说法。
agent_created: true
---

# 任意上传（夸克网盘 → 永久公开分享链接）

一句话交付：本地文件绝对路径 → 上传到 `ComfyUI牙叔整合包2025/任意上传` → 返回永久有效、无提取码的公开分享链接。

## 触发条件

必须同时满足两条，缺一不可：

1. 用户消息中含关键词 **「任意上传」**；
2. 用户给出了**本地文件的绝对路径**（Windows 形如 `D:\...\xxx.zip`）。

边界处理：

- 只说「任意上传」但没给路径 → 先索要绝对路径，禁止猜测或用最近聊天里的其他路径替代。
- 只给了路径但没说「任意上传」→ **不触发本技能**，按普通上传意图处理。
- 给的是目录 → 本技能只处理单个文件，向用户说明后停止。

## 固定参数（不要改动）

| 项 | 值 |
|---|---|
| 目标目录 | `ComfyUI牙叔整合包2025` / `任意上传`（两级） |
| 链接类型 | 公开链接 `--url-type 1` |
| 有效期 | 永久有效 `--expired-type 1` |
| 提取码 | 无（必须是公开链接，返回里不允许出现 passcode） |
| 分享标题 | 不传 `--title` |

## 前置依赖

- `quarkclouddrive` skill 已安装并已绑定夸克账号；CLI 位于 `<用户技能目录>/quarkclouddrive/scripts/quark-drive.cjs`。
- 若 CLI 返回未授权 → 先走 `quarkclouddrive` 的 `login` 完成授权，再回来重跑本流程。

## 执行方式

### 首选：一键脚本

```powershell
node "C:\Users\Administrator\.workbuddy\skills\quark-anyupload-share-yashu\scripts\any-upload-share.mjs" --file "<本地文件绝对路径>" --session-input "<用户原始提问原话>"
```

脚本内部完成：环境自检（尽力而为）→ 解析目标目录 FID（不存在则新建）→ 上传 → 创建永久公开分享 → 输出结果 JSON。

参数说明：

| 参数 | 必填 | 说明 |
|---|---|---|
| `--file "<绝对路径>"` | 是 | 可重复传入多个 `--file`，会汇总为一个分享链接 |
| `--session-input "<原话>"` | 建议 | 用户原始提问文本，逐字复制 |
| `--session-id "<id>"` | 否 | 不传则自动生成 `{时间戳}-{6位随机}` |
| `--target "外层/子层"` | 否 | 默认 `ComfyUI牙叔整合包2025/任意上传` |
| `--cli-dir "<目录>"` | 否 | 默认自动定位 `quarkclouddrive` skill 目录 |
| `--skip-precheck` | 否 | 跳过 `install.sh` 环境自检 |
| `--out "<路径>"` | 否 | 结果 JSON 落盘位置，默认系统临时目录下的 `any-upload-share-result.json` |

成功输出（stdout，同时写入 `--out` 文件）：

```json
{
  "ok": true,
  "targetFolder": "ComfyUI牙叔整合包2025/任意上传",
  "files": [{ "fileName": "xxx.zip", "size": 123456, "localPath": "D:\\...\\xxx.zip" }],
  "shareUrl": "https://pan.quark.cn/s/xxxxxxxx",
  "urlType": 1,
  "expiredType": 1,
  "passcode": "",
  "notes": ["环境自检通过", "顶层目录「ComfyUI牙叔整合包2025」定位方式：根目录浏览"]
}
```

失败输出：`{"ok": false, "error": "<原因>"}`，进程退出码 1。

**控制台中文可能显示为乱码（本机显示层问题）**：判定结果以 `--out` 落盘的 JSON 文件为准，用 Read 工具读取该文件，不要依据控制台画面判断成败。

### 兜底：手动分步执行

脚本不可用时，按 [references/manual-steps.md](references/manual-steps.md) 手动执行同名流程。

## 交付话术（必须遵守）

- 用可点击 Markdown 链接展示分享地址：`[分享链接](share_url)`，**同时附上完整 URL 原文**方便复制；禁止用代码块/行内代码包裹或截断链接。
- 简报内容：文件名、文件大小、上传目录、链接永久有效、无提取码。
- 禁止暴露 FID、session id、字段名、CLI 命令、脚本路径等技术细节。
- 禁止说「根目录」——本技能上传到的是 `ComfyUI牙叔整合包2025/任意上传`。

## 硬约束

1. 目标目录固定为 `ComfyUI牙叔整合包2025/任意上传`，用户未另行说明时不得更改。
2. 创建分享**必须显式传** `--url-type 1 --expired-type 1`；不传 `--url-type` 可能得到带提取码的私密链接。
3. 返回值中出现 `passcode` 或链接不以 `https://pan.quark.cn` 开头 → 视为失败，不允许当成功交付。
4. 只新增文件，不删除、不覆盖网盘已有内容。
5. 禁止读取 `quark-drive.cjs` 源码；禁止向用户解释 CLI 内部实现。
6. 上传失败（`code=-204` 等）时如实报告失败原因，禁止伪造成功或伪造链接。

## 本机环境坑位（Windows，先读）

- **Bash 工具不可用**：缺 `dirname`/`basename`，直接跑 `bash scripts/install.sh` 会报 `command not found`。必须改用 Git Bash 登录 shell：
  `& "D:\software\Git\Git\bin\bash.exe" -l scripts/install.sh`
- `install.sh` 失败不阻断：它需要联网下载并写临时目录，受限环境下可能报 `curl: (23) client returned ERROR on write`。只要 `scripts/quark-drive.cjs` 已存在，直接继续执行 CLI 命令即可，并在回复里说明本次跳过了环境自检。
- 若报 `PROGRAM BLOCKED BY SECURITY POLICY ... reg.exe`：沙箱程序黑名单拦截了 CLI 依赖的 `reg.exe`，需在「安全中心 → 命令安全 → 程序黑名单」中移除 `reg.exe`，或在非沙箱环境执行。**不要反复重试**，直接告知用户。
- PowerShell 5.1 不支持 `&&` / `||`，多步操作用多条语句。
- `node` 已在 PATH（v22.22.2）；也可用受管路径 `C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2-3\node.exe`。
- 夸克 CLI 无撤销分享命令，误建的分享会残留；发现后向用户说明即可。

## 完成清单（交付前逐项核对）

- [ ] 用户消息同时含「任意上传」与文件绝对路径
- [ ] 文件在本机存在且为文件（非目录）
- [ ] 上传结果 `ok: true`，`targetFolder` 为 `ComfyUI牙叔整合包2025/任意上传`
- [ ] `shareUrl` 以 `https://pan.quark.cn` 开头，`passcode` 为空，`expiredType` 为 1
- [ ] 已用可点击链接 + 完整 URL 原文交付给用户

## 资源

- `scripts/any-upload-share.mjs`：一键「定位目录 → 上传 → 永久公开分享」编排脚本，输出结果 JSON。
- `references/manual-steps.md`：手动分步执行与故障排查。
