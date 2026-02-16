---
name: chrome-devtools
description: 启动配置了远程调试端口的Chrome浏览器，并通过chrome-devtools MCP进行网页自动化操作。当用户需要操作网页、进行网页自动化、网页爬虫、网页测试或与浏览器相关的任务时触发。用户提到chrome-devtools、浏览器自动化、网页操作等关键词时使用此skill。
---

# Chrome DevTools MCP Skill

此skill用于启动支持调试的Chrome浏览器，并通过chrome-devtools MCP进行网页自动化操作。

## 快速开始

### 1. 启动Chrome浏览器

运行PowerShell脚本启动配置了远程调试端口的Chrome：

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:TEMP\chrome-profile-stable"
```

或执行skill中的脚本：

```bash
powershell -ExecutionPolicy Bypass -File scripts/start-chrome.ps1
```

### 2. MCP配置

如果用户需要配置chrome-devtools MCP，提供以下JSON配置：

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "chrome-devtools-mcp@latest",
        "--browser-url=http://127.0.0.1:9222"
      ]
    }
  }
}
```

## 工作流程

1. **分析用户需求**：判断是否与网页操作相关
2. **启动Chrome**：使用远程调试端口9222启动浏览器
3. **配置MCP**：确保chrome-devtools MCP已配置
4. **执行操作**：使用MCP工具进行网页自动化

## 常见使用场景

- 网页数据抓取
- 网页自动化测试
- 网页截图
- 网页内容分析
- 表单自动填写
- 网页性能分析

## 注意事项

- Chrome必须带`--remote-debugging-port=9222`参数启动
- 每个会话使用独立的user-data-dir避免冲突
- 确保9222端口未被占用
