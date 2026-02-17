#!/usr/bin/env pwsh
# Quick push to GitHub script

param(
    [string]$message = "Update: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
)

Write-Host "Checking Git status..." -ForegroundColor Cyan

# Check for changes
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "No changes to commit" -ForegroundColor Green
    exit 0
}

Write-Host "Adding all changes..." -ForegroundColor Cyan
git add .

Write-Host "Committing changes..." -ForegroundColor Cyan
git commit -m $message

Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
git push

if ($LASTEXITCODE -eq 0) {
    Write-Host "Successfully pushed to GitHub!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Push failed" -ForegroundColor Red
    exit 1
}
