---
name: chrome-devtools-skill
description: 使用 Chrome DevTools MCP 获取和分析网页数据。当用户需要抓取网页内容、分析网页结构、提取数据、截图、监控网络请求或执行网页自动化任务时使用此 skill。
---

# Chrome DevTools Skill

使用 Chrome DevTools Protocol 进行网页数据获取和分析。

**快速开始**: 启动 Chrome 远程调试 → 运行 MCP 服务器 → 开始抓取数据

## 前置要求

### 1. 启动 Chrome 远程调试

**Windows (PowerShell)**:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:TEMP\chrome-profile-stable"
```

**macOS/Linux**:

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir="$TMPDIR/chrome-profile-stable"
```

### 2. 启动 MCP 服务器

```bash
npx -y @anthropic-ai/mcp-chrome-devtools-server --port 9222
```

## 核心工作流程

### 基础数据抓取

1. 导航到目标页面: `mcp__chrome-devtools__navigate_page`
2. 等待加载完成: `mcp__chrome-devtools__wait_for`
3. 获取页面快照: `mcp__chrome-devtools__take_snapshot`
4. 提取数据: `mcp__chrome-devtools__evaluate_script`

### 数据提取技巧

**提取列表数据**:

```javascript
() => {
  const items = document.querySelectorAll(".item");
  return Array.from(items).map((item) => ({
    title: item.querySelector(".title")?.innerText,
    link: item.querySelector("a")?.href,
  }));
};
```

**提取表格数据**:

```javascript
() => {
  const rows = document.querySelectorAll("table tr");
  return Array.from(rows).map((row) =>
    Array.from(row.querySelectorAll("td, th")).map((cell) => cell.innerText)
  );
};
```

### 常见用例

- **商品信息抓取**: 导航 → 滚动加载 → 提取列表
- **表单自动化**: 导航 → fill_form → click → wait_for
- **API 监控**: 导航 → list_network_requests → get_network_request
- **性能分析**: performance_start_trace → 操作 → performance_stop_trace

## 最佳实践

1. 先用 `take_snapshot` 了解页面结构
2. 复杂提取用 `evaluate_script` 执行 JavaScript
3. 确保返回 JSON 可序列化的数据
4. 处理动态内容时使用 `wait_for`

## Chrome DevTools MCP 配置信息

如果用户询问`chrome-devtools MCP`怎么配置，提供以下 JSON 配置信息：

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
