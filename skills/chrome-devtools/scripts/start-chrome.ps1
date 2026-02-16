# 启动Chrome浏览器并启用远程调试端口
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$profileDir = "$env:TEMP\chrome-profile-stable"

# 检查Chrome是否存在
if (-not (Test-Path $chromePath)) {
    Write-Error "未找到Chrome浏览器，请检查安装路径: $chromePath"
    exit 1
}

# 创建用户数据目录
if (-not (Test-Path $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}

# 启动Chrome
Write-Host "正在启动Chrome浏览器（远程调试端口: 9222）..."
Start-Process -FilePath $chromePath -ArgumentList "--remote-debugging-port=9222", "--user-data-dir=`"$profileDir`""

Write-Host "Chrome已启动！"
Write-Host "调试URL: http://127.0.0.1:9222"
Write-Host ""
Write-Host "MCP配置:"
Write-Host '{'
Write-Host '  "mcpServers": {'
Write-Host '    "chrome-devtools": {'
Write-Host '      "command": "npx",'
Write-Host '      "args": ['
Write-Host '        "chrome-devtools-mcp@latest",'
Write-Host '        "--browser-url=http://127.0.0.1:9222"'
Write-Host '      ]'
Write-Host '    }'
Write-Host '  }'
Write-Host '}'
