#requires -Version 7
<#
.SYNOPSIS
只下载用户指定的单个技能文件夹（git 窄克隆，绝不整仓克隆后再提取）。

.DESCRIPTION
判定规则：
  1. 先检查链接指向的文件夹下是否存在 SKILL.md（下载前用 raw.githubusercontent.com 探测）；
  2. 存在 SKILL.md  -> 判定为技能文件夹 -> 只下载这一个文件夹；
  3. 不存在        -> 判定不是技能文件夹 -> 不下载，退出码 1。
硬性约束：
  - 每次只安装一个技能；
  - 下载方式为 git 窄克隆（--filter=blob:none --sparse --depth 1 + sparse-checkout set），
    只拉取目标文件夹的内容，不整仓克隆；
  - 安装成功后必须输出技能的绝对路径（SKILL_DIR / SKILL_MD 两行），供调用方 AI agent 读取。

.PARAMETER Url
GitHub 链接，支持两种形态：
  https://github.com/<owner>/<repo>/tree/<branch>/<path>   （指向仓库内某个技能文件夹）
  https://github.com/<owner>/<repo>                        （仓库根目录本身就是技能，根下有 SKILL.md）

.PARAMETER TargetDir
下载目标目录（可选）。默认 = 脚本运行时的当前工作目录。
安装位置 = <TargetDir>/<技能文件夹名>，例如 identity-backup-yashu/。

.PARAMETER Force
目标目录已存在同名文件夹时允许覆盖（默认拒绝，避免误删已有内容）。

.PARAMETER KeepCache
保留临时克隆缓存（默认删除缓存，目标目录不留 .git 残留）。

.EXAMPLE
pwsh "D:\software\PowerShell\7\pwsh.exe" -File .\install-single-skill.ps1 `
  -Url "https://github.com/steelan9199/wechat-publisher/tree/main/skills/identity-backup-yashu" `
  -TargetDir "D:\empty"

退出码：
  0  成功（技能已安装，输出 SKILL_DIR 绝对路径）
  1  该文件夹下没有 SKILL.md，不是技能文件夹，不下载
  2  目标目录已存在同名文件夹（未加 -Force）
  10 git 环境缺失
  11 URL 无法解析
  12 无法获取默认分支
  13 检查 SKILL.md 网络失败
  14 窄克隆失败
  15 窄检出（sparse-checkout/checkout）失败
  16 检出后校验 SKILL.md 失败
  17 复制到目标目录后校验失败
#>
param(
    [Parameter(Mandatory = $true)][string]$Url,
    [string]$TargetDir,
    [switch]$Force,
    [switch]$KeepCache
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$msg) { Write-Host "[*] $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg)   { Write-Host "[+] $msg" -ForegroundColor Green }
function Write-Fail([string]$msg) { Write-Host "[-] $msg" -ForegroundColor Red }

# ---------- 0. 环境检查 ----------
$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) { Write-Fail "未找到 git，请先安装 Git 并加入 PATH。"; exit 10 }

# ---------- 1. URL 解析 ----------
$url = $Url.Trim().TrimEnd('/')
$pattern = '^https://github\.com/([^/]+)/([^/]+?)(?:\.git)?(?:/tree/(.+))?$'
$m = [regex]::Match($url, $pattern)
if (-not $m.Success) {
    Write-Fail "无法解析的 GitHub 链接（仅支持 https://github.com/<owner>/<repo>[/tree/<branch>/<path>]）：$Url"
    exit 11
}
$owner  = $m.Groups[1].Value
$repo   = $m.Groups[2].Value
$rest   = $m.Groups[3].Value   # tree/ 之后的内容；无则视为仓库根目录

$branch  = $null
$subpath = ''
if ($rest) {
    $seg = $rest -split '/', 2
    $branch  = $seg[0]
    $subpath = if ($seg.Count -gt 1) { $seg[1] } else { '' }
}
if (-not $branch) {
    # 无 tree 段：查一次 GitHub API 获取默认分支
    try {
        $api = Invoke-RestMethod -Uri "https://api.github.com/repos/$owner/$repo" -Headers @{ 'User-Agent' = 'single-skill-installer' } -TimeoutSec 20
        $branch = $api.default_branch
    } catch {
        Write-Fail "无法获取仓库默认分支（$owner/$repo）：$($_.Exception.Message)"
        exit 12
    }
}
if (-not $branch) { $branch = 'main' }

$subpathLabel = if ($subpath) { $subpath } else { '<仓库根目录>' }
Write-Step "解析结果：owner=$owner repo=$repo branch=$branch subpath=$subpathLabel"

# ---------- 2. 判定：先探测 SKILL.md（不下载文件夹内容，避免无效下载） ----------
$subUrl = if ($subpath) { "$subpath/SKILL.md" } else { 'SKILL.md' }
$rawUrl = "https://raw.githubusercontent.com/$owner/$repo/$branch/$subUrl"
try {
    $resp = Invoke-WebRequest -Uri $rawUrl -Method Get -SkipHttpErrorCheck -TimeoutSec 20
} catch {
    Write-Fail "检查 SKILL.md 失败：$($_.Exception.Message)"
    exit 13
}
if ($resp.StatusCode -ne 200) {
    Write-Fail "该链接指向的文件夹下没有 SKILL.md（HTTP $($resp.StatusCode)），不是技能文件夹，因此不下载。"
    Write-Fail "探测地址：$rawUrl"
    exit 1
}
Write-Ok "检测到 SKILL.md，确认是技能文件夹，开始下载。"

# ---------- 3. 窄克隆：只拉取该文件夹，绝不整仓 ----------
$skillName = if ($subpath) { ($subpath -split '/')[-1] } else { $repo }
$cacheDir = Join-Path ([System.IO.Path]::GetTempPath()) ("single-skill-install-" + [guid]::NewGuid().ToString('N'))
$cloneArgs = @('clone', '--filter=blob:none', '--no-checkout', '--sparse', '--depth', '1', '--branch', $branch, "https://github.com/$owner/$repo.git", $cacheDir)
Write-Step "窄克隆命令：git $($cloneArgs -join ' ')"
& git @cloneArgs
if ($LASTEXITCODE -ne 0) { Write-Fail "窄克隆失败（退出码 $LASTEXITCODE）。"; exit 14 }

try {
    if ($subpath) {
        & git -C $cacheDir sparse-checkout set --cone $subpath
        if ($LASTEXITCODE -ne 0) { throw "sparse-checkout 失败（退出码 $LASTEXITCODE）" }
    }
    & git -C $cacheDir checkout
    if ($LASTEXITCODE -ne 0) { throw "checkout 失败（退出码 $LASTEXITCODE）" }
} catch {
    Write-Fail "窄检出失败：$($_.Exception.Message)"
    if (-not $KeepCache) { Remove-Item -Recurse -Force $cacheDir -ErrorAction SilentlyContinue }
    exit 15
}

# 校验检出结果确实含 SKILL.md
$srcDir = if ($subpath) {
    Join-Path $cacheDir ($subpath -replace '/', [System.IO.Path]::DirectorySeparatorChar)
} else {
    $cacheDir
}
$srcSkillMd = Join-Path $srcDir 'SKILL.md'
if (-not (Test-Path $srcSkillMd)) {
    Write-Fail "窄检出后未找到 SKILL.md（$srcSkillMd），放弃安装。"
    if (-not $KeepCache) { Remove-Item -Recurse -Force $cacheDir -ErrorAction SilentlyContinue }
    exit 16
}

# ---------- 4. 复制到目标目录 ----------
if (-not $TargetDir) { $TargetDir = (Get-Location).Path }
$TargetDir = [System.IO.Path]::GetFullPath($TargetDir)
if (-not (Test-Path $TargetDir)) { New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null }
$destDir = Join-Path $TargetDir $skillName
if (Test-Path $destDir) {
    if (-not $Force) {
        Write-Fail "目标已存在同名文件夹，默认不覆盖：$destDir （如需覆盖请加 -Force）"
        if (-not $KeepCache) { Remove-Item -Recurse -Force $cacheDir -ErrorAction SilentlyContinue }
        exit 2
    }
    Write-Step "目标已存在，使用 -Force 覆盖：$destDir"
}
Copy-Item -Path $srcDir -Destination $destDir -Recurse -Force
if (-not (Test-Path (Join-Path $destDir 'SKILL.md'))) {
    Write-Fail "复制后校验失败：$destDir"
    exit 17
}

# ---------- 5. 清理临时克隆缓存 ----------
if ($KeepCache) {
    Write-Step "保留临时克隆缓存：$cacheDir"
} else {
    Remove-Item -Recurse -Force $cacheDir -ErrorAction SilentlyContinue
}

# ---------- 6. 输出契约（供调用方 AI agent 读取） ----------
Write-Host ''
Write-Ok "技能安装完成：$skillName"
Write-Host "SKILL_DIR=$destDir"
Write-Host "SKILL_MD=$(Join-Path $destDir 'SKILL.md')"
Write-Host "来源链接=$Url"
if ($subpath) {
    Write-Host "说明：仅下载了仓库内的 $subpath 文件夹（git 窄克隆），未整仓克隆；本次只安装 1 个技能。"
} else {
    Write-Host "说明：仓库根目录即为技能文件夹（git 窄克隆），本次只安装 1 个技能。"
}
exit 0
