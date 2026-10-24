#Requires -Version 7.0
<#
.SYNOPSIS
    清空 Obsidian「临时仓库」中指定子文件夹的内容，批量送入 Windows 回收站。

.DESCRIPTION
    硬编码安全边界：
      - 只允许操作根目录 D:\obsidian-vault\临时仓库（传入其它路径直接抛错退出）
      - 只处理 01 02 03 04 05 06 external-notes-temp 这 7 个文件夹
      - 只清空这 7 个文件夹的「直接子项」，文件夹本身保留
      - .obsidian 及任何其它路径一律不碰
      - 删除走回收站（可恢复），不做永久删除
      - 软链接（ReparsePoint）一律保留，不删除，也不跟随链接删目标

    本脚本与任何 AI agent 软件解耦：不引用任何 agent 的安装路径，
    默认日志目录为「调用时工作目录」下的 _logs\obsidian-clear-notes
    （跟当前工作区走），目录不可写时退回 %TEMP%\obsidian-clear-notes。

    性能设计（批量暂存模式）：
      - 先把 7 个文件夹的直接子项 Move-Item 进仓库根下的暂存目录
        _recycle_staging_<时间戳>（按源文件夹分子目录；同盘移动是瞬时重命名）
      - 再对暂存目录做一次 DeleteDirectory 整体送回收站
        —— 1 次 shell 操作替代 N 次逐条删除，条目多时快一个数量级
      - 批量删除失败时自动回退为逐条送回收站
      - 启动时自动把上次运行残留的 _recycle_staging_* 送回收站（自愈）
      - 日志带计时打点：移入暂存 / 送回收站 / 校验 / 总计

    注意：回收站里表现为一个 _recycle_staging_<时间戳> 暂存文件夹
    （内部按源文件夹分子目录），恢复单个文件需进入该文件夹翻找。

.PARAMETER VaultPath
    目标仓库根目录。只接受默认值，传其它值会被拒绝。

.PARAMETER DryRun
    只列出将要删除的条目，不实际删除。

.PARAMETER LogDir
    日志输出目录，默认「调用时工作目录」下的 _logs\obsidian-clear-notes。

.EXAMPLE
    pwsh -NoProfile -ExecutionPolicy Bypass -File .\clear_temp_notes.ps1
#>
[CmdletBinding()]
param(
    [string]$VaultPath = 'D:\obsidian-vault\临时仓库',
    [switch]$DryRun,
    [string]$LogDir = $(try { Join-Path (Get-Location).Path '_logs\obsidian-clear-notes' } catch { Join-Path $env:TEMP 'obsidian-clear-notes' })
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$swTotal = [System.Diagnostics.Stopwatch]::StartNew()

# ---------------------------------------------------------------- 安全常量
$AllowedRoot   = 'D:\obsidian-vault\临时仓库'
$TargetFolders = @('01', '02', '03', '04', '05', '06', 'external-notes-temp')
$ProtectedDirs = @('.obsidian')
$StagingPrefix = '_recycle_staging_'

# ---------------------------------------------------------------- 日志
$lines = [System.Collections.Generic.List[string]]::new()
function Write-Log([string]$msg) {
    $lines.Add($msg)
    Write-Host $msg
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
try {
    if (-not (Test-Path -LiteralPath $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
    $LogFile = Join-Path $LogDir "clear-notes-$stamp.txt"
} catch {
    $LogDir = Join-Path $env:TEMP 'obsidian-clear-notes'
    if (-not (Test-Path -LiteralPath $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
    $LogFile = Join-Path $LogDir "clear-notes-$stamp.txt"
}

function Normalize-FullPath([string]$p) {
    $full = [System.IO.Path]::GetFullPath($p)
    return $full.TrimEnd([char]'\', [char]'/')
}

# 软链接 / junction 判定：带 ReparsePoint 属性的条目一律保留，不删
function Test-IsLink([System.IO.FileSystemInfo]$item) {
    return [bool]($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint)
}

# ---------------------------------------------------------------- 1. 校验根目录
try {
    $root    = Normalize-FullPath $VaultPath
    $allowed = Normalize-FullPath $AllowedRoot
} catch {
    $root = ''
    $allowed = Normalize-FullPath $AllowedRoot
}

Write-Log "=== 清空笔记（批量送入回收站） $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ==="
Write-Log "目标根目录 : $root"
Write-Log "允许根目录 : $allowed"
Write-Log "DryRun     : $([bool]$DryRun)"
Write-Log ""

if ($root -ne $allowed) {
    Write-Log "!! 拒绝执行：目标根目录与允许目录不一致。本技能只允许操作 $allowed"
    $lines | Set-Content -LiteralPath $LogFile -Encoding utf8
    throw "路径校验失败：$root != $allowed"
}
if (-not (Test-Path -LiteralPath $root -PathType Container)) {
    Write-Log "!! 拒绝执行：$root 不存在或不是文件夹"
    $lines | Set-Content -LiteralPath $LogFile -Encoding utf8
    throw "目标根目录不存在：$root"
}

# ---------------------------------------------------------------- 2. 记录 .obsidian 基线
$obsidianPath = Join-Path $root '.obsidian'
$obsidianBefore = -1
if (Test-Path -LiteralPath $obsidianPath -PathType Container) {
    $obsidianBefore = @(Get-ChildItem -LiteralPath $obsidianPath -Recurse -Force -ErrorAction SilentlyContinue).Count
}
Write-Log "受保护目录 .obsidian 基线条目数: $obsidianBefore"
Write-Log ""

# ---------------------------------------------------------------- 3. 删除引擎
Add-Type -AssemblyName Microsoft.VisualBasic
$UIOpt = [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs
$RbOpt = [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin

$stat = [ordered]@{}
$failed = [System.Collections.Generic.List[string]]::new()
$keptLinks = [System.Collections.Generic.List[string]]::new()

function Clear-ReadOnlyRecursive([string]$path) {
    # 清掉 path 及其内容的 ReadOnly 属性（跳过软链接，不进入链接目标）
    try {
        $item = Get-Item -LiteralPath $path -Force
        if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { return }
        if ($item.Attributes -band [System.IO.FileAttributes]::ReadOnly) {
            $item.Attributes = $item.Attributes -band (-bnot [System.IO.FileAttributes]::ReadOnly)
        }
        if ($item.PSIsContainer) {
            Get-ChildItem -LiteralPath $path -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
                if ($_.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { return }
                if ($_.Attributes -band [System.IO.FileAttributes]::ReadOnly) {
                    $_.Attributes = $_.Attributes -band (-bnot [System.IO.FileAttributes]::ReadOnly)
                }
            }
        }
    } catch { }
}

function Remove-PathToRecycleBin([string]$path) {
    # 返回 $true 表示 path 已不在磁盘上（进了回收站，或本就不存在）。
    # 已知怪癖：VisualBasic 包装器在条目其实已进回收站后仍可能抛
    # "Unable to find the specified file"，故一律事后 Test-Path 复核。
    if (-not (Test-Path -LiteralPath $path)) { return $true }
    $isDir = Test-Path -LiteralPath $path -PathType Container
    for ($attempt = 1; $attempt -le 2; $attempt++) {
        try {
            if ($isDir) {
                [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($path, $UIOpt, $RbOpt)
            } else {
                [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($path, $UIOpt, $RbOpt)
            }
        } catch {
            if (-not (Test-Path -LiteralPath $path)) { return $true }
            if ($attempt -eq 1) {
                # 只读属性可能挡住删除，清掉属性后重试一次
                Clear-ReadOnlyRecursive $path
                continue
            }
        }
        break
    }
    return (-not (Test-Path -LiteralPath $path))
}

# ---------------------------------------------------------------- 4. 自愈：清掉上次残留的暂存目录
$swRecover = [System.Diagnostics.Stopwatch]::StartNew()
$recovered = 0
$leftoverStaging = @()
if (-not $DryRun) {
    $leftoverStaging = @(Get-ChildItem -LiteralPath $root -Filter ($StagingPrefix + '*') -Directory -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Name.StartsWith($StagingPrefix, [System.StringComparison]::OrdinalIgnoreCase) })
}
foreach ($s in $leftoverStaging) {
    if (Test-IsLink $s) { continue }
    if (Remove-PathToRecycleBin $s.FullName) {
        Write-Log "自愈：上次残留暂存目录已送回收站: $($s.FullName)"
        $recovered++
    } else {
        Write-Log "!! 残留暂存目录送回收站失败: $($s.FullName)"
        $failed.Add($s.FullName)
    }
}
$swRecover.Stop()

# ---------------------------------------------------------------- 5. 枚举并移入暂存目录
$staging = Join-Path $root ($StagingPrefix + $stamp)
$swMove = [System.Diagnostics.Stopwatch]::StartNew()

foreach ($name in $TargetFolders) {
    $dir = Join-Path $root $name

    # 双重保险：绝不允许越出根目录，也绝不允许踩到受保护目录
    $dirFull = Normalize-FullPath $dir
    if (-not $dirFull.StartsWith($root + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
        Write-Log "!! 跳过 $name ：解析后路径越界（$dirFull）"
        $stat[$name] = [PSCustomObject]@{ Deleted = 0; Skipped = 0; Failed = 0; Staged = [System.Collections.Generic.List[string]]::new() }
        continue
    }
    if ($ProtectedDirs -contains $name) {
        Write-Log "!! 跳过 $name ：属受保护目录"
        $stat[$name] = [PSCustomObject]@{ Deleted = 0; Skipped = 0; Failed = 0; Staged = [System.Collections.Generic.List[string]]::new() }
        continue
    }
    $stat[$name] = [PSCustomObject]@{ Deleted = 0; Skipped = 0; Failed = 0; Staged = [System.Collections.Generic.List[string]]::new() }

    if (-not (Test-Path -LiteralPath $dir -PathType Container)) {
        Write-Log "[$name] 不存在，跳过"
        continue
    }

    Write-Log "[$name] 开始处理 $dirFull"
    $skipped = 0; $fail = 0

    $children = @(Get-ChildItem -LiteralPath $dirFull -Force -ErrorAction SilentlyContinue)
    if ($children.Count -eq 0) { Write-Log "  (空)" }

    foreach ($child in $children) {
        $childFull = Normalize-FullPath $child.FullName
        if (-not $childFull.StartsWith($dirFull + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
            Write-Log "  !! 越界，跳过: $childFull"
            $fail++
            continue
        }

        # 软链接（符号链接 / junction）：按用户明确指示一律保留，既不删链接本身，
        # 也不跟随链接去删它指向的目标文件。移入暂存之前就已排除。
        if (Test-IsLink $child) {
            Write-Log "  保留软链接（不删除）: $childFull"
            $keptLinks.Add($childFull)
            $skipped++
            continue
        }

        if ($DryRun) {
            Write-Log "  [dry-run] 将删除: $childFull"
            $stat[$name].Deleted++
            continue
        }

        # 同盘 Move-Item 是瞬时重命名，不搬数据
        $stagingSub = Join-Path $staging $name
        try {
            if (-not (Test-Path -LiteralPath $stagingSub)) {
                New-Item -ItemType Directory -Path $stagingSub -Force | Out-Null
            }
            Move-Item -LiteralPath $childFull -Destination $stagingSub
        } catch {
            Write-Log "  !! 移入暂存失败（保留原位）: $childFull — $($_.Exception.Message)"
            $fail++
            $failed.Add($childFull)
            continue
        }
        Write-Log "  移入暂存: $childFull"
        $stat[$name].Staged.Add((Join-Path $stagingSub $child.Name))
    }

    if ($fail -gt 0) { $stat[$name].Failed += $fail }
    $stat[$name].Skipped += $skipped
    Write-Log ""
}

$toMove = ($stat.Values | ForEach-Object { $_.Staged.Count } | Measure-Object -Sum).Sum
if ($null -eq $toMove) { $toMove = 0 }
$swMove.Stop()

# ---------------------------------------------------------------- 6. 批量送回收站
$batchMode = 'none'
$swRB = [System.Diagnostics.Stopwatch]::StartNew()
if (-not $DryRun -and $toMove -gt 0) {
    Clear-ReadOnlyRecursive $staging
    if (Remove-PathToRecycleBin $staging) {
        $batchMode = 'batch'
    } else {
        Write-Log "!! 批量删除失败，回退为逐条送回收站"
        $batchMode = 'fallback'
        $kids = @(Get-ChildItem -LiteralPath $staging -Force -ErrorAction SilentlyContinue)
        foreach ($k in $kids) {
            if (Test-IsLink $k) { continue }
            [void](Remove-PathToRecycleBin $k.FullName)
        }
    }
}
$swRB.Stop()

# ---------------------------------------------------------------- 7. 确认：以暂存路径是否仍存在为准
foreach ($name in $TargetFolders) {
    $v = $stat[$name]
    foreach ($sp in $v.Staged) {
        if (Test-Path -LiteralPath $sp) {
            Write-Log "!! 删除失败（仍在暂存目录）: $sp"
            $v.Failed++
            $failed.Add($sp)
        } else {
            $v.Deleted++
        }
    }
}

foreach ($name in $TargetFolders) {
    $v = $stat[$name]
    if ($v.Deleted -gt 0 -or $v.Skipped -gt 0 -or $v.Failed -gt 0) {
        Write-Log ("[{0}] 完成：删除 {1} / 跳过 {2} / 失败 {3}" -f $name, $v.Deleted, $v.Skipped, $v.Failed)
    }
}
Write-Log ""

# ---------------------------------------------------------------- 8. 收尾校验
$swVerify = [System.Diagnostics.Stopwatch]::StartNew()
$obsidianAfter = -1
if (Test-Path -LiteralPath $obsidianPath -PathType Container) {
    $obsidianAfter = @(Get-ChildItem -LiteralPath $obsidianPath -Recurse -Force -ErrorAction SilentlyContinue).Count
}
$obsidianOk = ($obsidianBefore -eq $obsidianAfter)

$totalDel = ($stat.Values | Measure-Object -Property Deleted -Sum).Sum
$totalFail = ($stat.Values | Measure-Object -Property Failed -Sum).Sum

Write-Log "=== 汇总 ==="
foreach ($k in $stat.Keys) {
    $v = $stat[$k]
    Write-Log ("{0,-20} 删除 {1,-5} 跳过 {2,-5} 失败 {3}" -f $k, $v.Deleted, $v.Skipped, $v.Failed)
}
Write-Log ""
Write-Log "总计送入回收站条目: $totalDel"
Write-Log "失败条目           : $totalFail"
Write-Log ".obsidian 条目数   : $obsidianBefore -> $obsidianAfter  ($(if ($obsidianOk) { '未改动 OK' } else { '!! 发生变化，请检查' }))"
Write-Log "保留的软链接条目   : $($keptLinks.Count)（按用户指示不删除）"
foreach ($l in $keptLinks) { Write-Log "  - $l" }

# 统计残留时排除软链接：软链接属于「应保留」，不算残留
$leftInTargets = 0
$leftLinks = 0
foreach ($name in $TargetFolders) {
    $d = Join-Path $root $name
    if (Test-Path -LiteralPath $d -PathType Container) {
        $rest = @(Get-ChildItem -LiteralPath $d -Recurse -Force -ErrorAction SilentlyContinue)
        foreach ($r in $rest) {
            if (Test-IsLink $r) { $leftLinks++; continue }
            $leftInTargets++
        }
    }
}
Write-Log "7 个目标文件夹内剩余条目: $leftInTargets $(if ($DryRun) { '(dry-run，未真删)' } elseif ($leftInTargets -eq 0) { 'OK' } else { '!! 仍有残留' })"
Write-Log "  其中软链接（保留）      : $leftLinks"
Write-Log "7 个文件夹本身          : $((@($TargetFolders | Where-Object { Test-Path -LiteralPath (Join-Path $root $_) -PathType Container })).Count)/7 保留"
$stagingGone = -not (Test-Path -LiteralPath $staging)
Write-Log "暂存目录已清空         : $stagingGone $(if ($DryRun) { '(dry-run，未创建暂存)' } elseif ($stagingGone) { 'OK' } else { '!! 条目仍留在暂存目录，可手工恢复' })"

$swVerify.Stop()

$modeText = switch ($batchMode) {
    'batch'    { '批量 1 次 shell 操作' }
    'fallback' { '批量失败→回退逐条' }
    default    { '无待删条目' }
}
Write-Log ""
Write-Log "[计时] 移入暂存 $('{0:N2}' -f $swMove.Elapsed.TotalSeconds)s | 送回收站 $('{0:N2}' -f $swRB.Elapsed.TotalSeconds)s（$modeText） | 校验 $('{0:N2}' -f $swVerify.Elapsed.TotalSeconds)s"
if ($recovered -gt 0) {
    Write-Log "[计时] 脚本总计 $('{0:N2}' -f $swTotal.Elapsed.TotalSeconds)s（含自愈 $('{0:N2}' -f $swRecover.Elapsed.TotalSeconds)s）"
} else {
    Write-Log "[计时] 脚本总计 $('{0:N2}' -f $swTotal.Elapsed.TotalSeconds)s"
}
Write-Log ""
Write-Log "日志: $LogFile"

$lines | Set-Content -LiteralPath $LogFile -Encoding utf8
Write-Host ""
Write-Host "LOG_FILE=$LogFile"
if ($totalFail -gt 0 -or -not $obsidianOk -or (-not $DryRun -and ($leftInTargets -gt 0 -or -not $stagingGone))) { exit 2 }
exit 0
