#!/usr/bin/env pwsh
# Wrapper script to ensure process exits after push

param(
    [string]$message = "Update: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
)

# Run the push script
if ($message -eq "Update: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')") {
    & "$PSScriptRoot\push.ps1"
} else {
    & "$PSScriptRoot\push.ps1" $message
}

# Force exit to stop the debugger
$exitCode = $LASTEXITCODE
[System.Environment]::Exit($exitCode)
