---
name: github-quark-feishu-publish
description: 技能发布流水线（GitHub → 夸克 → 飞书联动）：把 GitHub 技能仓库与配套手机 APK 组装成带时间戳的发布文件夹，压缩后上传到夸克网盘指定目录，生成永久公开分享链接，并替换飞书文档「下载地址」处的旧夸克链接。当用户要求「发布技能包」「更新/回填下载链接」「把技能包上传到夸克并更新飞书」「跑一遍发布流程」「GitHub、夸克、飞书联动」，或提供类似流程文档要求照做时使用；也适用于「打包资源 → 网盘分发 → 文档回填链接」的例行发布。
---

# GitHub → 夸克 → 飞书 技能发布流水线

把「技能包 + 配套 APK」发布为可下载的夸克链接，并让飞书文档始终指向最新链接。整条链路共 6 步：拉取 → 组装 → 压缩 → 上传 → 分享 → 回填。

## 触发与前置

- 触发：发布技能包 / 更新下载链接 / 上传夸克并更新飞书 / 跑发布流程 / 三端联动。
- 前置条件（不满足先补齐，不要跳过）：
  - 本机已配置 GitHub SSH，技能仓库已克隆到本地；
  - 夸克网盘已绑定（quarkclouddrive skill），飞书文档可读可写（lark-doc skill）；
  - 当前环境的 Bash 工具按 PowerShell 执行（Windows）。

## 发布参数（每轮按用户最新输入确认；未指定时用下列默认值）

| 参数 | 说明 | 默认值 |
|---|---|---|
| 技能仓库 URL | GitHub 技能仓库 | https://github.com/steelan9199/autojs-mobile-automation-yashu-public |
| 技能源目录 | 本地克隆路径 | D:\github\autojs-mobile-automation-yashu-public |
| APK 路径 | 配套手机 APP | D:\github\autojs-mobile-automation-yashu\任务执行器_1.0.2.apk |
| 命名前缀 | 父文件夹名前缀 | AI安卓手机自动化的软件 apk + SKILL |
| 输出目录 | 组装与压缩产物位置 | D:\software\workBuddyWorkspace |
| 夸克目标目录 | 网盘上传位置 | ComfyUI牙叔整合包2025/任意上传 |
| 飞书文档 | 回填下载地址的 wiki 链接 | https://kr0lqjlbmo.feishu.cn/wiki/QpCNwSqFdixK7ykWdhLcQd80noc |

## 硬约束（违反即为失败）

1. 技能文件夹名必须与 SKILL.md frontmatter 的 `name` 完全一致（如 `autojs-mobile-automation-yashu-public`）。
2. 父文件夹名后缀为当前时间 `yyyyMMdd_HHmmss`（年 4 位，其余 2 位），例：`AI安卓手机自动化的软件 apk + SKILL-20260913_141025`。
3. 分享链接必须公开（url-type=1）且永久有效（expired-type=1），以 `https://pan.quark.cn` 开头。
4. 飞书文档只替换「下载地址」后的那一条 pan.quark.cn 链接，不碰其他内容。
5. 不删除、不覆盖网盘旧文件，只新增。

## 工作流

### 第 1 步：拉取最新技能

```powershell
git -C "D:\github\autojs-mobile-automation-yashu-public" pull
```

- 读取 `SKILL.md` 前几行，核对 frontmatter 的 `name` 与文件夹名一致。
- 确认 APK 源文件存在。

### 第 2+3 步：组装目录并压缩

优先直接运行 `scripts/assemble-package.ps1`（自动完成：建目录、复制 APK、robocopy 技能目录并排除 `.git`/`.vscode`、tar 打包、解压自校验、APK 哈希比对）。参数与默认值见脚本头注释。

手动等价操作：

```powershell
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$name = "AI安卓手机自动化的软件 apk + SKILL-$ts"
$parent = Join-Path "D:\software\workBuddyWorkspace" $name
New-Item -ItemType Directory -Path $parent -Force | Out-Null
Copy-Item "D:\github\autojs-mobile-automation-yashu\任务执行器_1.0.2.apk" $parent -Force
robocopy "D:\github\autojs-mobile-automation-yashu-public" (Join-Path $parent "autojs-mobile-automation-yashu-public") /E /XD ".git" ".vscode" /NFL /NDL /NJH /NJS | Out-Null
tar -a -c -f "$parent.zip" -C "D:\software\workBuddyWorkspace" $name
```

- 压缩必须用 `tar`（bsdtar）：保证中文文件名以 UTF-8 写入 zip；`Compress-Archive` 存在编码坑。
- 压缩后必须验证：解压到临时目录，确认中文文件夹名/APK 名无损、结构正确，且 APK SHA256 与源一致；验证后清理临时目录。

### 第 4 步：上传夸克

按 quarkclouddrive skill 规范执行（先完整 Read 其 SKILL.md 与所需 references）：
1. 每次调用前先跑安装脚本（本机坑位见下）：
   ```powershell
   Set-Location "<quarkclouddrive skill 目录>"
   & "D:\software\Git\Git\bin\bash.exe" scripts/install.sh
   ```
2. 定位目标目录：`search --keyword "ComfyUI牙叔整合包2025" --search-type dir` 拿外层 FID，再 `browse --parent-fid <FID> --all` 找到「任意上传」子目录 FID。
3. 上传：`upload "<zip 绝对路径>" --parent-fid <任意上传FID> --session-input "<用户原始提问原话>" --session-id "<ts>-<rand>"`。
4. 确认返回 `fullPath` 含目标目录，才算上传成功。

### 第 5 步：生成永久公开分享链接

```powershell
node scripts/quark-drive.cjs share <上传文件FID> --url-type 1 --expired-type 1 --session-input "..." --session-id "..."
```

- 必须显式 `--url-type 1`：不传时可能返回私密链接（url_type=2 带 passcode），而读者需要直接可用的公开链接。
- 校验返回 `url_type=1` 且 `expired_type=1`，取 `share_url`。

### 第 6 步：回填飞书文档

按 lark-doc skill 规范执行（动手前必须重新 Read 其 SKILL.md 及 online-doc 分支的 fetch/update 参考）：
1. `lark-cli docs +fetch --doc "<wiki URL>" --doc-format markdown --as user`，定位旧 pan.quark.cn 链接。
2. `lark-cli docs +update --doc "<wiki URL>" --command str_replace --pattern "<旧链接>" --content "<新链接>" --as user`。
3. 重新 `+fetch` 验证新链接已生效、其余内容未变。

## 本机环境坑位（重要，先读）

- `bash` 命令指向损坏的 WSL2（MountVhd ERROR_PATH_NOT_FOUND），quarkclouddrive 的 install.sh 必须改用 Git Bash：`& "D:\software\Git\Git\bin\bash.exe" scripts/install.sh`。
- PowerShell 5.1 不支持 `&&` / `||`，多步操作用多条语句。
- 控制台显示中文乱码多为显示层问题，以文件系统实际结果（Get-ChildItem / Get-FileHash）为准。
- 禁止读取 quark-drive.cjs 源码；CLI 公共参数 `--session-input`（用户原话）与 `--session-id`（同会话复用）必须携带。
- 夸克 CLI 无撤销分享命令；误建的分享会残留，发现后向用户说明即可。
- 每次写飞书文档前，先重新 Read lark-doc SKILL.md（多轮对话中也不能凭记忆动手）。

## 完成清单（交付前逐项核对）

- [ ] 本地 zip 存在且解压验证通过（中文名完好、APK 哈希一致）
- [ ] 夸克上传成功（fullPath 含目标目录）
- [ ] 分享链接 url_type=1、expired_type=1、以 https://pan.quark.cn 开头
- [ ] 飞书文档 fetch 显示新链接，旧链接不再出现
- [ ] 向用户交付：zip 本地路径 + 分享链接 + 飞书文档链接

## 资源

- `scripts/assemble-package.ps1`：参数化一键「组装 + 压缩 + 自校验」脚本。
