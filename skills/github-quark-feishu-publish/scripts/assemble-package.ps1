# 技能发布包：组装 + 压缩 + 自校验（PowerShell 5.1 兼容）
# 用法示例:
#   powershell -ExecutionPolicy Bypass -File assemble-package.ps1
#   powershell -ExecutionPolicy Bypass -File assemble-package.ps1 -NamePrefix "AI安卓手机自动化的软件 apk + SKILL" -SkillSource "D:\github\autojs-mobile-automation-yashu-public" -ApkPath "D:\github\autojs-mobile-automation-yashu\任务执行器_1.0.2.apk" -OutputDir "D:\software\workBuddyWorkspace"
param(
    [string]$NamePrefix = "AI安卓手机自动化的软件 apk + SKILL",
    [string]$SkillSource = "D:\github\autojs-mobile-automation-yashu-public",
    [string]$ApkPath = "D:\github\autojs-mobile-automation-yashu\任务执行器_1.0.2.apk",
    [string]$OutputDir = "D:\software\workBuddyWorkspace",
    [string]$Timestamp = ""
)
$ErrorActionPreference = "Stop"

# 0. 前置校验
if (-not (Test-Path $SkillSource)) { throw "技能源目录不存在: $SkillSource" }
if (-not (Test-Path $ApkPath)) { throw "APK 不存在: $ApkPath" }
if (-not (Test-Path $OutputDir)) { New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null }

# 1. 时间戳：年 4 位，其余 2 位
if (-not $Timestamp) { $Timestamp = Get-Date -Format "yyyyMMdd_HHmmss" }
$name = "$NamePrefix-$Timestamp"
$parent = Join-Path $OutputDir $name
$skillLeaf = Split-Path $SkillSource -Leaf

# 2. 组装目录
New-Item -ItemType Directory -Path $parent -Force | Out-Null
Copy-Item $ApkPath $parent -Force
$skillDest = Join-Path $parent $skillLeaf
New-Item -ItemType Directory -Path $skillDest -Force | Out-Null
robocopy $SkillSource $skillDest /E /XD ".git" ".vscode" /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy 失败，退出码: $LASTEXITCODE" }

# 3. 压缩（tar/bsdtar，保证中文文件名 UTF-8）
$zip = "$parent.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
tar -a -c -f $zip -C $OutputDir $name
if ($LASTEXITCODE -ne 0) { throw "tar 打包失败" }

# 4. 自校验：解压 + 中文名 + APK 哈希
$tmp = Join-Path $OutputDir "_verify_tmp"
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory $tmp | Out-Null
tar -xf $zip -C $tmp
if ($LASTEXITCODE -ne 0) { throw "tar 解压校验失败" }
$extractedApk = Join-Path $tmp "$name\$(Split-Path $ApkPath -Leaf)"
if (-not (Test-Path $extractedApk)) { throw "解压后 APK 缺失" }
$h1 = (Get-FileHash $ApkPath -Algorithm SHA256).Hash
$h2 = (Get-FileHash $extractedApk -Algorithm SHA256).Hash
$hashOk = ($h1 -eq $h2)
Remove-Item $tmp -Recurse -Force

Write-Output "FOLDER=$parent"
Write-Output "ZIP=$zip"
Write-Output "APK_HASH_MATCH=$hashOk"
if (-not $hashOk) { throw "APK 哈希不一致" }
Write-Output "OK"
