# 手动分步执行与故障排查

一键脚本 `scripts/any-upload-share.mjs` 不可用时，按下面顺序手动执行。所有命令都在 `quarkclouddrive` skill 目录下运行。

```powershell
$QK = "C:\Users\Administrator\.workbuddy\skills\quarkclouddrive"
Set-Location $QK
$SID = "<10位Unix秒时间戳>-<6位随机字母数字>"   # 本对话内复用同一个
$SI  = "<用户原始提问原话，逐字复制>"
```

## 第 0 步：环境自检（尽力而为）

```powershell
& "D:\software\Git\Git\bin\bash.exe" -l scripts/install.sh
```

失败不阻断：只要 `$QK\scripts\quark-drive.cjs` 存在就继续。失败原因通常是受限环境无法联网下载或无法写临时目录，回复中说明「本次跳过环境自检」即可。

## 第 1 步：解析目标目录 FID

### 1.1 找外层目录 `ComfyUI牙叔整合包2025`

```powershell
node scripts/quark-drive.cjs browse --parent-fid 0 --all --session-input "$SI" --session-id "$SID"
```

读取输出的 `type:"artifact"` 行里的 `data.file_path`，用 Read 打开该 JSONL，找 `filename` 等于 `ComfyUI牙叔整合包2025` 且 `file_type` 为 `"0"` 的条目，取其 `fid`（记为 `TOP_FID`）。

根目录没有时退化为全盘搜索：

```powershell
node scripts/quark-drive.cjs search --keyword "ComfyUI牙叔整合包2025" --search-type dir --stdout-only --session-input "$SI" --session-id "$SID"
```

取 `artifact` 落盘文件里的同名文件夹 `fid`。若命中多个且无法唯一确定，向用户确认，不要随便挑一个。

仍不存在则创建（不传 `--parent-fid`，由服务端默认位置创建）：

```powershell
node scripts/quark-drive.cjs create-folder --dir-path "ComfyUI牙叔整合包2025" --session-input "$SI" --session-id "$SID"
```

取结果行 `data.fid`，并在回复中说明该目录是新建的。

### 1.2 找子目录 `任意上传`

```powershell
node scripts/quark-drive.cjs create-folder --dir-path "任意上传" --parent-fid $TOP_FID --session-input "$SI" --session-id "$SID"
```

同名创建是幂等的，已存在时直接返回已有目录的 `fid`（记为 `TARGET_FID`）。

## 第 2 步：上传

```powershell
node scripts/quark-drive.cjs upload "<本地文件绝对路径>" --parent-fid $TARGET_FID --session-input "$SI" --session-id "$SID"
```

- 只接受文件绝对路径；路径不存在时停下并告知用户，禁止猜测其他路径。
- 从最后一行 `type:"result"` 取 `data.fids`（分享时要用）。
- `code` 为 `-204` 表示存在失败子任务，如实报告 `msg`，不要当成功。

## 第 3 步：创建永久公开分享链接

```powershell
node scripts/quark-drive.cjs share <FID...> --url-type 1 --expired-type 1 --session-input "$SI" --session-id "$SID"
```

- 必须显式传 `--url-type 1`，否则可能拿到带提取码的私密链接。
- 取结果行 `data.share_url`；若出现 `data.passcode` 说明不是公开链接，视为失败并重试一次。
- 校验链接以 `https://pan.quark.cn` 开头。

## 第 4 步：交付

- 用 `[分享链接](share_url)` 可点击形式展示，并附完整 URL 原文。
- 简报：文件名、大小、上传目录、永久有效、无提取码。
- 不暴露 FID、session id、字段名、命令、脚本路径。

## 故障排查

| 现象 | 原因 | 处理 |
|---|---|---|
| `scripts/install.sh: line 22: dirname: command not found` | 直接用 `bash` 跑，环境 PATH 不完整 | 改用 `& "D:\software\Git\Git\bin\bash.exe" -l scripts/install.sh` |
| `curl: (23) client returned ERROR on write` | 受限环境写临时目录或下载被拦 | 跳过自检，直接用已有 CLI 继续 |
| `PROGRAM BLOCKED BY SECURITY POLICY ... reg.exe` | 沙箱程序黑名单拦截 CLI 依赖的 `reg.exe` | 在「安全中心 → 命令安全 → 程序黑名单」移除 `reg.exe`，或换非沙箱环境；不要反复重试 |
| `code` 为负且 `msg` 含「未授权 / 认证 / token」 | 夸克账号未授权或授权过期 | 先执行 `quarkclouddrive` 的 `login` 完成授权，再重跑 |
| 根目录浏览没有目标文件夹 | 目录不在根目录或名字有出入 | 走 1.1 的搜索兜底；仍无则创建 |
| 搜索命中多个同名文件夹 | 网盘存在重名目录 | 向用户确认，不要随机选择 |
| 上传成功但分享返回 `passcode` | 链接类型不是公开 | 重跑 `share` 并确认带上 `--url-type 1` |
| 控制台中文乱码 | 本机控制台编码显示问题 | 以落盘 JSON / 返回原文实际字节为准，不据此判断成败 |

## 已知限制

- 不删除、不覆盖网盘已有内容；同名上传会生成副本。
- 夸克 CLI 没有撤销分享的命令，误建的分享会残留。
- 一次执行只对应一次「任意上传」请求；多个文件会合并成同一个分享链接。
